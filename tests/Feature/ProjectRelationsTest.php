<?php

use App\Models\Bid;
use App\Models\BidScopeTitle;
use App\Models\Contractor;
use App\Models\Customer;
use App\Models\Project;
use App\Models\ProjectScopeType;
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
            ->has('options.products')
            ->has('options.services')
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
    expect($project->project_number)->toBe('GDS-'.now()->year.'-0001');
});

test('new projects get the next gateway project number for the year', function () {
    $admin = projectAdmin();
    $customer = projectCustomer('Numbered Customer');

    Project::create([
        'name' => 'Existing numbered project',
        'customer_id' => $customer->id,
        'project_status_id' => projectStatusId(),
        'priority' => 'normal',
        'created_by' => $admin->id,
        'project_number' => 'GDS-'.now()->year.'-0042',
    ]);

    $expected = Project::nextNumber();

    $this->actingAs($admin)
        ->post(route('admin.projects.store'), [
            'name' => 'Next numbered project',
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
            'revisions' => [],
        ])
        ->assertSessionHasNoErrors();

    $project = Project::query()
        ->where('name', 'Next numbered project')
        ->firstOrFail();

    expect($expected)->toBe('GDS-'.now()->year.'-0043');
    expect($project->project_number)->toBe($expected);
});

test('a project scope can include a type and text', function () {
    $admin = projectAdmin();
    $customer = projectCustomer('Scope Product Customer');
    $notes = '<p>RF shielded pair</p><p>Owner requested extra text.</p>';

    $this->actingAs($admin)
        ->post(route('admin.projects.store'), [
            'name' => 'RF Door Project',
            'project_number' => '',
            'customer_id' => $customer->id,
            'assigned_to' => '',
            'status_id' => projectStatusId('quoted'),
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
            'scopes' => [
                [
                    'type' => 'radio_frequency_doors',
                    'notes' => $notes,
                ],
            ],
            'revisions' => [],
        ])
        ->assertSessionHasNoErrors();

    $project = Project::query()
        ->where('name', 'RF Door Project')
        ->with('scopes')
        ->firstOrFail();

    expect($project->scopes)->toHaveCount(1);
    expect($project->scopes->first()?->scope_type)->toBe('radio_frequency_doors');
    expect($project->scopes->first()?->product_id)->toBeNull();
    expect($project->scopes->first()?->service_id)->toBeNull();
    expect($project->scopes->first()?->notes)->toBe($notes);

    $this->actingAs($admin)
        ->get(route('admin.projects.show', $project))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Projects/Show')
            ->where('project.scopes.0.notes', $notes)
        );

    $this->actingAs($admin)
        ->get(route('admin.projects.edit', $project))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Projects/Edit')
            ->where('project.scopes.0.notes', $notes)
        );
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
    expect($project->project_number)->toStartWith('GDS-'.now()->year.'-');
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

test('a project scope type can be created from the catalog and reused case-insensitively', function () {
    $admin = projectAdmin();

    $this->actingAs($admin)
        ->post(route('admin.project-scope-types.store'), [
            'name' => 'SCIF Doors',
        ])
        ->assertSessionHasNoErrors();

    $this->actingAs($admin)
        ->post(route('admin.project-scope-types.store'), [
            'name' => 'scif doors',
        ])
        ->assertSessionHasNoErrors();

    expect(ProjectScopeType::query()->whereRaw('LOWER(name) = ?', ['scif doors'])->count())
        ->toBe(1);

    $scopeType = ProjectScopeType::query()
        ->whereRaw('LOWER(name) = ?', ['scif doors'])
        ->firstOrFail();

    $this->actingAs($admin)
        ->post(route('admin.projects.store'), [
            'name' => 'SCIF Scope Project',
            'project_number' => '',
            'customer_id' => '',
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
            'scopes' => [
                [
                    'type' => $scopeType->slug,
                    'notes' => 'Owner requested',
                ],
            ],
            'revisions' => [],
        ])
        ->assertSessionHasNoErrors();

    $project = Project::query()
        ->where('name', 'SCIF Scope Project')
        ->with('scopes')
        ->firstOrFail();

    expect($project->scopes)->toHaveCount(1);
    expect($project->scopes->first()?->scope_type)->toBe($scopeType->slug);
    expect($project->service_type)->toBe($scopeType->slug);
});

test('each project contractor can save company phone and email', function () {
    $admin = projectAdmin();
    $turner = Contractor::create(['name' => 'Turner Construction']);
    $skanska = Contractor::create(['name' => 'Skanska']);

    $this->actingAs($admin)
        ->post(route('admin.projects.store'), [
            'name' => 'Multi Contractor Contacts',
            'project_number' => '',
            'customer_id' => '',
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
            'contractors' => [
                [
                    'contractor_id' => $turner->id,
                    'company_name' => 'Turner Construction',
                    'contact_name' => 'Alex Rivera',
                    'email' => 'alex@turner.example',
                    'phone_number' => '(973) 555-0100',
                ],
                [
                    'contractor_id' => $skanska->id,
                    'company_name' => 'Skanska',
                    'contact_name' => 'Pat Smith',
                    'email' => 'pat@skanska.example',
                    'phone_number' => '(609) 555-0199',
                ],
            ],
            'scopes' => [],
            'revisions' => [],
        ])
        ->assertSessionHasNoErrors();

    $project = Project::query()
        ->where('name', 'Multi Contractor Contacts')
        ->with('contractors.contacts')
        ->firstOrFail();

    expect($project->contractors)->toHaveCount(2);
    expect($project->contractors->firstWhere('name', 'Turner Construction')?->contact_name)
        ->toBe('Alex Rivera');
    expect($project->contractors->firstWhere('name', 'Turner Construction')?->email)
        ->toBe('alex@turner.example');
    expect($project->contractors->firstWhere('name', 'Turner Construction')?->phone_number)
        ->toBe('(973) 555-0100');
    expect($project->contractors->firstWhere('name', 'Skanska')?->email)
        ->toBe('pat@skanska.example');
    expect($project->contractors->firstWhere('name', 'Skanska')?->phone_number)
        ->toBe('(609) 555-0199');
});

test('a project can create a customer from company contact fields', function () {
    $admin = projectAdmin();

    $this->actingAs($admin)
        ->post(route('admin.projects.store'), [
            'name' => 'Company Contact Project',
            'project_number' => '',
            'customer_id' => '',
            'customer_company_name' => 'Acme Builders',
            'customer_email' => 'ops@acme.example',
            'customer_phone_number' => '(973) 555-0144',
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
        ->assertSessionHasNoErrors();

    $project = Project::query()
        ->where('name', 'Company Contact Project')
        ->with('customer')
        ->firstOrFail();

    expect($project->customer)->not->toBeNull();
    expect($project->customer?->name)->toBe('Acme Builders');
    expect($project->customer?->company_name)->toBe('Acme Builders');
    expect($project->customer?->email)->toBe('ops@acme.example');
    expect($project->customer?->phone_number)->toBe('(973) 555-0144');
});

test('the projects table includes company phone and email', function () {
    $admin = projectAdmin();
    $customer = Customer::create([
        'name' => 'Acme Builders',
        'company_name' => 'Acme Builders',
        'email' => 'ops@acme.example',
        'phone_number' => '(973) 555-0144',
    ]);
    Project::create([
        'name' => 'Listed Project',
        'customer_id' => $customer->id,
        'project_status_id' => projectStatusId(),
        'priority' => 'normal',
        'created_by' => $admin->id,
    ]);

    $this->actingAs($admin)
        ->get(route('admin.projects.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Projects/Index')
            ->where('projects.data.0.customer.company_name', 'Acme Builders')
            ->where('projects.data.0.customer.email', 'ops@acme.example')
            ->where('projects.data.0.customer.phone_number', '(973) 555-0144')
            ->where('projects.data.0.bids_count', 0)
            ->where('projects.data.0.latest_bid_id', null)
            ->where('projects.data.0.bid_scopes', [])
        );
});

test('the projects table shows when a project is linked to a bid', function () {
    $admin = projectAdmin();
    $project = Project::create([
        'name' => 'Bid Linked Project',
        'project_status_id' => projectStatusId(),
        'priority' => 'normal',
        'created_by' => $admin->id,
    ]);
    $bid = Bid::create([
        'project_id' => $project->id,
        'created_by' => $admin->id,
    ]);
    $title = BidScopeTitle::create(['name' => 'RF Doors']);
    $bid->scopes()->create([
        'bid_scope_title_id' => $title->id,
        'sort_order' => 1,
    ]);

    $this->actingAs($admin)
        ->get(route('admin.projects.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Projects/Index')
            ->where('projects.data.0.bids_count', 1)
            ->where('projects.data.0.latest_bid_id', $bid->id)
            ->where('projects.data.0.bid_scopes.0.name', 'RF Doors')
        );
});

test('the project list can be printed and exported as pdf or word', function () {
    $admin = projectAdmin();
    $turner = Contractor::create([
        'name' => 'Turner Construction',
        'contact_name' => 'Alex Rivera',
        'email' => 'alex@turner.example',
        'phone_number' => '(973) 555-0100',
    ]);
    $listed = Project::create([
        'name' => 'SCIF Door Package',
        'project_status_id' => projectStatusId(),
        'priority' => 'normal',
        'created_by' => $admin->id,
    ]);
    $listed->contractors()->attach($turner->id);
    $bid = Bid::create([
        'project_id' => $listed->id,
        'created_by' => $admin->id,
    ]);
    $title = BidScopeTitle::create(['name' => 'RF Doors']);
    $bid->scopes()->create([
        'bid_scope_title_id' => $title->id,
        'sort_order' => 1,
    ]);
    Project::create([
        'name' => 'Hidden Warehouse Fit-out',
        'project_status_id' => projectStatusId(),
        'priority' => 'normal',
        'created_by' => $admin->id,
    ]);

    $this->actingAs($admin)
        ->get(route('admin.projects.print', ['search' => 'SCIF Door']))
        ->assertOk()
        ->assertSee('Project directory', false)
        ->assertSee('Gateway Door Systems', false)
        ->assertSee('General contractor', false)
        ->assertSee('Bid scope', false)
        ->assertSee('Lead', false)
        ->assertSee('SCIF Door Package', false)
        ->assertSee('Turner Construction', false)
        ->assertSee('RF Doors', false)
        ->assertDontSee('Hidden Warehouse Fit-out', false);

    $pdf = $this->actingAs($admin)
        ->get(route('admin.projects.export.pdf', ['search' => 'SCIF Door']));

    $pdf->assertOk();
    $pdf->assertHeader('content-disposition');
    expect((string) $pdf->headers->get('content-type'))->toStartWith('application/pdf');
    expect($pdf->getContent())->toStartWith('%PDF');
    expect((string) $pdf->headers->get('content-disposition'))->toContain('project-directory-'.now()->year.'.pdf');

    $word = $this->actingAs($admin)
        ->get(route('admin.projects.export.word'));

    $word->assertOk();
    expect((string) $word->headers->get('content-type'))->toContain('wordprocessingml.document');
    expect((string) $word->headers->get('content-disposition'))->toContain('project-directory-'.now()->year.'.docx');
});

test('a project can be printed and exported as pdf or word', function () {
    $admin = projectAdmin();
    $turner = Contractor::create([
        'name' => 'Turner Construction',
        'contact_name' => 'Alex Rivera',
        'email' => 'alex@turner.example',
        'phone_number' => '(973) 555-0100',
    ]);
    $customer = projectCustomer();
    $project = Project::create([
        'name' => 'Harbor Print Package',
        'project_number' => 'GDS-2026-PRINT',
        'project_status_id' => projectStatusId(),
        'priority' => 'high',
        'customer_id' => $customer->id,
        'assigned_to' => $admin->id,
        'site_address_line_1' => '12 Dock Road',
        'site_city' => 'Newark',
        'site_state' => 'NJ',
        'public_notes' => 'Owner review draft',
        'created_by' => $admin->id,
    ]);
    $project->contractors()->attach($turner->id);
    $project->scopes()->create([
        'scope_type' => 'radio_frequency_doors',
        'notes' => '<p>Furnish and install RF doors for Harbor Print Package.</p>',
    ]);
    $project->revisions()->create([
        'number' => '1',
        'revision_date' => '2026-09-01',
        'notes' => 'Issued for review',
        'user_id' => $admin->id,
    ]);

    $this->actingAs($admin)
        ->get(route('admin.projects.document.print', $project))
        ->assertOk()
        ->assertSee('Project', false)
        ->assertSee('Gateway Door Systems', false)
        ->assertSee('Harbor Print Package', false)
        ->assertSee('Project information', false)
        ->assertSee('GDS-2026-PRINT', false)
        ->assertSee('12 Dock Road', false)
        ->assertSee('Turner Construction', false)
        ->assertSee('Gateway Facilities', false)
        ->assertSee('Gateway Customer', false)
        ->assertSee('Radio frequency doors', false)
        ->assertSee('Furnish and install RF doors for Harbor Print Package.', false)
        ->assertSee('Issued for review', false)
        ->assertSee('Owner review draft', false)
        ->assertSee('Print project', false)
        ->assertSee('Word 2026', false);

    $pdf = $this->actingAs($admin)
        ->get(route('admin.projects.document.export.pdf', $project));

    $pdf->assertOk();
    $pdf->assertHeader('content-disposition');
    expect((string) $pdf->headers->get('content-type'))->toStartWith('application/pdf');
    expect($pdf->getContent())->toStartWith('%PDF');
    expect((string) $pdf->headers->get('content-disposition'))->toContain('project-gds-2026-print-'.$project->id.'.pdf');

    $word = $this->actingAs($admin)
        ->get(route('admin.projects.document.export.word', $project));

    $word->assertOk();
    expect((string) $word->headers->get('content-type'))->toContain('wordprocessingml.document');
    expect((string) $word->headers->get('content-disposition'))->toContain('project-gds-2026-print-'.$project->id.'.docx');
});
