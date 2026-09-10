<?php

use App\Models\Contractor;
use App\Models\Customer;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\User;
use App\Models\UserLevel;
use Inertia\Testing\AssertableInertia as Assert;

function contractorAdmin(): User
{
    $level = UserLevel::firstOrCreate([
        'name' => UserLevel::SUPER_ADMIN,
    ]);

    return User::factory()->create([
        'level_id' => $level->id,
    ]);
}

function contractorPayload(array $overrides = []): array
{
    return [
        'name' => 'Turner Construction',
        'website' => 'https://turner.example',
        'address_line_1' => '100 Market Street',
        'address_line_2' => 'Suite 400',
        'city' => 'Newark',
        'state' => 'NJ',
        'postal_code' => '07102',
        'country' => 'United States',
        'notes' => 'Preferred GC for SCIF work.',
        'contacts' => [
            [
                'name' => 'Alex Rivera',
                'title' => 'Project manager',
                'email' => 'alex@turner.example',
                'phone_number' => '(973) 555-0100',
                'phone_type' => 'office',
                'notes' => 'Main point of contact',
                'is_primary' => true,
            ],
            [
                'name' => 'Jordan Lee',
                'title' => 'Estimator',
                'email' => 'jordan@turner.example',
                'phone_number' => '(973) 555-0199',
                'phone_type' => 'mobile',
                'notes' => '',
                'is_primary' => false,
            ],
        ],
        ...$overrides,
    ];
}

test('the create contractor page includes phone types', function () {
    $admin = contractorAdmin();

    $this->actingAs($admin)
        ->get(route('admin.contractors.create'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Contractors/Create')
            ->has('options.phoneTypes')
        );
});

test('a contractor can be created with multiple contacts', function () {
    $admin = contractorAdmin();

    $response = $this
        ->actingAs($admin)
        ->post(route('admin.contractors.store'), contractorPayload());

    $contractor = Contractor::query()
        ->where('name', 'Turner Construction')
        ->with('contacts')
        ->firstOrFail();

    $response
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success', 'Contractor created successfully.')
        ->assertRedirect(route('admin.contractors.index', ['highlight' => $contractor->id]));

    expect($contractor->website)->toBe('https://turner.example');
    expect($contractor->city)->toBe('Newark');
    expect($contractor->contacts)->toHaveCount(2);
    expect($contractor->contact_name)->toBe('Alex Rivera');
    expect($contractor->email)->toBe('alex@turner.example');
    expect($contractor->contacts->firstWhere('is_primary', true)?->phone_type)->toBe('office');
    expect($contractor->contacts->firstWhere('name', 'Jordan Lee')?->phone_type)->toBe('mobile');
});

test('a contractor can be updated and keep extra contacts', function () {
    $admin = contractorAdmin();
    $contractor = Contractor::create([
        'name' => 'Old Contractor',
        'city' => 'Trenton',
    ]);
    $contractor->contacts()->create([
        'name' => 'Pat Smith',
        'email' => 'pat@old.example',
        'phone_number' => '(609) 555-0100',
        'phone_type' => 'office',
        'is_primary' => true,
    ]);

    $response = $this
        ->actingAs($admin)
        ->patch(route('admin.contractors.update', $contractor), contractorPayload([
            'name' => 'Skanska',
        ]));

    $response
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success', 'Contractor updated successfully.')
        ->assertRedirect(route('admin.contractors.index', ['highlight' => $contractor->id]));

    $contractor->refresh()->load('contacts');

    expect($contractor->name)->toBe('Skanska');
    expect($contractor->contacts)->toHaveCount(2);
    expect($contractor->contacts->pluck('email')->all())
        ->toEqualCanonicalizing(['alex@turner.example', 'jordan@turner.example']);
});

test('a contractor without projects can be deleted', function () {
    $admin = contractorAdmin();
    $contractor = Contractor::create(['name' => 'Temporary GC']);

    $this->actingAs($admin)
        ->delete(route('admin.contractors.destroy', $contractor))
        ->assertSessionHas('success', 'Contractor deleted successfully.')
        ->assertRedirect(route('admin.contractors.index'));

    expect(Contractor::query()->whereKey($contractor->id)->exists())->toBeFalse();
});

test('a contractor linked to a project cannot be deleted', function () {
    $admin = contractorAdmin();
    $contractor = Contractor::create(['name' => 'Linked GC']);
    $customer = Customer::create([
        'name' => 'Gateway Customer',
        'company_name' => 'Gateway Facilities',
    ]);
    $project = Project::create([
        'name' => 'Secure Entry',
        'customer_id' => $customer->id,
        'project_status_id' => ProjectStatus::query()->where('slug', 'lead')->value('id'),
        'priority' => 'normal',
        'created_by' => $admin->id,
    ]);
    $project->contractors()->attach($contractor->id);

    $this->actingAs($admin)
        ->delete(route('admin.contractors.destroy', $contractor))
        ->assertSessionHas('error', 'Contractors linked to a project cannot be deleted.');

    expect(Contractor::query()->whereKey($contractor->id)->exists())->toBeTrue();
});

test('creating a contractor with a duplicate name is rejected', function () {
    $admin = contractorAdmin();
    Contractor::create(['name' => 'Turner Construction']);

    $this->actingAs($admin)
        ->post(route('admin.contractors.store'), contractorPayload([
            'name' => 'turner construction',
        ]))
        ->assertSessionHasErrors('name');
});

test('a phone number requires a phone type', function () {
    $admin = contractorAdmin();

    $this->actingAs($admin)
        ->post(route('admin.contractors.store'), contractorPayload([
            'contacts' => [
                [
                    'name' => 'Alex Rivera',
                    'title' => '',
                    'email' => 'alex@turner.example',
                    'phone_number' => '(973) 555-0100',
                    'phone_type' => '',
                    'notes' => '',
                    'is_primary' => true,
                ],
            ],
        ]))
        ->assertSessionHasErrors('contacts.0.phone_type');
});

test('the project form can still create a contractor by name only', function () {
    $admin = contractorAdmin();

    $this->actingAs($admin)
        ->from(route('admin.projects.create'))
        ->post(route('admin.contractors.store'), [
            'name' => 'Quick Add GC',
        ])
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success', 'Contractor added successfully.');

    expect(Contractor::query()->where('name', 'Quick Add GC')->exists())->toBeTrue();
});
