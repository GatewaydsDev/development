<?php

use App\Models\Contractor;
use App\Models\Customer;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\User;
use App\Models\UserLevel;
use Inertia\Testing\AssertableInertia as Assert;

function projectAdmin(): User
{
    $level = UserLevel::firstOrCreate([
        'name' => UserLevel::SUPER_ADMIN,
    ]);

    return User::factory()->create([
        'level_id' => $level->id,
    ]);
}

function projectStatusId(string $slug = 'lead'): int
{
    return (int) ProjectStatus::query()->where('slug', $slug)->value('id');
}

function projectCustomer(string $name = 'Gateway Customer'): Customer
{
    return Customer::create([
        'name' => $name,
        'company_name' => 'Gateway Facilities',
    ]);
}

test('the create project page includes contractor scopes and revisions fields', function () {
    $admin = projectAdmin();

    $this->actingAs($admin)
        ->get(route('admin.projects.create'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Projects/Create')
            ->has('options.scopeTypes')
            ->has('options.statuses')
            ->has('options.contractors')
            ->where('options.nextProjectNumber', Project::nextNumber())
        );
});

test('a project can be created with a general contractor scopes and revisions', function () {
    $admin = projectAdmin();
    $customer = projectCustomer();
    $turner = Contractor::create([
        'name' => 'Turner Construction',
        'contact_name' => 'Alex Rivera',
        'email' => 'alex@turner.example',
        'phone_number' => '(973) 555-0100',
    ]);

    $response = $this
        ->actingAs($admin)
        ->post(route('admin.projects.store'), [
            'name' => 'SCIF Door Package',
            'project_number' => 'P-1001',
            'customer_id' => $customer->id,
            'assigned_to' => '',
            'status_id' => projectStatusId('quoted'),
            'priority' => 'high',
            'site_address_line_1' => '100 Secure Way',
            'site_address_line_2' => '',
            'site_city' => 'Newark',
            'site_state' => 'NJ',
            'site_postal_code' => '07102',
            'site_country' => 'United States',
            'estimated_start_date' => '',
            'estimated_end_date' => '',
            'completed_at' => '',
            'public_notes' => '',
            'internal_notes' => '',
            'budget_amount' => '',
            'contractors' => [
                [
                    'contractor_id' => $turner->id,
                ],
            ],
            'scopes' => [
                [
                    'type' => 'radio_frequency_doors',
                    'notes' => 'RF shielded pair',
                ],
                [
                    'type' => 'blast',
                    'notes' => '',
                ],
            ],
            'revisions' => [
                [
                    'number' => 'A',
                    'revision_date' => '2026-09-01',
                    'notes' => 'Initial submittal',
                ],
            ],
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success', 'Project created successfully.');

    $project = Project::query()
        ->where('name', 'SCIF Door Package')
        ->with(['contractors', 'scopes', 'revisions'])
        ->firstOrFail();

    $response->assertRedirect(route('admin.projects.index', ['highlight' => $project->id]));

    expect($project->contractors)->toHaveCount(1);
    expect($project->contractors->first()?->name)->toBe('Turner Construction');
    expect($project->scopes)->toHaveCount(2);
    expect($project->scopes->pluck('scope_type')->all())
        ->toEqualCanonicalizing(['radio_frequency_doors', 'blast']);
    expect($project->revisions)->toHaveCount(1);
    expect($project->revisions->first()?->number)->toBe('A');
    expect($project->revisions->first()?->user_id)->toBe($admin->id);
    expect($project->service_type)->toBe('radio_frequency_doors');
    expect($project->project_number)->toBe(Project::numberForId($project->id));
});

test('a project can update its general contractor scopes and revisions', function () {
    $admin = projectAdmin();
    $customer = projectCustomer('Existing Customer');
    $project = Project::create([
        'name' => 'Existing Project',
        'customer_id' => $customer->id,
        'project_status_id' => projectStatusId(),
        'priority' => 'normal',
        'created_by' => $admin->id,
    ]);
    $oldContractor = Contractor::create(['name' => 'Old Contractor']);
    $skanska = Contractor::create([
        'name' => 'Skanska',
        'contact_name' => 'Jordan Lee',
        'email' => 'jordan@skanska.example',
    ]);
    $project->contractors()->attach($oldContractor->id);
    $project->scopes()->create([
        'scope_type' => 'bullet',
        'notes' => 'Original scope',
    ]);
    $project->revisions()->create([
        'number' => 'A',
        'notes' => 'First issue',
    ]);

    $response = $this
        ->actingAs($admin)
        ->patch(route('admin.projects.update', $project), [
            'name' => 'Existing Project',
            'project_number' => '',
            'customer_id' => $customer->id,
            'assigned_to' => '',
            'status_id' => projectStatusId('approved'),
            'priority' => 'normal',
            'site_address_line_1' => '200 Main Street',
            'site_address_line_2' => '',
            'site_city' => 'Trenton',
            'site_state' => 'NJ',
            'site_postal_code' => '08608',
            'site_country' => 'United States',
            'estimated_start_date' => '',
            'estimated_end_date' => '',
            'completed_at' => '',
            'public_notes' => '',
            'internal_notes' => '',
            'budget_amount' => '',
            'contractors' => [
                [
                    'contractor_id' => $skanska->id,
                ],
            ],
            'scopes' => [
                [
                    'type' => 'sound_transmission',
                    'notes' => 'STC 50',
                ],
                [
                    'type' => 'forced_entry_doors',
                    'notes' => '',
                ],
            ],
            'revisions' => [
                [
                    'number' => 'B',
                    'revision_date' => '2026-09-02',
                    'notes' => 'Updated hardware',
                ],
            ],
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success', 'Project updated successfully.')
        ->assertRedirect(route('admin.projects.index', ['highlight' => $project->id]));

    $project->refresh()->load(['contractors', 'scopes', 'revisions']);

    expect($project->status?->slug)->toBe('approved');
    expect($project->site_address_line_1)->toBe('200 Main Street');
    expect($project->contractors->pluck('name')->all())->toBe(['Skanska']);
    expect($project->scopes->pluck('scope_type')->all())
        ->toEqualCanonicalizing(['sound_transmission', 'forced_entry_doors']);
    expect($project->revisions)->toHaveCount(1);
    expect($project->revisions->first()?->number)->toBe('B');
    expect($project->revisions->first()?->user_id)->toBe($admin->id);
    expect($project->project_number)->toBe(Project::numberForId($project->id));
});

test('updating a revision records the current user and leaves untouched revisions', function () {
    $admin = projectAdmin();
    $other = projectAdmin();
    $customer = projectCustomer('Revision Customer');
    $project = Project::create([
        'name' => 'Revision Ownership',
        'customer_id' => $customer->id,
        'project_status_id' => projectStatusId(),
        'priority' => 'normal',
        'created_by' => $admin->id,
    ]);
    $kept = $project->revisions()->create([
        'number' => 'A',
        'notes' => 'Keep this',
        'user_id' => $admin->id,
    ]);
    $changed = $project->revisions()->create([
        'number' => 'B',
        'notes' => 'Old notes',
        'user_id' => $admin->id,
    ]);

    $this->actingAs($other)
        ->patch(route('admin.projects.update', $project), [
            'name' => 'Revision Ownership',
            'project_number' => '',
            'customer_id' => $customer->id,
            'assigned_to' => '',
            'status_id' => projectStatusId(),
            'priority' => 'normal',
            'site_address_line_1' => '',
            'site_address_line_2' => '',
            'site_city' => '',
            'site_state' => '',
            'site_postal_code' => '',
            'site_country' => '',
            'estimated_start_date' => '',
            'estimated_end_date' => '',
            'completed_at' => '',
            'public_notes' => '',
            'internal_notes' => '',
            'budget_amount' => '',
            'contractors' => [],
            'scopes' => [],
            'revisions' => [
                [
                    'id' => $kept->id,
                    'number' => 'A',
                    'revision_date' => '',
                    'notes' => 'Keep this',
                ],
                [
                    'id' => $changed->id,
                    'number' => 'B',
                    'revision_date' => '',
                    'notes' => 'Updated notes',
                ],
            ],
        ])
        ->assertSessionHasNoErrors();

    expect($kept->fresh()->user_id)->toBe($admin->id);
    expect($changed->fresh()->user_id)->toBe($other->id);
    expect($changed->fresh()->notes)->toBe('Updated notes');
});

test('project name availability reports when a name is already taken', function () {
    $admin = projectAdmin();
    $customer = projectCustomer('Harvey Customer');
    Project::create([
        'name' => 'Harvey',
        'customer_id' => $customer->id,
        'project_status_id' => projectStatusId(),
        'priority' => 'normal',
        'created_by' => $admin->id,
    ]);

    $this->actingAs($admin)
        ->get(route('admin.projects.name-availability', ['name' => 'harvey']))
        ->assertOk()
        ->assertJson(['available' => false]);

    $this->actingAs($admin)
        ->get(route('admin.projects.name-availability', ['name' => 'New Gateway Project']))
        ->assertOk()
        ->assertJson(['available' => true]);
});

test('editing a project treats its current name as available', function () {
    $admin = projectAdmin();
    $customer = projectCustomer('Existing Harvey Customer');
    $project = Project::create([
        'name' => 'Harvey',
        'customer_id' => $customer->id,
        'project_status_id' => projectStatusId(),
        'priority' => 'normal',
        'created_by' => $admin->id,
    ]);

    $this->actingAs($admin)
        ->get(route('admin.projects.name-availability', [
            'name' => 'Harvey',
            'project_id' => $project->id,
        ]))
        ->assertOk()
        ->assertJson(['available' => true]);
});

test('creating a project with a duplicate name is rejected', function () {
    $admin = projectAdmin();
    $existingCustomer = projectCustomer('First Customer');
    $newCustomer = projectCustomer('Second Customer');
    Project::create([
        'name' => 'Harvey',
        'customer_id' => $existingCustomer->id,
        'project_status_id' => projectStatusId(),
        'priority' => 'normal',
        'created_by' => $admin->id,
    ]);

    $this->actingAs($admin)
        ->post(route('admin.projects.store'), [
            'name' => 'harvey',
            'project_number' => '',
            'customer_id' => $newCustomer->id,
            'assigned_to' => '',
            'status_id' => projectStatusId(),
            'priority' => 'normal',
            'site_address_line_1' => '',
            'site_address_line_2' => '',
            'site_city' => '',
            'site_state' => '',
            'site_postal_code' => '',
            'site_country' => '',
            'estimated_start_date' => '',
            'estimated_end_date' => '',
            'completed_at' => '',
            'public_notes' => '',
            'internal_notes' => '',
            'budget_amount' => '',
            'contractors' => [],
            'scopes' => [],
            'revisions' => [],
        ])
        ->assertSessionHasErrors('name');
});

test('a project can be created without a customer', function () {
    $admin = projectAdmin();

    $response = $this
        ->actingAs($admin)
        ->post(route('admin.projects.store'), [
            'name' => 'Standalone Project',
            'project_number' => '',
            'customer_id' => '',
            'assigned_to' => '',
            'status_id' => projectStatusId(),
            'priority' => 'normal',
            'site_address_line_1' => '10 Main Street',
            'site_address_line_2' => '',
            'site_city' => 'Newark',
            'site_state' => 'NJ',
            'site_postal_code' => '',
            'site_country' => '',
            'estimated_start_date' => '',
            'estimated_end_date' => '',
            'completed_at' => '',
            'public_notes' => '',
            'internal_notes' => '',
            'budget_amount' => '',
            'contractors' => [],
            'scopes' => [],
            'revisions' => [],
        ]);

    $project = Project::query()->where('name', 'Standalone Project')->firstOrFail();

    $response
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success', 'Project created successfully.')
        ->assertRedirect(route('admin.projects.index', ['highlight' => $project->id]));

    expect($project->customer_id)->toBeNull();
});

test('contractor names are unique and can be reused across projects', function () {
    $admin = projectAdmin();
    $firstCustomer = projectCustomer('First Customer');
    $secondCustomer = projectCustomer('Second Customer');
    $turner = Contractor::create(['name' => 'Turner Construction']);

    $this->actingAs($admin)
        ->post(route('admin.contractors.store'), [
            'name' => 'turner construction',
        ])
        ->assertSessionHasNoErrors();

    expect(Contractor::query()->whereRaw('LOWER(name) = ?', ['turner construction'])->count())
        ->toBe(1);

    $firstProject = Project::create([
        'name' => 'First Job',
        'customer_id' => $firstCustomer->id,
        'project_status_id' => projectStatusId(),
        'priority' => 'normal',
        'created_by' => $admin->id,
    ]);
    $secondProject = Project::create([
        'name' => 'Second Job',
        'customer_id' => $secondCustomer->id,
        'project_status_id' => projectStatusId(),
        'priority' => 'normal',
        'created_by' => $admin->id,
    ]);

    $firstProject->contractors()->attach($turner->id);
    $secondProject->contractors()->attach($turner->id);

    expect($turner->fresh()->projects)->toHaveCount(2);
});

test('a project status can be created from the catalog and reused case-insensitively', function () {
    $admin = projectAdmin();

    $this->actingAs($admin)
        ->post(route('admin.project-statuses.store'), [
            'name' => 'On Hold',
        ])
        ->assertSessionHasNoErrors();

    $this->actingAs($admin)
        ->post(route('admin.project-statuses.store'), [
            'name' => 'on hold',
        ])
        ->assertSessionHasNoErrors();

    expect(ProjectStatus::query()->whereRaw('LOWER(name) = ?', ['on hold'])->count())->toBe(1);

    $statusId = projectStatusId('on_hold');

    $this->actingAs($admin)
        ->post(route('admin.projects.store'), [
            'name' => 'Hold Package',
            'project_number' => '',
            'customer_id' => '',
            'assigned_to' => '',
            'status_id' => $statusId,
            'priority' => 'normal',
            'site_address_line_1' => '',
            'site_address_line_2' => '',
            'site_city' => '',
            'site_state' => '',
            'site_postal_code' => '',
            'site_country' => '',
            'estimated_start_date' => '',
            'estimated_end_date' => '',
            'completed_at' => '',
            'public_notes' => '',
            'internal_notes' => '',
            'budget_amount' => '',
            'contractors' => [],
            'scopes' => [],
            'revisions' => [],
        ])
        ->assertSessionHasNoErrors();

    $project = Project::query()->where('name', 'Hold Package')->firstOrFail();

    expect($project->project_status_id)->toBe($statusId);
});
