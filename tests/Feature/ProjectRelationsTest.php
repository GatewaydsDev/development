<?php

use App\Models\Bid;
use App\Models\BidScopeTitle;
use App\Models\BidStageType;
use App\Models\ContactDirectory\ContactCompany;
use App\Models\Contractor;
use App\Models\Project;
use App\Models\ProjectPriority;
use App\Models\ProjectScopeType;
use App\Models\ProjectStatus;
use App\Models\Quotation;
use App\Models\Takeoff;
use App\Models\User;
use App\Models\UserLevel;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
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

    $response->assertRedirect(route('admin.projects.index', ['highlight' => $project->uuid]));

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

test('a project can store more than one price for quotes and bids', function () {
    $admin = projectAdmin();

    $this->actingAs($admin)
        ->post(route('admin.projects.store'), [
            'name' => 'Window price options',
            'project_number' => '',
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
            'contractors' => [],
            'scopes' => [],
            'revisions' => [],
            'prices' => [
                ['label' => '2 windows', 'amount' => '4500.00'],
                ['label' => '3 windows', 'amount' => '6200.50'],
                ['label' => '', 'amount' => ''],
            ],
        ])
        ->assertSessionHasNoErrors();

    $project = Project::query()->where('name', 'Window price options')->firstOrFail();

    expect($project->prices)->toHaveCount(2);
    expect($project->prices->pluck('label')->all())->toBe(['2 windows', '3 windows']);
    expect($project->prices->pluck('amount')->all())->toBe(['4500.00', '6200.50']);
});

test('a quotation and a bid can select more than one project price', function () {
    $admin = projectAdmin();
    $contractor = Contractor::create(['name' => 'Window Contractor']);

    $this->actingAs($admin)
        ->post(route('admin.projects.store'), [
            'name' => 'Selectable window prices',
            'project_number' => '',
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
            'contractors' => [
                ['contractor_id' => $contractor->id],
            ],
            'scopes' => [],
            'revisions' => [],
            'prices' => [
                ['label' => '2 windows', 'amount' => '4500.00'],
                ['label' => '3 windows', 'amount' => '6200.50'],
            ],
        ])
        ->assertSessionHasNoErrors();

    $project = Project::query()->where('name', 'Selectable window prices')->firstOrFail();
    $priceIds = $project->prices->pluck('id')->all();

    $this->actingAs($admin)
        ->post(route('admin.quotations.store'), [
            'contractor_id' => $contractor->id,
            'project_id' => $project->id,
            'title' => 'Window combination quote',
            'status' => 'draft',
            'project_amount' => '',
            'project_price_ids' => $priceIds,
            'line_items' => [],
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    $quotation = Quotation::query()->where('title', 'Window combination quote')->firstOrFail();

    expect($quotation->projectPrices->pluck('id')->all())->toBe($priceIds);
    expect($quotation->project_amount)->toBe('10700.50');

    $this->actingAs($admin)
        ->post(route('admin.bids.store'), [
            'project_id' => $project->id,
            'project_price_ids' => $priceIds,
        ])
        ->assertSessionHasNoErrors();

    $bid = Bid::query()->where('project_id', $project->id)->firstOrFail();

    expect($bid->projectPrices->pluck('id')->all())->toBe($priceIds);
});

test('new projects get the next gateway project number for the year', function () {
    $admin = projectAdmin();

    Project::create([
        'name' => 'Existing numbered project',
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
    $notes = '<p>RF shielded pair</p><p>Owner requested extra text.</p>';

    $this->actingAs($admin)
        ->post(route('admin.projects.store'), [
            'name' => 'RF Door Project',
            'project_number' => '',
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
    $project = Project::create([
        'name' => 'Existing Project',
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
        ->assertRedirect(route('admin.projects.index', ['highlight' => $project->uuid]));

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
    $project = Project::create([
        'name' => 'Revision Ownership',
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
    Project::create([
        'name' => 'Harvey',
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
    $project = Project::create([
        'name' => 'Harvey',
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
    Project::create([
        'name' => 'Harvey',
        'project_status_id' => projectStatusId(),
        'priority' => 'normal',
        'created_by' => $admin->id,
    ]);

    $this->actingAs($admin)
        ->post(route('admin.projects.store'), [
            'name' => 'harvey',
            'project_number' => '',
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

test('a project can be created without a contractor', function () {
    $admin = projectAdmin();

    $response = $this
        ->actingAs($admin)
        ->post(route('admin.projects.store'), [
            'name' => 'Standalone Project',
            'project_number' => '',
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
        ->assertRedirect(route('admin.projects.index', ['highlight' => $project->uuid]));

    expect($project->fresh('contractors')->contractors)->toHaveCount(0);
});

test('contractor names are unique and can be reused across projects', function () {
    $admin = projectAdmin();
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
        'project_status_id' => projectStatusId(),
        'priority' => 'normal',
        'created_by' => $admin->id,
    ]);
    $secondProject = Project::create([
        'name' => 'Second Job',
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

test('the projects table includes company phone and email', function () {
    $admin = projectAdmin();
    $contractor = Contractor::create(['name' => 'Acme Builders']);
    $contractor->contacts()->create([
        'name' => 'Ops',
        'email' => 'ops@acme.example',
        'phone_number' => '(973) 555-0144',
        'is_primary' => true,
    ]);
    $project = Project::create([
        'name' => 'Listed Project',
        'project_status_id' => projectStatusId(),
        'priority' => 'normal',
        'created_by' => $admin->id,
    ]);
    $project->contractors()->attach($contractor->id);

    $this->actingAs($admin)
        ->get(route('admin.projects.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Projects/Index')
            ->where('projects.data.0.contractors.0.name', 'Acme Builders')
            ->where('projects.data.0.contractors.0.email', 'ops@acme.example')
            ->where('projects.data.0.contractors.0.phone_number', '(973) 555-0144')
            ->where('projects.data.0.bids_count', 0)
            ->where('projects.data.0.latest_bid_id', null)
            ->where('projects.data.0.latest_bid_uuid', null)
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
            ->where('projects.data.0.latest_bid_uuid', $bid->uuid)
            ->where('projects.data.0.bid.uuid', $bid->uuid)
            ->where('projects.data.0.bid.status', 'No stage')
            ->where('projects.data.0.quotation', null)
            ->where('projects.data.0.takeoff', null)
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
        ->assertSee('Contractors', false)
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
    $gateway = Contractor::create(['name' => 'Gateway Facilities']);
    $project = Project::create([
        'name' => 'Harbor Print Package',
        'project_number' => 'GDS-2026-PRINT',
        'project_status_id' => projectStatusId(),
        'priority' => 'high',
        'assigned_to' => $admin->id,
        'site_address_line_1' => '12 Dock Road',
        'site_city' => 'Newark',
        'site_state' => 'NJ',
        'public_notes' => 'Owner review draft',
        'created_by' => $admin->id,
    ]);
    $project->contractors()->attach([$turner->id, $gateway->id]);
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
        ->assertSee('Radio frequency doors', false)
        ->assertDontSee('Furnish and install RF doors for Harbor Print Package.', false)
        ->assertDontSee('No text added.', false)
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

test('a quotation can save a basic project without leaving the form', function () {
    $admin = projectAdmin();
    $turner = Contractor::create([
        'name' => 'Turner Construction',
        'role' => 'contractor',
    ]);

    $this->actingAs($admin)
        ->from(route('admin.quotations.create'))
        ->post(route('admin.projects.quick-store'), [
            'name' => 'Lobby doors',
            'site_address_line_1' => '100 Secure Way',
            'site_city' => 'Newark',
            'site_state' => 'nj',
            'site_postal_code' => '07102',
            'contractor_id' => $turner->id,
            'price_label' => '2 windows',
            'price_amount' => '1500.00',
        ])
        ->assertRedirect(route('admin.quotations.create'))
        ->assertSessionHas('success', 'Project saved. It is selected for this form.');

    $project = Project::query()->where('name', 'Lobby doors')->first();

    expect($project)->not->toBeNull();
    expect($project->project_status_id)->toBe(projectStatusId('lead'));
    expect($project->priority)->toBe('normal');
    expect($project->site_state)->toBe('NJ');
    expect($project->project_number)->toStartWith('GDS-');
    expect($project->contractors->pluck('id')->all())->toBe([$turner->id]);
    $price = $project->prices()->first();
    expect($price->label)->toBe('2 windows');
    expect((string) $price->amount)->toBe('1500.00');
});

test('a quick project rejects a duplicate name', function () {
    $admin = projectAdmin();
    Project::create([
        'name' => 'Lobby doors',
        'priority' => 'normal',
        'project_status_id' => projectStatusId('lead'),
    ]);

    $this->actingAs($admin)
        ->from(route('admin.bids.create'))
        ->post(route('admin.projects.quick-store'), [
            'name' => 'Lobby doors',
        ])
        ->assertRedirect(route('admin.bids.create'))
        ->assertSessionHasErrors('name');
});

test('a quotation can add a contractor contact without leaving the form', function () {
    $admin = projectAdmin();
    $turner = Contractor::create([
        'name' => 'Turner Construction',
        'role' => 'contractor',
    ]);

    $this->actingAs($admin)
        ->from(route('admin.quotations.create'))
        ->post(route('admin.contractors.contacts.store', $turner), [
            'name' => 'Alex Rivera',
            'title' => 'Project manager',
            'email' => 'alex@turner.example',
            'phone_number' => '9735550100',
        ])
        ->assertRedirect(route('admin.quotations.create'))
        ->assertSessionHas('success', 'Contact saved. It is available on this quotation.');

    $contact = $turner->contacts()->first();

    expect($contact)->not->toBeNull();
    expect($contact->name)->toBe('Alex Rivera');
    expect($contact->is_primary)->toBeTrue();
    expect($contact->email)->toBe('alex@turner.example');
});

test('the projects list shows the linked quotation bid and takeoff with their status', function () {
    $admin = projectAdmin();
    $contractor = Contractor::create(['name' => 'Harbor Facilities']);
    $project = Project::create([
        'name' => 'Linked documents project',
        'project_status_id' => projectStatusId(),
        'priority' => 'normal',
        'budget_amount' => 99,
        'created_by' => $admin->id,
    ]);
    $project->prices()->create([
        'label' => '2 windows',
        'amount' => 800,
        'sort_order' => 1,
    ]);
    $project->prices()->create([
        'label' => '3 windows',
        'amount' => 700.50,
        'sort_order' => 2,
    ]);
    $quotation = Quotation::create([
        'contractor_id' => $contractor->id,
        'project_id' => $project->id,
        'title' => 'Door quote',
        'status' => 'sent',
        'created_by' => $admin->id,
    ]);
    $bid = Bid::create([
        'project_id' => $project->id,
        'created_by' => $admin->id,
    ]);
    $stage = BidStageType::create(['name' => 'Submitted']);
    $bid->stages()->create([
        'bid_stage_type_id' => $stage->id,
        'sort_order' => 1,
    ]);
    $takeoff = Takeoff::create([
        'project_id' => $project->id,
        'title' => 'Door schedule',
        'status' => 'in_review',
        'created_by' => $admin->id,
    ]);

    $this->actingAs($admin)
        ->get(route('admin.projects.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('projects.data.0.quotation.uuid', $quotation->uuid)
            ->where('projects.data.0.quotation.number', $quotation->quotation_number)
            ->where('projects.data.0.quotation.status', 'sent')
            ->where('projects.data.0.quotation.status_label', 'Sent')
            ->where('projects.data.0.bid.uuid', $bid->uuid)
            ->where('projects.data.0.bid.status', 'Submitted')
            ->where('projects.data.0.takeoff.uuid', $takeoff->uuid)
            ->where('projects.data.0.takeoff.title', 'Door schedule')
            ->where('projects.data.0.takeoff.status', 'in_review')
            ->where('projects.data.0.takeoff.status_label', 'In review')
            ->where('summary.total', 1)
            ->where('summary.amount', '1500.50')
            ->where('summary.in_quotation', 1)
            ->where('summary.in_bid', 1)
            ->where('summary.in_takeoff', 1)
            ->where('summary.to_bid', 0)
            ->where('summary.won', 0)
            ->where('summary.lost', 0)
        );
});

test('the projects list totals work still to bid, won, and lost', function () {
    $admin = projectAdmin();
    $status = projectStatusId();

    Project::create([
        'name' => 'Needs a bid',
        'project_status_id' => $status,
        'priority' => 'normal',
        'budget_amount' => 1000,
        'created_by' => $admin->id,
    ]);

    $wonProject = Project::create([
        'name' => 'Awarded hangar',
        'project_status_id' => $status,
        'priority' => 'normal',
        'budget_amount' => 50,
        'created_by' => $admin->id,
    ]);
    $wonBid = Bid::create([
        'project_id' => $wonProject->id,
        'created_by' => $admin->id,
    ]);
    $wonBid->stages()->create([
        'bid_stage_type_id' => BidStageType::create(['name' => 'Won'])->id,
        'sort_order' => 1,
    ]);
    $wonBid->scopes()->create([
        'bid_scope_title_id' => BidScopeTitle::create(['name' => 'Hangar doors'])->id,
        'extended' => 2500,
        'sort_order' => 1,
    ]);

    $lostProject = Project::create([
        'name' => 'Passed over school',
        'project_status_id' => $status,
        'priority' => 'normal',
        'budget_amount' => 400,
        'created_by' => $admin->id,
    ]);
    $lostBid = Bid::create([
        'project_id' => $lostProject->id,
        'created_by' => $admin->id,
    ]);
    $lostBid->stages()->create([
        'bid_stage_type_id' => BidStageType::create(['name' => 'Lost'])->id,
        'sort_order' => 1,
    ]);

    $this->actingAs($admin)
        ->get(route('admin.projects.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('summary.to_bid', 1)
            ->where('summary.to_bid_amount', '1000.00')
            ->where('summary.won', 1)
            ->where('summary.won_amount', '2500.00')
            ->where('summary.lost', 1)
            ->where('summary.lost_amount', '400.00')
        );
});

test('a typed project number is saved and a duplicate number is rejected', function () {
    $admin = projectAdmin();
    $payload = [
        'name' => 'Numbered dock project',
        'project_number' => 'GDS-CUSTOM-9',
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
        'contractors' => [],
        'scopes' => [],
        'revisions' => [],
    ];

    $this->actingAs($admin)
        ->post(route('admin.projects.store'), $payload)
        ->assertSessionHasNoErrors();

    expect(Project::query()->where('name', 'Numbered dock project')->value('project_number'))
        ->toBe('GDS-CUSTOM-9');

    $this->actingAs($admin)
        ->post(route('admin.projects.store'), [
            ...$payload,
            'name' => 'Another dock project',
        ])
        ->assertSessionHasErrors('project_number');
});

test('a new priority can be added and saved on a project', function () {
    $admin = projectAdmin();

    $this->actingAs($admin)
        ->post(route('admin.project-priorities.store'), ['name' => 'Rush'])
        ->assertRedirect()
        ->assertSessionHas('success', 'Priority added successfully.');

    expect(ProjectPriority::query()->where('name', 'Rush')->value('slug'))->toBe('rush');

    $this->actingAs($admin)
        ->post(route('admin.projects.store'), [
            'name' => 'Rush dock project',
            'project_number' => '',
            'assigned_to' => '',
            'status_id' => projectStatusId(),
            'priority' => 'rush',
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
            'contractors' => [],
            'scopes' => [],
            'revisions' => [],
        ])
        ->assertSessionHasNoErrors();

    expect(Project::query()->where('name', 'Rush dock project')->value('priority'))->toBe('rush');
});

test('a project can be linked to more than one company and updated', function () {
    $admin = projectAdmin();
    $a = ContactCompany::create(['name' => 'Alpha Builders']);
    $b = ContactCompany::create(['name' => 'Beta Glazing']);
    $c = ContactCompany::create(['name' => 'Gamma Doors']);
    $base = [
        'name' => 'Shared job', 'project_number' => '', 'assigned_to' => '', 'status_id' => projectStatusId(),
        'priority' => 'normal', 'estimated_start_date' => '', 'estimated_end_date' => '', 'completed_at' => '',
        'public_notes' => '', 'internal_notes' => '', 'contractors' => [], 'scopes' => [], 'revisions' => [], 'prices' => [],
    ];

    $this->actingAs($admin)->post(route('admin.projects.store'), [...$base, 'company_uuids' => [$a->uuid, $b->uuid]])
        ->assertSessionHasNoErrors();
    $project = Project::where('name', 'Shared job')->firstOrFail();
    expect($project->contactCompanies->pluck('name')->all())->toBe(['Alpha Builders', 'Beta Glazing']);

    $this->actingAs($admin)->patch(route('admin.projects.update', $project), [...$base, 'company_uuids' => [$c->uuid]])
        ->assertSessionHasNoErrors();
    expect($project->fresh()->contactCompanies->pluck('name')->all())->toBe(['Gamma Doors']);

    $this->actingAs($admin)->patch(route('admin.projects.update', $project), [...$base, 'company_uuids' => ['missing']])
        ->assertSessionHasErrors('company_uuids.0');

    $this->actingAs($admin)->get(route('admin.projects.edit', $project))
        ->assertInertia(fn ($page) => $page->where('project.companies.0.name', 'Gamma Doors')->has('options.companies', 3));
    $this->actingAs($admin)->get(route('contact-directory.companies.show', $c))
        ->assertInertia(fn ($page) => $page->where('projects.0.name', 'Shared job'));
});

test('a project keeps every bid date and each addendum', function () {
    Storage::fake('local');
    $admin = projectAdmin();
    $base = [
        'name' => 'Courthouse openings',
        'project_number' => '',
        'assigned_to' => '',
        'status_id' => projectStatusId(),
        'priority' => 'normal',
        'estimated_start_date' => '',
        'estimated_end_date' => '',
        'completed_at' => '',
        'public_notes' => '',
        'internal_notes' => '',
        'contractors' => [],
        'scopes' => [],
        'revisions' => [],
        'prices' => [],
    ];

    $this->actingAs($admin)
        ->post(route('admin.projects.store'), [
            ...$base,
            'bid_dates' => [
                ['bid_date' => '2026-11-02', 'notes' => 'Original bid'],
                ['bid_date' => '2026-11-20', 'bid_time' => '14:30', 'notes' => 'Addendum 2 moved the bid'],
            ],
            'addendums' => [
                [
                    'number' => '2',
                    'issued_on' => '2026-11-12',
                    'notes' => 'Hardware spec revised',
                    'document' => UploadedFile::fake()->createWithContent('addendum-2.pdf', "%PDF-1.4\n%%EOF\n"),
                ],
                ['number' => '1', 'issued_on' => '2026-10-28', 'notes' => 'Drawing cloud'],
            ],
        ])
        ->assertSessionHasNoErrors();

    $project = Project::query()->where('name', 'Courthouse openings')->firstOrFail();
    $project->load(['bidDates.user', 'addendums.user']);

    expect($project->bidDates)->toHaveCount(2)
        ->and($project->bidDates->first()?->bid_date->toDateString())->toBe('2026-11-20')
        ->and(substr((string) $project->bidDates->first()?->bid_time, 0, 5))->toBe('14:30')
        ->and($project->bidDates->first()?->user_id)->toBe($admin->id)
        ->and($project->addendums->pluck('number')->all())->toBe(['1', '2']);

    $addendumWithFile = $project->addendums->firstWhere('number', '2');
    $storedDocument = (string) $addendumWithFile?->document_path;

    expect($addendumWithFile?->document_name)->toBe('addendum-2.pdf')
        ->and($storedDocument)->not->toBe('');

    Storage::disk('local')->assertExists($storedDocument);

    $this->actingAs($admin)
        ->get(route('admin.projects.addendums.document', [$project, $addendumWithFile?->uuid]))
        ->assertOk();

    $this->actingAs($admin)
        ->get(route('admin.projects.index', ['search' => 'Courthouse openings']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('projects.data.0.bid_dates.0.bid_date', '2026-11-20')
            ->where('projects.data.0.bid_dates.0.bid_time', '14:30')
            ->where('projects.data.0.bid_dates.0.notes', 'Addendum 2 moved the bid')
            ->where('projects.data.0.bid_dates.1.bid_date', '2026-11-02')
            ->where('projects.data.0.bid_dates.1.notes', 'Original bid')
            ->where('projects.data.0.addendums.0.number', '1')
            ->where('projects.data.0.addendums.0.issued_on', '2026-10-28')
            ->where('projects.data.0.addendums.1.number', '2')
            ->where('projects.data.0.addendums.1.issued_on', '2026-11-12')
        );

    $current = $project->bidDates->first();
    $earlier = $project->bidDates->last();
    $firstAddendum = $project->addendums->first();

    $this->actingAs($admin)
        ->patch(route('admin.projects.update', $project), [
            ...$base,
            'bid_dates' => [
                [
                    'id' => $current->id,
                    'bid_date' => '2026-11-20',
                    'notes' => 'Addendum 2 moved the bid',
                ],
                [
                    'id' => $earlier->id,
                    'bid_date' => '2026-11-02',
                    'notes' => 'Original bid',
                ],
                ['bid_date' => '2026-12-04', 'notes' => 'Owner postponed the opening'],
            ],
            'addendums' => [
                [
                    'id' => $firstAddendum->id,
                    'number' => '1',
                    'issued_on' => '2026-10-28',
                    'notes' => 'Drawing cloud',
                ],
            ],
        ])
        ->assertSessionHasNoErrors();

    $project->refresh()->load(['bidDates', 'addendums']);

    expect($project->bidDates)->toHaveCount(3)
        ->and($project->bidDates->first()?->bid_date->toDateString())->toBe('2026-12-04')
        ->and($project->addendums)->toHaveCount(1)
        ->and($project->addendums->first()?->number)->toBe('1');

    Storage::disk('local')->assertMissing($storedDocument);

    $this->actingAs($admin)
        ->patch(route('admin.projects.update', $project), [
            ...$base,
            'bid_dates' => [
                ['bid_date' => '2026-12-04', 'notes' => 'First'],
                ['bid_date' => '2026-12-04', 'notes' => 'Same day again'],
            ],
            'addendums' => [],
        ])
        ->assertSessionHasErrors('bid_dates.1.bid_date');

    $this->actingAs($admin)
        ->patch(route('admin.projects.update', $project), [
            ...$base,
            'bid_dates' => [
                ['bid_date' => '2026-12-04', 'bid_time' => '25:99', 'notes' => 'Bad time'],
            ],
            'addendums' => [],
        ])
        ->assertSessionHasErrors('bid_dates.0.bid_time');

    $this->actingAs($admin)
        ->patch(route('admin.projects.update', $project), [
            ...$base,
            'bid_dates' => [
                ['bid_date' => '2026-12-04', 'notes' => 'Kept'],
            ],
            'addendums' => [
                [
                    'number' => '9',
                    'issued_on' => '2026-12-01',
                    'notes' => 'Bad file',
                    'document' => UploadedFile::fake()->create('virus.exe', 20, 'application/octet-stream'),
                ],
            ],
        ])
        ->assertSessionHasErrors('addendums.0.document');

    expect($project->fresh()->bidDates)->toHaveCount(3);
});

test('formatted addendum notes are kept and an empty editor is stored blank', function () {
    $admin = projectAdmin();
    $base = [
        'name' => 'Addendum notes editor',
        'project_number' => '',
        'assigned_to' => '',
        'status_id' => projectStatusId(),
        'priority' => 'normal',
        'estimated_start_date' => '',
        'estimated_end_date' => '',
        'completed_at' => '',
        'public_notes' => '',
        'internal_notes' => '',
        'contractors' => [],
        'scopes' => [],
        'revisions' => [],
        'prices' => [],
        'bid_dates' => [],
    ];

    $this->actingAs($admin)
        ->post(route('admin.projects.store'), [
            ...$base,
            'addendums' => [
                [
                    'number' => '1',
                    'issued_on' => '2026-11-12',
                    'notes' => '<p>Hardware <strong>revised</strong></p><script>alert(1)</script>',
                ],
                [
                    'number' => '2',
                    'issued_on' => '2026-11-13',
                    'notes' => '<p></p>',
                ],
            ],
        ])
        ->assertSessionHasNoErrors();

    $project = Project::query()->where('name', 'Addendum notes editor')->firstOrFail();
    $formatted = $project->addendums->firstWhere('number', '1');
    $empty = $project->addendums->firstWhere('number', '2');

    expect($formatted?->notes)->toContain('<strong>revised</strong>')
        ->and($formatted?->notes)->not->toContain('script')
        ->and($empty?->notes)->toBeNull();
});

test('an addendum file fills its number, issued date, notes, and revised bid date', function () {
    $admin = projectAdmin();
    $file = UploadedFile::fake()->createWithContent('notice.txt', <<<'TXT'
ADDENDUM NO. 02
Issued: March 12, 2026
Subject: Hardware specification revised

The bid date is now April 2, 2026 at 2:00 PM.
TXT);

    $this->actingAs($admin)
        ->post(route('admin.projects.addendums.read'), ['document' => $file], ['Accept' => 'application/json'])
        ->assertOk()
        ->assertJsonPath('number', '2')
        ->assertJsonPath('issued_on', '2026-03-12')
        ->assertJsonPath('bid_date', '2026-04-02')
        ->assertJsonPath('bid_time', '14:00')
        ->assertJsonPath('notes', '<p>Hardware specification revised</p>');
});
