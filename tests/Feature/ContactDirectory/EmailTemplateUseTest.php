<?php

use App\Models\ContactDirectory\ContactDirectoryContact;
use App\Models\ContactDirectory\ContactEmailAddress;
use App\Models\ContactDirectory\EmailTemplate;
use App\Models\User;
use App\Models\UserLevel;
use App\Services\ContactDirectory\EmailTemplateRenderer;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    $level = UserLevel::firstOrCreate(
        ['name' => UserLevel::SUPER_ADMIN],
        ['permissions' => [], 'mobile_permissions' => []],
    );
    $this->admin = User::factory()->create([
        'level_id' => $level->id,
        'microsoft_mailbox' => 'ricardo@gateway-ds.com',
    ]);
});

function templateFor(User $owner, array $overrides = []): EmailTemplate
{
    return EmailTemplate::create([
        'name' => 'Hello',
        'category' => 'general',
        'subject' => 'Hi {{contact_first_name}}',
        'body' => '<p>Hello {{contact_first_name}}</p>',
        'is_active' => true,
        'owner_id' => $owner->id,
        'visibility' => 'organization',
        ...$overrides,
    ]);
}

it('only offers active shared templates and the user\'s own private ones', function () {
    $other = User::factory()->create();
    templateFor($other, ['name' => 'Shared']);
    templateFor($other, ['name' => 'Others private', 'visibility' => 'private']);
    templateFor($this->admin, ['name' => 'Mine private', 'visibility' => 'private']);
    templateFor($other, ['name' => 'Off', 'is_active' => false]);

    $names = EmailTemplate::query()->availableTo($this->admin)->pluck('name')->all();

    expect($names)->toContain('Shared', 'Mine private')
        ->not->toContain('Others private', 'Off');
});

it('turns legacy plain-text templates into html and escapes substituted values', function () {
    $renderer = app(EmailTemplateRenderer::class);

    expect($renderer->toHtml("Hi\nthere & more"))->toBe("Hi<br />\nthere &amp; more")
        ->and($renderer->toHtml('<p>Hi</p>'))->toBe('<p>Hi</p>');

    $rendered = $renderer->render(
        templateFor($this->admin, ['body' => '<p>{{contact_first_name}}</p>']),
        ['contact_first_name' => '<script>x</script>'],
    );

    expect($rendered['body'])->toBe('<p>&lt;script&gt;x&lt;/script&gt;</p>');
});

it('strips active content when a template is saved', function () {
    $this->actingAs($this->admin)->post(route('contact-directory.email-templates.store'), [
        'name' => 'Safe',
        'category' => 'general',
        'subject' => 'Subject',
        'body' => '<p onclick="x()">Hi</p><script>alert(1)</script>',
        'visibility' => 'organization',
        'is_active' => true,
    ])->assertSessionHasNoErrors();

    $body = EmailTemplate::where('name', 'Safe')->value('body');

    expect($body)->toBe('<p>Hi</p>');
});

it('lets a manager edit-toggle and delete templates, but not others\' private ones', function () {
    $template = templateFor($this->admin);

    $this->actingAs($this->admin)
        ->delete(route('contact-directory.email-templates.destroy', $template))
        ->assertSessionHas('success');

    expect(EmailTemplate::find($template->id))->toBeNull();

    $private = templateFor(User::factory()->create(), ['visibility' => 'private']);

    $this->actingAs($this->admin)
        ->delete(route('contact-directory.email-templates.destroy', $private))
        ->assertForbidden();
});

it('sends a contact email from the user\'s own mailbox and refuses leftover placeholders', function () {
    Cache::flush();
    config([
        'services.microsoft.tenant_id' => 't',
        'services.microsoft.client_id' => 'c',
        'services.microsoft.client_secret' => 's',
        'services.microsoft.mail_from' => 'shared@gateway-ds.com',
    ]);

    $sentPaths = [];
    Http::fake(function ($request) use (&$sentPaths) {
        if (str_contains($request->url(), 'login.microsoftonline.com')) {
            return Http::response(['access_token' => 'tok', 'expires_in' => 3600]);
        }

        $path = rawurldecode((string) parse_url($request->url(), PHP_URL_PATH));

        if (str_ends_with($path, '/sendMail')) {
            $sentPaths[] = $path;

            return Http::response('', 202);
        }

        return Http::response('unexpected', 500);
    });

    $contact = ContactDirectoryContact::create(['first_name' => 'Pat', 'last_name' => 'Lee', 'owner_id' => $this->admin->id]);
    ContactEmailAddress::create([
        'contact_id' => $contact->id,
        'email_address' => 'pat@example.com',
        'label' => 'work',
        'is_primary' => true,
    ]);

    $this->actingAs($this->admin)
        ->post(route('contact-directory.contacts.email.send', $contact), [
            'recipients' => ['pat@example.com'],
            'subject' => 'Hi {{contact_first_name}}',
            'body' => '<p>Hello</p>',
        ])
        ->assertSessionHasErrors('body');

    expect($sentPaths)->toBe([]);

    $this->actingAs($this->admin)
        ->post(route('contact-directory.contacts.email.send', $contact), [
            'recipients' => ['pat@example.com'],
            'subject' => 'Hi Pat',
            'body' => '<p>Hello Pat</p>',
        ])
        ->assertSessionHasNoErrors();

    expect($sentPaths)->toHaveCount(1)
        ->and($sentPaths[0])->toContain('ricardo@gateway-ds.com')
        ->and($sentPaths[0])->not->toContain('shared@gateway-ds.com');
});

it('prefills the composer from the contact and saves a template only when asked', function () {
    Cache::flush();
    config([
        'services.microsoft.tenant_id' => 't', 'services.microsoft.client_id' => 'c',
        'services.microsoft.client_secret' => 's', 'services.microsoft.mail_from' => 'shared@gateway-ds.com',
    ]);
    Http::fake(function ($request) {
        if (str_contains($request->url(), 'login.microsoftonline.com')) {
            return Http::response(['access_token' => 'tok', 'expires_in' => 3600]);
        }

        return Http::response('', 202);
    });

    $contact = ContactDirectoryContact::create(['first_name' => 'Pat', 'last_name' => 'Lee', 'owner_id' => $this->admin->id]);
    ContactEmailAddress::create(['contact_id' => $contact->id, 'email_address' => 'pat@example.com', 'label' => 'work', 'is_primary' => false]);
    \App\Models\ContactDirectory\ContactFollowUp::create([
        'contact_id' => $contact->id, 'title' => 'Revised pricing', 'assigned_user_id' => $this->admin->id,
        'created_by' => $this->admin->id, 'due_at' => now()->addDay(), 'priority' => 'normal', 'status' => 'pending',
    ]);

    $this->actingAs($this->admin)
        ->get(route('contact-directory.contacts.email.compose', [$contact, 'recipient' => 'pat@example.com']))
        ->assertInertia(fn ($page) => $page->where('recipient', 'pat@example.com')->has('tasks', 1)->where('tasks.0.title', 'Revised pricing'));

    $before = EmailTemplate::count();
    $this->actingAs($this->admin)->post(route('contact-directory.contacts.email.send', $contact), [
        'recipients' => ['pat@example.com'], 'subject' => 'One', 'body' => '<p>One</p>',
    ])->assertSessionHasNoErrors();
    expect(EmailTemplate::count())->toBe($before);

    $this->actingAs($this->admin)->post(route('contact-directory.contacts.email.send', $contact), [
        'recipients' => ['pat@example.com'], 'subject' => 'Two', 'body' => '<p>Two</p>',
        'save_as_template' => true, 'template_name' => 'My follow-up',
    ])->assertSessionHasNoErrors();
    expect(EmailTemplate::where('name', 'My follow-up')->where('visibility', 'private')->where('owner_id', $this->admin->id)->exists())->toBeTrue();
});
