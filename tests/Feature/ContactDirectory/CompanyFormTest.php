<?php

use App\Models\ContactDirectory\ContactCompany;
use App\Models\ContactDirectory\ContactDirectoryContact;
use App\Models\User;
use App\Models\UserLevel;

use function Pest\Laravel\actingAs;

beforeEach(function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $this->admin = User::factory()->create(['level_id' => $level->id]);
    $this->payload = [
        'name' => 'Gateway supplier', 'website' => 'https://example.com',
        'address_line_1' => '123 Main Street', 'city' => 'Stroudsburg',
        'state' => 'PA', 'postal_code' => '18360', 'country' => 'United States',
        'notes' => 'Keep these company notes', 'is_active' => true,
        'phone_numbers' => [
            ['phone_number' => '(570) 555-0100', 'country' => 'US', 'label' => 'Office', 'extension' => '12', 'is_primary' => false],
            ['phone_number' => '(416) 555-0199', 'country' => 'CA', 'label' => 'Sales', 'is_primary' => true],
        ],
        'email_addresses' => [
            ['email_address' => ' OFFICE@example.com ', 'label' => 'Office', 'is_primary' => false],
            ['email_address' => 'accounts@example.com', 'label' => 'Billing', 'is_primary' => true],
        ],
    ];
});

it('opens standard company add and edit pages with loaded methods', function () {
    actingAs($this->admin)->get(route('contact-directory.companies.create'))->assertOk()
        ->assertInertia(fn ($page) => $page->component('ContactDirectory/Companies/Form')->where('company', null));
    $company = ContactCompany::create(['name' => 'Existing company']);
    actingAs($this->admin)->get(route('contact-directory.companies.edit', $company))->assertOk()
        ->assertInertia(fn ($page) => $page->component('ContactDirectory/Companies/Form')
            ->where('company.id', $company->id)->has('company.phone_numbers')->has('company.email_addresses'));
});

it('creates company methods with countries extensions and exactly the selected primaries', function () {
    actingAs($this->admin)->post(route('contact-directory.companies.store'), $this->payload)->assertSessionHasNoErrors()->assertRedirect();
    $company = ContactCompany::sole();
    expect($company->phoneNumbers)->toHaveCount(2)
        ->and($company->emailAddresses)->toHaveCount(2)
        ->and($company->phoneNumbers->where('is_primary', true))->toHaveCount(1)
        ->and($company->emailAddresses->where('is_primary', true))->toHaveCount(1)
        ->and($company->primaryPhone->phone_number)->toBe('+14165550199')
        ->and($company->primaryPhone->country)->toBe('CA')
        ->and($company->primaryEmail->email_address)->toBe('accounts@example.com')
        ->and($company->phoneNumbers->first()->extension)->toBe('12')
        ->and($company->emailAddresses->first()->email_address)->toBe('office@example.com')
        ->and($company->address_line_1)->toBe('123 Main Street');
});

it('updates rows in place without altering linked contacts or activity', function () {
    actingAs($this->admin)->post(route('contact-directory.companies.store'), $this->payload);
    $company = ContactCompany::sole();
    $contact = ContactDirectoryContact::create(['first_name' => 'Linked person', 'company_id' => $company->id, 'contact_type' => 'supplier', 'owner_id' => $this->admin->id]);
    $contactPhone = $contact->phoneNumbers()->create(['phone_number' => '+15705550111', 'is_primary' => true]);
    $activity = $contact->activities()->create(['activity_type' => 'note', 'direction' => 'internal', 'created_by' => $this->admin->id, 'subject' => 'Keep history', 'occurred_at' => now()]);
    $phones = $company->phoneNumbers->map(fn ($phone, $index) => [...$phone->only(['id', 'phone_number', 'country', 'label', 'extension']), 'is_primary' => $index === 0])->all();
    $emails = $company->emailAddresses->map(fn ($email, $index) => [...$email->only(['id', 'email_address', 'label']), 'is_primary' => $index === 0])->all();
    $phones[0]['extension'] = '24';
    actingAs($this->admin)->patch(route('contact-directory.companies.update', $company), [
        ...$this->payload, 'name' => 'Updated company', 'phone_numbers' => $phones, 'email_addresses' => $emails,
    ])->assertSessionHasNoErrors()->assertRedirect(route('contact-directory.companies.show', $company));
    $company->refresh();
    expect($company->phoneNumbers->pluck('id')->all())->toBe(array_column($phones, 'id'))
        ->and($company->emailAddresses->pluck('id')->all())->toBe(array_column($emails, 'id'))
        ->and($company->primaryPhone->id)->toBe($phones[0]['id'])
        ->and($company->primaryPhone->extension)->toBe('24')
        ->and($company->primaryEmail->id)->toBe($emails[0]['id'])
        ->and($contact->fresh()->company_id)->toBe($company->id)
        ->and($contact->phoneNumbers()->sole()->id)->toBe($contactPhone->id)
        ->and($contact->activities()->sole()->id)->toBe($activity->id);
});

it('supports primary removal fallback and clearing all company methods', function () {
    actingAs($this->admin)->post(route('contact-directory.companies.store'), $this->payload);
    $company = ContactCompany::sole();
    $phone = $company->phoneNumbers()->where('is_primary', false)->first();
    $email = $company->emailAddresses()->where('is_primary', false)->first();
    actingAs($this->admin)->patch(route('contact-directory.companies.update', $company), [
        'name' => $company->name, 'phone_numbers' => [$phone->only(['id', 'country', 'phone_number', 'is_primary'])],
        'email_addresses' => [$email->only(['id', 'email_address', 'is_primary'])],
    ])->assertSessionHasNoErrors();
    expect($company->fresh()->primaryPhone->id)->toBe($phone->id)
        ->and($company->fresh()->primaryEmail->id)->toBe($email->id);
    actingAs($this->admin)->patch(route('contact-directory.companies.update', $company), [
        'name' => $company->name, 'phone_numbers' => [], 'email_addresses' => [],
    ])->assertSessionHasNoErrors();
    expect($company->fresh()->phoneNumbers)->toHaveCount(0)
        ->and($company->fresh()->emailAddresses)->toHaveCount(0)
        ->and($company->fresh()->primaryPhone)->toBeNull()
        ->and($company->fresh()->primaryEmail)->toBeNull();
});

it('preserves company methods when an older metadata-only client omits the arrays', function () {
    actingAs($this->admin)->post(route('contact-directory.companies.store'), $this->payload);
    $company = ContactCompany::sole();
    $ids = $company->phoneNumbers->pluck('id')->all();
    actingAs($this->admin)->patch(route('contact-directory.companies.update', $company), ['name' => 'Metadata only'])
        ->assertSessionHasNoErrors();
    expect($company->fresh()->phoneNumbers->pluck('id')->all())->toBe($ids)
        ->and($company->fresh()->emailAddresses)->toHaveCount(2)
        ->and($company->fresh()->notes)->toBe('Keep these company notes');
});

it('keeps complete national numbers for countries whose configured length excludes the trunk zero', function (string $country, string $national, string $canonical) {
    actingAs($this->admin)->post(route('contact-directory.companies.store'), [
        'name' => 'International company',
        'phone_numbers' => [['phone_number' => $national, 'country' => $country]],
    ])->assertSessionHasNoErrors();
    $company = ContactCompany::sole();
    expect($company->primaryPhone->phone_number)->toBe($canonical);
    actingAs($this->admin)->patch(route('contact-directory.companies.update', $company), [
        'name' => $company->name,
        'phone_numbers' => [['id' => $company->primaryPhone->id, 'phone_number' => $canonical, 'country' => $country]],
    ])->assertSessionHasNoErrors();
    expect($company->fresh()->primaryPhone->phone_number)->toBe($canonical);
})->with([
    'France' => ['FR', '612345678', '+33612345678'],
    'Australia' => ['AU', '412345678', '+61412345678'],
]);

it('allows swapping unique company method values without recreating their rows', function () {
    actingAs($this->admin)->post(route('contact-directory.companies.store'), $this->payload);
    $company = ContactCompany::sole();
    $phones = $company->phoneNumbers->map->only(['id', 'phone_number', 'country', 'is_primary'])->all();
    $emails = $company->emailAddresses->map->only(['id', 'email_address', 'is_primary'])->all();
    [$phones[0]['phone_number'], $phones[1]['phone_number']] = [$phones[1]['phone_number'], $phones[0]['phone_number']];
    [$emails[0]['email_address'], $emails[1]['email_address']] = [$emails[1]['email_address'], $emails[0]['email_address']];
    actingAs($this->admin)->patch(route('contact-directory.companies.update', $company), [
        'name' => $company->name, 'phone_numbers' => $phones, 'email_addresses' => $emails,
    ])->assertSessionHasNoErrors();
    expect($company->fresh()->phoneNumbers->pluck('id')->all())->toBe(array_column($phones, 'id'))
        ->and($company->fresh()->phoneNumbers->first()->phone_number)->toBe('+14165550199')
        ->and($company->fresh()->emailAddresses->first()->email_address)->toBe('accounts@example.com');
});

it('rejects another companys child IDs and duplicate IDs without modifying either company', function () {
    actingAs($this->admin)->post(route('contact-directory.companies.store'), $this->payload);
    $owner = ContactCompany::sole();
    $other = ContactCompany::create(['name' => 'Other company']);
    $phone = $owner->phoneNumbers->first()->only(['id', 'phone_number', 'country', 'is_primary']);
    $email = $owner->emailAddresses->first()->only(['id', 'email_address', 'is_primary']);
    actingAs($this->admin)->patchJson(route('contact-directory.companies.update', $other), [
        'name' => 'Do not apply', 'phone_numbers' => [$phone], 'email_addresses' => [$email],
    ])->assertUnprocessable()->assertJsonValidationErrors(['phone_numbers.0.id', 'email_addresses.0.id']);
    $duplicate = [...$phone, 'phone_number' => '(570) 555-0144'];
    actingAs($this->admin)->patchJson(route('contact-directory.companies.update', $owner), [
        'name' => $owner->name, 'phone_numbers' => [$phone, $duplicate],
    ])->assertUnprocessable()->assertJsonValidationErrors('phone_numbers.0.id');
    expect($owner->fresh()->phoneNumbers)->toHaveCount(2)
        ->and($other->fresh()->name)->toBe('Other company')
        ->and($other->fresh()->phoneNumbers)->toHaveCount(0);
});

it('validates company contact method inputs without creating a partial company', function ($phones, $emails, $field) {
    actingAs($this->admin)->postJson(route('contact-directory.companies.store'), [
        ...$this->payload, 'phone_numbers' => $phones, 'email_addresses' => $emails,
    ])->assertUnprocessable()->assertJsonValidationErrors($field);
    expect(ContactCompany::count())->toBe(0);
})->with([
    'incomplete phone' => [[['country' => 'US', 'phone_number' => '123']], [], 'phone_numbers.0.phone_number'],
    'wrong dial prefix' => [[['country' => 'US', 'phone_number' => '+44 7700 900123']], [], 'phone_numbers.0.phone_number'],
    'unsupported country' => [[['country' => 'ZZ', 'phone_number' => '5705550100']], [], 'phone_numbers.0.country'],
    'invalid extension' => [[['country' => 'US', 'phone_number' => '5705550100', 'extension' => 'ABC']], [], 'phone_numbers.0.extension'],
    'duplicate phones' => [[['country' => 'US', 'phone_number' => '(570) 555-0100'], ['country' => 'US', 'phone_number' => '+15705550100']], [], 'phone_numbers.1.phone_number'],
    'two primary phones' => [[['country' => 'US', 'phone_number' => '5705550100', 'is_primary' => true], ['country' => 'US', 'phone_number' => '5705550101', 'is_primary' => true]], [], 'phone_numbers'],
    'two primary emails' => [[], [['email_address' => 'one@example.com', 'is_primary' => true], ['email_address' => 'two@example.com', 'is_primary' => true]], 'email_addresses'],
    'invalid email' => [[], [['email_address' => 'not an email']], 'email_addresses.0.email_address'],
    'duplicate emails' => [[], [['email_address' => ' OFFICE@example.com '], ['email_address' => 'office@example.com']], 'email_addresses.1.email_address'],
    'too many phones' => [array_fill(0, 11, ['country' => 'US', 'phone_number' => '5705550100']), [], 'phone_numbers'],
    'too many emails' => [[], array_fill(0, 11, ['email_address' => 'office@example.com']), 'email_addresses'],
    'malformed phone row' => [['not-an-array'], [], 'phone_numbers.0'],
    'malformed email row' => [[], ['not-an-array'], 'email_addresses.0'],
    'child ID on create' => [[['id' => 12, 'country' => 'US', 'phone_number' => '5705550100']], [], 'phone_numbers.0.id'],
]);

it('normalizes national international phones and falls back to the first primary', function () {
    actingAs($this->admin)->post(route('contact-directory.companies.store'), [
        'name' => 'International company',
        'phone_numbers' => [['country' => 'gb', 'phone_number' => '07700900123']],
        'email_addresses' => [['email_address' => ' OFFICE@example.com ']],
    ])->assertSessionHasNoErrors();
    $company = ContactCompany::sole();
    expect($company->primaryPhone->phone_number)->toBe('+447700900123')
        ->and($company->primaryPhone->country)->toBe('GB')
        ->and($company->primaryEmail->email_address)->toBe('office@example.com');
});

it('finds companies by their own methods and resets active filtering correctly', function () {
    actingAs($this->admin)->post(route('contact-directory.companies.store'), $this->payload);
    $company = ContactCompany::sole();
    ContactCompany::create(['name' => 'Inactive company', 'is_active' => false]);
    foreach (['+14165550199', 'accounts@example.com'] as $search) {
        actingAs($this->admin)->get(route('contact-directory.companies.index', ['search' => $search]))
            ->assertOk()->assertInertia(fn ($page) => $page->has('companies.data', 1)
            ->where('companies.data.0.id', $company->id)
            ->where('companies.data.0.primary_phone.country', 'CA')
            ->where('companies.data.0.primary_email.email_address', 'accounts@example.com'));
    }
    actingAs($this->admin)->get(route('contact-directory.companies.index', ['is_active' => '']))
        ->assertOk()->assertInertia(fn ($page) => $page->has('companies.data', 2));
    actingAs($this->admin)->get(route('contact-directory.companies.index', ['is_active' => '0']))
        ->assertOk()->assertInertia(fn ($page) => $page->has('companies.data', 1)->where('companies.data.0.is_active', false));
});

it('keeps existing company methods during a migration retry', function () {
    actingAs($this->admin)->post(route('contact-directory.companies.store'), $this->payload);
    $company = ContactCompany::sole();
    $phoneIds = $company->phoneNumbers->pluck('id')->all();
    $migration = require database_path('migrations/2026_11_03_010000_create_contact_company_contact_methods.php');
    $migration->up();
    $migration->up();
    expect(ContactCompany::count())->toBe(1)
        ->and($company->fresh()->phoneNumbers->pluck('id')->all())->toBe($phoneIds)
        ->and($company->fresh()->emailAddresses)->toHaveCount(2);
});

it('denies company create and edit endpoints to read-only users', function () {
    $level = UserLevel::create(['name' => 'Company reader', 'permissions' => ['view-contacts-directory' => true]]);
    $reader = User::factory()->create(['level_id' => $level->id]);
    $company = ContactCompany::create(['name' => 'Read-only company']);
    actingAs($reader)->get(route('contact-directory.companies.create'))->assertForbidden();
    actingAs($reader)->get(route('contact-directory.companies.edit', $company))->assertForbidden();
    actingAs($reader)->post(route('contact-directory.companies.store'), $this->payload)->assertForbidden();
    actingAs($reader)->patch(route('contact-directory.companies.update', $company), ['name' => 'Not allowed'])->assertForbidden();
    actingAs($reader)->get(route('contact-directory.companies.show', $company))->assertOk()
        ->assertInertia(fn ($page) => $page->has('company.phone_numbers')->has('company.email_addresses'));
});
