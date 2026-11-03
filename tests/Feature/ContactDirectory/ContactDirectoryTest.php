<?php

use App\Models\ContactDirectory\ContactCompany;
use App\Models\ContactDirectory\ContactDirectoryContact;
use App\Models\ContactDirectory\ContactFollowUp;
use App\Models\ContactDirectory\PriceRequest;
use App\Models\ContactDirectory\PriceRequestItem;
use App\Models\ContactDirectory\PriceRequestPreferredQuote;
use App\Models\ContactDirectory\SupplierQuote;
use App\Models\User;
use App\Models\UserLevel;
use App\Services\ContactDirectory\FollowUpReminderService;
use App\Services\ContactDirectory\SupplierQuoteCalculator;
use App\Services\ContactDirectory\NeedsAttentionService;

use function Pest\Laravel\actingAs;

beforeEach(function () {
    $this->level = UserLevel::firstOrCreate(
        ['name' => UserLevel::SUPER_ADMIN],
        ['permissions' => [], 'mobile_permissions' => []],
    );

    $this->admin = User::factory()->create([
        'level_id' => $this->level->id,
    ]);

    $this->company = ContactCompany::create([
        'name' => 'Acme Supply',
        'website' => 'https://acme.example.com',
        'city' => 'Scranton',
        'state' => 'PA',
    ]);
});

it('stores a contact with multiple phones and emails and one primary each', function () {
    actingAs($this->admin)
        ->postJson(route('contact-directory.contacts.store'), [
            'first_name' => 'Ricardo',
            'last_name' => 'Lopez',
            'job_title' => 'Purchasing manager',
            'contact_type' => 'supplier',
            'owner_id' => $this->admin->id,
            'is_active' => true,
            'phone_numbers' => [
                ['phone_number' => '+1 570 555 0100', 'label' => 'office', 'extension' => '12', 'is_primary' => true],
                ['phone_number' => '+1 570 555 0199', 'label' => 'mobile'],
            ],
            'email_addresses' => [
                ['email_address' => 'ricardo@acme.com', 'label' => 'main', 'is_primary' => true],
                ['email_address' => 'purchasing@acme.com', 'label' => 'shared'],
            ],
        ])
        ->assertRedirect();

    $contact = ContactDirectoryContact::query()->firstOrFail();

    expect($contact->phoneNumbers)->toHaveCount(2);
    expect($contact->emailAddresses)->toHaveCount(2);
    expect($contact->primaryPhone->phone_number)->toBe('+1 570 555 0100');
    expect($contact->primaryEmail->email_address)->toBe('ricardo@acme.com');
});

it('rejects two primary phone numbers', function () {
    actingAs($this->admin)
        ->postJson(route('contact-directory.contacts.store'), [
            'first_name' => 'Ricardo',
            'contact_type' => 'supplier',
            'owner_id' => $this->admin->id,
            'phone_numbers' => [
                ['phone_number' => '+1 570 555 0100', 'is_primary' => true],
                ['phone_number' => '+1 570 555 0199', 'is_primary' => true],
            ],
        ])
        ->assertInvalid(['phone_numbers']);
});

it('rejects duplicate phone numbers on the same contact', function () {
    actingAs($this->admin)
        ->postJson(route('contact-directory.contacts.store'), [
            'first_name' => 'Ricardo',
            'contact_type' => 'supplier',
            'owner_id' => $this->admin->id,
            'phone_numbers' => [
                ['phone_number' => '+1 570 555 0100', 'is_primary' => true],
                ['phone_number' => '+1 570 555 0100'],
            ],
        ])
        ->assertInvalid(['phone_numbers.1.phone_number']);
});

it('blocks users without the contacts permission', function () {
    $viewerLevel = UserLevel::firstOrCreate(
        ['name' => 'Visitor'],
        ['permissions' => ['view-dashboard' => true], 'mobile_permissions' => []],
    );

    $viewer = User::factory()->create([
        'level_id' => $viewerLevel->id,
    ]);

    actingAs($viewer)
        ->get(route('contact-directory.contacts.index'))
        ->assertForbidden();

    actingAs($viewer)
        ->postJson(route('contact-directory.contacts.store'), [
            'first_name' => 'Ricardo',
            'contact_type' => 'supplier',
            'owner_id' => $viewer->id,
        ])
        ->assertForbidden();
});

it('requires an inquiry activity to use the inquiry contact', function () {
    $contact = ContactDirectoryContact::create([
        'company_id' => $this->company->id,
        'first_name' => 'Ricardo',
        'contact_type' => 'supplier',
        'owner_id' => $this->admin->id,
    ]);

    $otherContact = ContactDirectoryContact::create([
        'first_name' => 'Someone',
        'contact_type' => 'customer',
        'owner_id' => $this->admin->id,
    ]);

    $priceRequest = PriceRequest::create([
        'title' => 'Door hardware',
        'owner_id' => $this->admin->id,
        'currency' => 'USD',
        'status' => 'open',
    ]);

    PriceRequestItem::create([
        'price_request_id' => $priceRequest->id,
        'description' => 'Hinges',
        'quantity' => 10,
        'unit_of_measure' => 'each',
    ]);

    $inquiry = $contact->inquiries()->create([
        'price_request_id' => $priceRequest->id,
        'title' => 'Hinges quote',
        'priority' => 'normal',
        'status' => 'open',
        'created_by' => $this->admin->id,
    ]);

    // The inquiry controller always uses the inquiry contact, so this proves
    // the relationship is enforced rather than trusting the request payload.
    actingAs($this->admin)
        ->postJson(route('contact-directory.inquiries.activities.store', $inquiry->uuid), [
            'activity_type' => 'phone_call',
            'direction' => 'outgoing',
            'subject' => 'Follow-up call',
            'occurred_at' => now()->toISOString(),
        ])
        ->assertRedirect();

    expect($inquiry->activities()->first()->contact_id)->toBe($contact->id);
    expect($inquiry->contact_id)->not->toBe($otherContact->id);
});

it('completes, reschedules, snoozes and cancels a follow-up without closing the inquiry', function () {
    $contact = ContactDirectoryContact::create([
        'first_name' => 'Ricardo',
        'contact_type' => 'supplier',
        'owner_id' => $this->admin->id,
    ]);

    $inquiry = $contact->inquiries()->create([
        'title' => 'Standalone inquiry',
        'priority' => 'normal',
        'status' => 'open',
        'created_by' => $this->admin->id,
    ]);

    $followUp = ContactFollowUp::create([
        'contact_id' => $contact->id,
        'inquiry_id' => $inquiry->id,
        'title' => 'Call about pricing',
        'assigned_user_id' => $this->admin->id,
        'due_at' => now()->addDay(),
        'reminder_at' => now()->addHours(2),
        'priority' => 'normal',
        'status' => 'pending',
        'created_by' => $this->admin->id,
    ]);

    actingAs($this->admin)
        ->postJson(route('contact-directory.follow-ups.snooze', $followUp->uuid), [
            'snoozed_until' => now()->addHours(6)->toISOString(),
            'reason' => 'Waiting on the supplier.',
        ])
        ->assertRedirect();

    expect($followUp->fresh()->snoozed_until)->not->toBeNull();

    actingAs($this->admin)
        ->postJson(route('contact-directory.follow-ups.reschedule', $followUp->uuid), [
            'due_at' => now()->addDays(3)->toISOString(),
        ])
        ->assertRedirect();

    expect($followUp->fresh()->snoozed_until)->toBeNull();
    expect($followUp->fresh()->snoozed_reason)->toBeNull();

    actingAs($this->admin)
        ->postJson(route('contact-directory.follow-ups.complete', $followUp->uuid), [])
        ->assertRedirect();

    expect($followUp->fresh()->status)->toBe('completed');
    expect($followUp->fresh()->completed_by)->toBe($this->admin->id);
    expect($inquiry->fresh()->status)->toBe('open');
});

it('delivers a reminder once and skips stale or completed tasks', function () {
    $contact = ContactDirectoryContact::create([
        'first_name' => 'Ricardo',
        'contact_type' => 'supplier',
        'owner_id' => $this->admin->id,
    ]);

    $inquiry = $contact->inquiries()->create([
        'title' => 'Inquiry',
        'priority' => 'normal',
        'status' => 'open',
        'created_by' => $this->admin->id,
    ]);

    $followUp = ContactFollowUp::create([
        'contact_id' => $contact->id,
        'inquiry_id' => $inquiry->id,
        'title' => 'Chase pricing',
        'assigned_user_id' => $this->admin->id,
        'due_at' => now()->addHour(),
        'reminder_at' => now()->subMinutes(5),
        'priority' => 'high',
        'status' => 'pending',
        'created_by' => $this->admin->id,
    ]);

    $service = app(FollowUpReminderService::class);

    expect($service->notifyDueReminders())->toBe(1);
    expect($service->notifyDueReminders())->toBe(0);

    $completed = ContactFollowUp::create([
        'contact_id' => $contact->id,
        'inquiry_id' => $inquiry->id,
        'title' => 'Already done',
        'assigned_user_id' => $this->admin->id,
        'due_at' => now()->addHour(),
        'reminder_at' => now()->subMinutes(5),
        'priority' => 'normal',
        'status' => 'completed',
        'completed_at' => now(),
        'created_by' => $this->admin->id,
    ]);

    $service->notifyDueReminders();

    expect($completed->notifications)->toBeEmpty();
    expect($this->admin->unreadNotifications()->count())->toBe(1);
});

it('stores multiple supplier inquiries under one price request', function () {
    $contactA = ContactDirectoryContact::create([
        'first_name' => 'A',
        'contact_type' => 'supplier',
        'owner_id' => $this->admin->id,
    ]);

    $contactB = ContactDirectoryContact::create([
        'first_name' => 'B',
        'contact_type' => 'supplier',
        'owner_id' => $this->admin->id,
    ]);

    $priceRequest = PriceRequest::create([
        'title' => 'Door hardware',
        'owner_id' => $this->admin->id,
        'currency' => 'USD',
        'status' => 'open',
    ]);

    PriceRequestItem::create([
        'price_request_id' => $priceRequest->id,
        'description' => 'Hinges',
        'quantity' => 10,
        'unit_of_measure' => 'each',
    ]);

    $inquiryA = $priceRequest->inquiries()->create([
        'contact_id' => $contactA->id,
        'title' => 'Hinges from A',
        'priority' => 'normal',
        'status' => 'open',
        'created_by' => $this->admin->id,
    ]);

    $inquiryB = $priceRequest->inquiries()->create([
        'contact_id' => $contactB->id,
        'title' => 'Hinges from B',
        'priority' => 'normal',
        'status' => 'open',
        'created_by' => $this->admin->id,
    ]);

    expect($priceRequest->inquiries)->toHaveCount(2);
    expect($inquiryA->contact_id)->toBe($contactA->id);
    expect($inquiryB->contact_id)->toBe($contactB->id);
});

it('stores quote revisions and marks only the newest as current', function () {
    $contact = ContactDirectoryContact::create([
        'first_name' => 'A',
        'contact_type' => 'supplier',
        'owner_id' => $this->admin->id,
    ]);

    $inquiry = $contact->inquiries()->create([
        'title' => 'Hinges',
        'priority' => 'normal',
        'status' => 'open',
        'created_by' => $this->admin->id,
    ]);

    $first = $inquiry->supplierQuotes()->create([
        'revision_number' => 1,
        'is_current_revision' => false,
        'currency' => 'USD',
        'grand_total' => '100.00',
        'created_by' => $this->admin->id,
    ]);

    $second = $inquiry->supplierQuotes()->create([
        'revision_number' => 2,
        'is_current_revision' => true,
        'currency' => 'USD',
        'grand_total' => '120.00',
        'created_by' => $this->admin->id,
    ]);

    expect($inquiry->supplierQuotes)->toHaveCount(2);
    expect($inquiry->currentQuote->id)->toBe($second->id);
    expect($first->fresh()->is_current_revision)->toBeFalse();
});

it('calculates quote totals server side and distinguishes missing prices', function () {
    $calculator = new SupplierQuoteCalculator();

    expect($calculator->calculateItemLineTotal(10, '12.345'))->toBe('123.45');
    expect($calculator->calculateItemLineTotal(10, null))->toBe('0.00');

    $contact = ContactDirectoryContact::create([
        'first_name' => 'A',
        'contact_type' => 'supplier',
        'owner_id' => $this->admin->id,
    ]);

    $inquiry = $contact->inquiries()->create([
        'title' => 'Hinges',
        'priority' => 'normal',
        'status' => 'open',
        'created_by' => $this->admin->id,
    ]);

    $quote = $inquiry->supplierQuotes()->create([
        'revision_number' => 1,
        'is_current_revision' => true,
        'currency' => 'USD',
        'discount_amount' => '5.00',
        'discount_mode' => 'amount',
        'freight_amount' => '20.00',
        'tax_amount' => '6.00',
        'other_charges_amount' => '0.00',
        'grand_total' => '0.00',
        'created_by' => $this->admin->id,
    ]);

    $quote->items()->create([
        'description' => 'Hinges',
        'quantity' => 10,
        'unit_of_measure' => 'each',
        'unit_price' => '10.00',
        'line_total' => $calculator->calculateItemLineTotal(10, '10.00'),
    ]);

    $quote->items()->create([
        'description' => 'Screws',
        'quantity' => 2,
        'unit_of_measure' => 'box',
        'unit_price' => null,
        'line_total' => $calculator->calculateItemLineTotal(2, null),
    ]);

    $quote->refresh();
    $quote->update(['grand_total' => $calculator->calculateGrandTotal($quote)]);

    expect($quote->fresh()->grand_total)->toBe('121.00');
    expect($quote->items()->whereNull('unit_price')->count())->toBe(1);
});

it('flags quotes with missing items, prices or units as not comparable', function () {
    $contact = ContactDirectoryContact::create([
        'first_name' => 'A',
        'contact_type' => 'supplier',
        'owner_id' => $this->admin->id,
    ]);

    $priceRequest = PriceRequest::create([
        'title' => 'Door hardware',
        'owner_id' => $this->admin->id,
        'currency' => 'USD',
        'status' => 'open',
    ]);

    $requestedItem = PriceRequestItem::create([
        'price_request_id' => $priceRequest->id,
        'description' => 'Hinges',
        'quantity' => 10,
        'unit_of_measure' => 'each',
    ]);

    $inquiry = $contact->inquiries()->create([
        'price_request_id' => $priceRequest->id,
        'title' => 'Hinges',
        'priority' => 'normal',
        'status' => 'open',
        'created_by' => $this->admin->id,
    ]);

    $quote = $inquiry->supplierQuotes()->create([
        'revision_number' => 1,
        'is_current_revision' => true,
        'currency' => 'USD',
        'grand_total' => '100.00',
        'created_by' => $this->admin->id,
    ]);

    // Wrong quantity and unit.
    $quote->items()->create([
        'price_request_item_id' => $requestedItem->id,
        'description' => 'Hinges',
        'quantity' => 5,
        'unit_of_measure' => 'box',
        'unit_price' => '20.00',
        'line_total' => '100.00',
    ]);

    actingAs($this->admin)
        ->get(route('contact-directory.price-requests.compare-quotes', $priceRequest->uuid))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('ContactDirectory/PriceRequests/CompareQuotes')
            ->where('comparisons.0.is_comparable', false));

    // Remove the linked item entirely.
    $quote->items()->delete();

    $quote->items()->create([
        'description' => 'Unrelated item',
        'quantity' => 1,
        'unit_of_measure' => 'each',
        'unit_price' => '100.00',
        'line_total' => '100.00',
    ]);

    actingAs($this->admin)
        ->get(route('contact-directory.price-requests.compare-quotes', $priceRequest->uuid))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('ContactDirectory/PriceRequests/CompareQuotes')
            ->where('comparisons.0.is_comparable', false));
});

it('keeps a preferred quote selection tied to the exact revision', function () {
    $contact = ContactDirectoryContact::create([
        'first_name' => 'A',
        'contact_type' => 'supplier',
        'owner_id' => $this->admin->id,
    ]);

    $priceRequest = PriceRequest::create([
        'title' => 'Door hardware',
        'owner_id' => $this->admin->id,
        'currency' => 'USD',
        'status' => 'open',
    ]);

    $inquiry = $priceRequest->inquiries()->create([
        'contact_id' => $contact->id,
        'title' => 'Hinges',
        'priority' => 'normal',
        'status' => 'open',
        'created_by' => $this->admin->id,
    ]);

    $quote = $inquiry->supplierQuotes()->create([
        'revision_number' => 1,
        'is_current_revision' => true,
        'currency' => 'USD',
        'grand_total' => '100.00',
        'created_by' => $this->admin->id,
    ]);

    actingAs($this->admin)
        ->postJson(route('contact-directory.price-requests.preferred-quote.store', $priceRequest->uuid), [
            'supplier_quote_id' => $quote->id,
            'selection_reason' => 'Best lead time.',
        ])
        ->assertRedirect();

    expect($priceRequest->preferredQuoteSelection->supplier_quote_id)->toBe($quote->id);

    // A newer revision arrives.
    $inquiry->supplierQuotes()->create([
        'revision_number' => 2,
        'is_current_revision' => true,
        'currency' => 'USD',
        'grand_total' => '90.00',
        'created_by' => $this->admin->id,
    ]);

    $quote->update(['is_current_revision' => false]);

    actingAs($this->admin)
        ->get(route('contact-directory.price-requests.compare-quotes', $priceRequest->uuid))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('ContactDirectory/PriceRequests/CompareQuotes')
            ->where('hasNewerRevisionThanSelection', true));

    // The stored decision still points at revision 1.
    expect($priceRequest->preferredQuoteSelection->supplierQuote->revision_number)->toBe(1);
});

it('renders only allowlisted placeholders and reports unresolved ones', function () {
    $contact = ContactDirectoryContact::create([
        'first_name' => 'Ricardo',
        'contact_type' => 'supplier',
        'owner_id' => $this->admin->id,
    ]);

    $template = \App\Models\ContactDirectory\EmailTemplate::create([
        'name' => 'Initial pricing request',
        'category' => 'initial_pricing_request',
        'subject' => 'Pricing request: {{price_request_title}}',
        'body' => "Hi {{contact_first_name}},\n\nPlease quote {{inquiry_title}}.\n\n{{current_user_name}}",
        'owner_id' => $this->admin->id,
        'visibility' => 'organization',
        'is_active' => true,
    ]);

    $renderer = app(\App\Services\ContactDirectory\EmailTemplateRenderer::class);

    $rendered = $renderer->render($template, [
        'price_request_title' => 'Door hardware',
        'contact_first_name' => 'Ricardo',
        'inquiry_title' => 'Hinges',
        'current_user_name' => $this->admin->name,
    ]);

    expect($rendered['subject'])->toBe('Pricing request: Door hardware');
    expect($rendered['body'])->toContain('Hi Ricardo,');
    expect($rendered['unresolved'])->toBeEmpty();

    $missing = $renderer->render($template, [
        'price_request_title' => 'Door hardware',
    ]);

    expect($missing['unresolved'])->toContain('contact_first_name');
    expect($missing['unresolved'])->toContain('inquiry_title');
    expect($missing['unresolved'])->toContain('current_user_name');

    // Code-like syntax is never evaluated.
    $unsafe = \App\Models\ContactDirectory\EmailTemplate::create([
        'name' => 'Unsafe template',
        'category' => 'general',
        'subject' => '{{ 1 + 1 }}',
        'body' => '<?php echo "should not run"; ?>',
        'owner_id' => $this->admin->id,
        'visibility' => 'organization',
        'is_active' => true,
    ]);

    $renderedUnsafe = $renderer->render($unsafe, []);

    expect($renderedUnsafe['subject'])->toBe('{{ 1 + 1 }}');
    expect($renderedUnsafe['body'])->toContain('<?php');
});

it('preserves the original sent email content when a template later changes', function () {
    $contact = ContactDirectoryContact::create([
        'first_name' => 'Ricardo',
        'contact_type' => 'supplier',
        'owner_id' => $this->admin->id,
    ]);

    $contact->emailAddresses()->create([
        'email_address' => 'ricardo@acme.com',
        'label' => 'main',
        'is_primary' => true,
    ]);

    $contact->refresh();

    $template = \App\Models\ContactDirectory\EmailTemplate::create([
        'name' => 'Follow-up',
        'category' => 'follow_up_no_response',
        'subject' => 'Following up',
        'body' => 'Original body',
        'owner_id' => $this->admin->id,
        'visibility' => 'organization',
        'is_active' => true,
    ]);

    $renderer = app(\App\Services\ContactDirectory\EmailTemplateRenderer::class);
    $rendered = $renderer->render($template, []);

    $activity = $contact->activities()->create([
        'activity_type' => 'email',
        'direction' => 'outgoing',
        'subject' => $rendered['subject'],
        'content' => $rendered['body'],
        'occurred_at' => now(),
        'created_by' => $this->admin->id,
        'mail_provider_status' => 'logged_manually',
        'mail_delivered' => false,
    ]);

    $template->update(['body' => 'Edited body']);

    expect($activity->fresh()->content)->toBe('Original body');
});

it('updates waiting responsibility separately from inquiry status', function () {
    $contact = ContactDirectoryContact::create([
        'first_name' => 'Ricardo',
        'contact_type' => 'supplier',
        'owner_id' => $this->admin->id,
    ]);

    $inquiry = $contact->inquiries()->create([
        'title' => 'Hinges',
        'priority' => 'normal',
        'status' => 'open',
        'created_by' => $this->admin->id,
    ]);

    actingAs($this->admin)
        ->patchJson(route('contact-directory.inquiries.waiting-on.update', $inquiry->uuid), [
            'waiting_on' => 'internal_team',
            'waiting_on_user_id' => $this->admin->id,
            'expected_response_date' => now()->addDays(3)->toDateString(),
            'waiting_explanation' => 'Needs internal approval.',
        ])
        ->assertRedirect();

    expect($inquiry->fresh()->waiting_on)->toBe('internal_team');
    expect($inquiry->fresh()->waiting_on_user_id)->toBe($this->admin->id);
    expect($inquiry->fresh()->status)->toBe('open');

    // An overdue expected response does not change the status.
    $inquiry->update(['expected_response_date' => now()->subDays(2)]);

    expect($inquiry->fresh()->status)->toBe('open');
    expect($inquiry->fresh()->waiting_on)->toBe('internal_team');
});

it('suggests follow-ups for open inquiries with no pending tasks and excludes closed ones', function () {
    $contact = ContactDirectoryContact::create([
        'first_name' => 'Ricardo',
        'contact_type' => 'supplier',
        'owner_id' => $this->admin->id,
    ]);

    $openInquiry = $contact->inquiries()->create([
        'title' => 'Open inquiry',
        'priority' => 'normal',
        'status' => 'open',
        'created_by' => $this->admin->id,
    ]);

    $closedInquiry = $contact->inquiries()->create([
        'title' => 'Closed inquiry',
        'priority' => 'normal',
        'status' => 'closed',
        'closed_at' => now(),
        'created_by' => $this->admin->id,
    ]);

    $service = app(NeedsAttentionService::class);

    $suggestions = collect($service->suggestionsForUser($this->admin));

    expect(
        $suggestions->where('inquiry_id', $openInquiry->id)
            ->where('reason', 'No follow-up is scheduled for this open inquiry.')
            ->count(),
    )->toBe(1);

    expect($suggestions->where('inquiry_id', $closedInquiry->id))->toBeEmpty();

    // Deduplicate repeated suggestions.
    expect(
        $suggestions->where('inquiry_id', $openInquiry->id)
            ->where('reason', 'No follow-up is scheduled for this open inquiry.')
            ->count(),
    )->toBe(1);
});
