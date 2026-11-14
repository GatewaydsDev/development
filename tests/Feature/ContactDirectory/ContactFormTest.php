<?php

use App\Models\ContactDirectory\ContactDirectoryContact;
use App\Models\User;
use App\Models\UserLevel;

use function Pest\Laravel\actingAs;

beforeEach(function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $this->admin = User::factory()->create(['level_id' => $level->id]);
    $this->payload = [
        'first_name' => 'Contact editor',
        'contact_type' => 'supplier',
        'owner_id' => $this->admin->id,
        'phone_numbers' => [
            ['phone_number' => '(570) 555-0100', 'country' => 'US', 'label' => 'office', 'extension' => '12', 'is_primary' => false],
            ['phone_number' => '(416) 555-0199', 'country' => 'CA', 'label' => 'mobile', 'is_primary' => true],
        ],
        'email_addresses' => [
            ['email_address' => ' OFFICE@example.com ', 'label' => 'office', 'is_primary' => false],
            ['email_address' => 'accounts@example.com', 'label' => 'billing', 'is_primary' => true],
        ],
    ];
});

it('serves the existing-style add and edit form pages', function () {
    actingAs($this->admin)->get(route('contact-directory.contacts.create'))->assertOk()
        ->assertInertia(fn ($page) => $page->component('ContactDirectory/Contacts/Form')->where('contact', null)->has('users')->has('companies'));
    $contact = ContactDirectoryContact::create(['first_name' => 'Editor', 'contact_type' => 'supplier', 'owner_id' => $this->admin->id]);
    actingAs($this->admin)->get(route('contact-directory.contacts.edit', $contact))->assertOk()
        ->assertInertia(fn ($page) => $page->component('ContactDirectory/Contacts/Form')->where('contact.id', $contact->id)->has('contact.phone_numbers')->has('contact.email_addresses'));
});

it('saves countries multiple child rows and exactly the selected second primary', function () {
    actingAs($this->admin)->post(route('contact-directory.contacts.store'), $this->payload)->assertSessionHasNoErrors()->assertRedirect();
    $contact = ContactDirectoryContact::sole();
    expect($contact->phoneNumbers)->toHaveCount(2)
        ->and($contact->emailAddresses)->toHaveCount(2)
        ->and($contact->phoneNumbers->where('is_primary', true))->toHaveCount(1)
        ->and($contact->emailAddresses->where('is_primary', true))->toHaveCount(1)
        ->and($contact->primaryPhone->country)->toBe('CA')
        ->and($contact->primaryPhone->phone_number)->toBe('+14165550199')
        ->and($contact->primaryEmail->email_address)->toBe('accounts@example.com')
        ->and($contact->emailAddresses->first()->email_address)->toBe('office@example.com')
        ->and($contact->phoneNumbers->first()->extension)->toBe('12');
});

it('updates children in place and persists changing the primary entry', function () {
    actingAs($this->admin)->post(route('contact-directory.contacts.store'), $this->payload)->assertSessionHasNoErrors();
    $contact = ContactDirectoryContact::sole();
    $phones = $contact->phoneNumbers->map(fn ($phone, $index) => [...$phone->only(['id', 'country', 'phone_number', 'label', 'extension']), 'is_primary' => $index === 0])->all();
    $emails = $contact->emailAddresses->map(fn ($email, $index) => [...$email->only(['id', 'email_address', 'label']), 'is_primary' => $index === 0])->all();
    $phones[0]['extension'] = '24';
    actingAs($this->admin)->patch(route('contact-directory.contacts.update', $contact), [
        ...$this->payload, 'phone_numbers' => $phones, 'email_addresses' => $emails,
    ])->assertSessionHasNoErrors()->assertRedirect(route('contact-directory.contacts.show', $contact));
    expect($contact->fresh()->phoneNumbers->pluck('id')->all())->toBe(array_column($phones, 'id'))
        ->and($contact->fresh()->emailAddresses->pluck('id')->all())->toBe(array_column($emails, 'id'))
        ->and($contact->fresh()->primaryPhone->id)->toBe($phones[0]['id'])
        ->and($contact->fresh()->primaryPhone->extension)->toBe('24')
        ->and($contact->fresh()->primaryEmail->id)->toBe($emails[0]['id']);
});

it('allows deleting a primary and choosing a remaining entry as fallback', function () {
    actingAs($this->admin)->post(route('contact-directory.contacts.store'), $this->payload);
    $contact = ContactDirectoryContact::sole();
    $phone = $contact->phoneNumbers()->where('is_primary', false)->first();
    $email = $contact->emailAddresses()->where('is_primary', false)->first();
    actingAs($this->admin)->patch(route('contact-directory.contacts.update', $contact), [
        ...$this->payload,
        'phone_numbers' => [$phone->only(['id', 'country', 'phone_number', 'is_primary'])],
        'email_addresses' => [$email->only(['id', 'email_address', 'is_primary'])],
    ])->assertSessionHasNoErrors();
    expect($contact->fresh()->phoneNumbers)->toHaveCount(1)
        ->and($contact->fresh()->emailAddresses)->toHaveCount(1)
        ->and($contact->fresh()->primaryPhone->id)->toBe($phone->id)
        ->and($contact->fresh()->primaryEmail->id)->toBe($email->id);
});

it('can swap unique phone and email values without recreating rows', function () {
    actingAs($this->admin)->post(route('contact-directory.contacts.store'), $this->payload);
    $contact = ContactDirectoryContact::sole();
    $phones = $contact->phoneNumbers->map->only(['id', 'phone_number', 'country', 'is_primary'])->all();
    $emails = $contact->emailAddresses->map->only(['id', 'email_address', 'is_primary'])->all();
    [$phones[0]['phone_number'], $phones[1]['phone_number']] = [$phones[1]['phone_number'], $phones[0]['phone_number']];
    [$emails[0]['email_address'], $emails[1]['email_address']] = [$emails[1]['email_address'], $emails[0]['email_address']];
    actingAs($this->admin)->patch(route('contact-directory.contacts.update', $contact), [
        ...$this->payload, 'phone_numbers' => $phones, 'email_addresses' => $emails,
    ])->assertSessionHasNoErrors();
    expect($contact->fresh()->phoneNumbers->first()->phone_number)->toBe('+14165550199')
        ->and($contact->fresh()->emailAddresses->first()->email_address)->toBe('accounts@example.com');
});

it('preserves legacy phone values and related records on an edit', function () {
    $contact = ContactDirectoryContact::create(['first_name' => 'Legacy', 'contact_type' => 'supplier', 'owner_id' => $this->admin->id]);
    $phone = $contact->phoneNumbers()->create(['phone_number' => '+971 50 123 4567', 'label' => 'overseas', 'is_primary' => true]);
    $activity = $contact->activities()->create(['activity_type' => 'note', 'direction' => 'internal', 'subject' => 'Existing history', 'created_by' => $this->admin->id, 'occurred_at' => now()]);
    actingAs($this->admin)->patch(route('contact-directory.contacts.update', $contact), [
        ...$this->payload, 'phone_numbers' => [$phone->only(['id', 'phone_number', 'country', 'label', 'is_primary'])], 'email_addresses' => [],
    ])->assertSessionHasNoErrors();
    expect($phone->fresh()->phone_number)->toBe('+971 50 123 4567')
        ->and($phone->fresh()->country)->toBeNull()
        ->and($activity->fresh())->not->toBeNull();
});

it('validates controlled phone inputs', function (array $phone, string $field) {
    actingAs($this->admin)->postJson(route('contact-directory.contacts.store'), [
        ...$this->payload, 'phone_numbers' => [$phone],
    ])->assertUnprocessable()->assertJsonValidationErrors('phone_numbers.0.'.$field);
})->with([
    'incomplete' => [['phone_number' => '570', 'country' => 'US'], 'phone_number'],
    'country' => [['phone_number' => '5705550100', 'country' => 'XX'], 'country'],
    'mismatched prefix' => [['phone_number' => '+445705550100', 'country' => 'US'], 'phone_number'],
    'extension' => [['phone_number' => '5705550100', 'country' => 'US', 'extension' => 'abc'], 'extension'],
]);

it('normalizes a non-NANP phone using its selected calling code', function () {
    actingAs($this->admin)->post(route('contact-directory.contacts.store'), [
        ...$this->payload, 'phone_numbers' => [['phone_number' => '07700900123', 'country' => 'GB', 'is_primary' => true]],
    ])->assertSessionHasNoErrors();
    expect(ContactDirectoryContact::sole()->primaryPhone->phone_number)->toBe('+447700900123');
});

it('rejects duplicate phones despite formatting or a shared calling code', function () {
    actingAs($this->admin)->postJson(route('contact-directory.contacts.store'), [
        ...$this->payload,
        'phone_numbers' => [
            ['phone_number' => '(570) 555-0100', 'country' => 'US'],
            ['phone_number' => '+15705550100', 'country' => 'CA'],
        ],
    ])->assertUnprocessable()->assertJsonValidationErrors('phone_numbers.1.phone_number');
});

it('rejects duplicate emails regardless of case and multiple primary emails', function () {
    actingAs($this->admin)->postJson(route('contact-directory.contacts.store'), [
        ...$this->payload,
        'email_addresses' => [
            ['email_address' => 'OFFICE@example.com', 'is_primary' => true],
            ['email_address' => 'office@EXAMPLE.com', 'is_primary' => true],
        ],
    ])->assertUnprocessable()->assertJsonValidationErrors(['email_addresses', 'email_addresses.1.email_address']);
});

it('prevents editing another contacts child records', function () {
    actingAs($this->admin)->post(route('contact-directory.contacts.store'), $this->payload);
    $other = ContactDirectoryContact::sole();
    $contact = ContactDirectoryContact::create(['first_name' => 'Different', 'contact_type' => 'supplier', 'owner_id' => $this->admin->id]);
    actingAs($this->admin)->patchJson(route('contact-directory.contacts.update', $contact), [
        ...$this->payload,
        'phone_numbers' => [$other->phoneNumbers->first()->only(['id', 'country', 'phone_number'])],
        'email_addresses' => [$other->emailAddresses->first()->only(['id', 'email_address'])],
    ])->assertUnprocessable()->assertJsonValidationErrors(['phone_numbers.0.id', 'email_addresses.0.id']);
    expect($other->fresh()->phoneNumbers)->toHaveCount(2)->and($other->fresh()->emailAddresses)->toHaveCount(2);
});

it('denies add and edit pages to read-only users', function () {
    $level = UserLevel::create(['name' => 'Contact form reader', 'permissions' => ['view-contacts-directory' => true]]);
    $reader = User::factory()->create(['level_id' => $level->id]);
    $contact = ContactDirectoryContact::create(['first_name' => 'Private', 'contact_type' => 'supplier', 'owner_id' => $this->admin->id]);
    actingAs($reader)->get(route('contact-directory.contacts.create'))->assertForbidden();
    actingAs($reader)->get(route('contact-directory.contacts.edit', $contact))->assertForbidden();
});
