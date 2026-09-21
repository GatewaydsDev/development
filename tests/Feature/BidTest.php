<?php

use App\Models\Bid;
use App\Models\BidPricingStatus;
use App\Models\BidStageType;
use App\Models\BidTextField;
use App\Models\BidTextTemplate;
use App\Models\Contractor;
use App\Models\Product;
use App\Models\Project;
use App\Models\ProjectScopeType;
use App\Models\ProjectStatus;
use App\Models\Service;
use App\Models\TaxState;
use App\Models\User;
use App\Models\UserLevel;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\UploadedFile;
use Inertia\Testing\AssertableInertia as Assert;
use PhpOffice\PhpWord\IOFactory;
use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\SimpleType\Jc;

function bidAdmin(): User
{
    $level = UserLevel::firstOrCreate([
        'name' => UserLevel::SUPER_ADMIN,
    ]);

    return User::factory()->create([
        'level_id' => $level->id,
    ]);
}

function bidProject(User $admin, string $name = 'Secure Entry Package'): Project
{
    $contractor = Contractor::query()->firstOrCreate([
        'name' => 'Gateway Facilities',
    ]);

    $project = Project::create([
        'name' => $name,
        'project_status_id' => ProjectStatus::idFor('quoted'),
        'priority' => 'normal',
        'created_by' => $admin->id,
    ]);

    $project->contractors()->syncWithoutDetaching([$contractor->id]);

    return $project;
}

function bidService(string $name = 'Assembly w/ vision glazing'): Service
{
    return Service::query()->firstOrCreate(['name' => $name]);
}

function bidScopeType(string $name = 'Blast'): ProjectScopeType
{
    return ProjectScopeType::query()
        ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
        ->first() ?? ProjectScopeType::create(['name' => $name]);
}

test('the create bid page includes stages scopes and pricing catalogs', function () {
    $admin = bidAdmin();
    $project = bidProject($admin, 'Scoped Bid Project');
    $door = Product::create(['name' => 'RF door leaf', 'kind' => Product::KIND_DOOR]);
    $service = bidService();
    $project->scopes()->create([
        'scope_type' => 'radio_frequency_doors',
        'notes' => 'RF shielded pair',
        'product_id' => $door->id,
        'service_id' => $service->id,
    ]);
    $project->scopes()->create([
        'scope_type' => 'blast',
        'notes' => '',
    ]);

    $this->actingAs($admin)
        ->get(route('admin.bids.create'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Bids/Create')
            ->has('options.projects')
            ->has('options.projects.0.scopes', 2)
            ->where('options.projects.0.scopes.0.type', 'blast')
            ->where('options.projects.0.scopes.1.type', 'radio_frequency_doors')
            ->where('options.projects.0.scopes.1.name', 'Radio frequency doors')
            ->where('options.projects.0.scopes.1.product_id', $door->id)
            ->where('options.projects.0.scopes.1.service_id', $service->id)
            ->has('options.stageTypes')
            ->has('options.scopeTitles')
            ->has('options.products')
            ->has('options.services')
            ->has('options.pricingStatuses')
            ->has('options.scopeTextTemplates')
            ->has('options.shippingTextTemplates')
            ->where(
                'options.scopeTextTemplates',
                fn ($templates) => collect($templates)->contains(
                    fn ($item) => ($item['name'] ?? null) === 'Standard scope of work',
                ),
            )
            ->where(
                'options.shippingTextTemplates',
                fn ($templates) => collect($templates)->contains(
                    fn ($item) => ($item['name'] ?? null) === 'Standard shipping and handling',
                ),
            )
            ->has('options.company')
            ->has('options.assignees')
        );
});

test('the create bid page includes project state and product state prices', function () {
    $admin = bidAdmin();
    $project = bidProject($admin, 'New Jersey Bid Project');
    $project->update([
        'site_state' => 'NJ',
        'site_address_line_1' => '12 Dock Road',
        'site_city' => 'Newark',
        'site_postal_code' => '07102',
        'site_country' => 'US',
    ]);
    $newJersey = TaxState::query()->where('name', 'New Jersey')->firstOrFail();
    $newYork = TaxState::query()->where('name', 'New York')->firstOrFail();
    $door = Product::create([
        'name' => 'State priced door',
        'kind' => Product::KIND_DOOR,
    ]);
    $door->statePrices()->create([
        'tax_state_id' => $newJersey->id,
        'price' => 1000,
        'markup_percent' => 25,
    ]);
    $door->statePrices()->create([
        'tax_state_id' => $newYork->id,
        'price' => 2000,
        'markup_percent' => 10,
    ]);

    $this->actingAs($admin)
        ->get(route('admin.bids.create'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Bids/Create')
            ->where(
                'options.projects',
                fn ($projects) => collect($projects)->contains(
                    fn ($item) => ($item['name'] ?? null) === 'New Jersey Bid Project'
                        && ($item['site_state'] ?? null) === 'NJ'
                        && str_contains((string) ($item['site_address'] ?? ''), '12 Dock Road')
                        && str_contains((string) ($item['site_address'] ?? ''), 'Newark'),
                ),
            )
            ->where(
                'options.products',
                fn ($products) => collect($products)->contains(
                    fn ($product) => ($product['name'] ?? null) === 'State priced door'
                        && collect($product['state_prices'] ?? [])->contains(
                            fn ($row) => ($row['tax_state']['name'] ?? null) === 'New Jersey'
                                && (float) $row['price'] === 1000.0
                                && (float) $row['markup_percent'] === 25.0
                                && (float) $row['sell_price'] === 1250.0,
                        )
                        && (float) ($product['sell_price'] ?? 0) === 1250.0,
                ),
            )
        );
});

test('a bid stores quantity unit bid and computed extended', function () {
    $admin = bidAdmin();
    $project = bidProject($admin);
    $stage = BidStageType::query()->where('name', 'Preliminary Bid')->firstOrFail();
    $title = bidScopeType('RF Doors');
    $door = Product::create(['name' => 'RF door leaf', 'kind' => Product::KIND_DOOR]);
    $service = bidService();

    $this->actingAs($admin)
        ->post(route('admin.bids.store'), [
            'project_id' => $project->id,
            'stages' => [
                [
                    'stage_type_id' => $stage->id,
                    'stage_date' => '2026-09-01',
                    'notes' => '',
                ],
            ],
            'scopes' => [
                [
                    'title_id' => $title->id,
                    'notations' => '',
                    'products' => [
                        [
                            'product_id' => $door->id,
                            'service_id' => $service->id,
                            'location' => 'Bldg 19',
                            'quantity' => '2',
                            'unit_bid' => '1250',
                        ],
                    ],
                ],
            ],
        ])
        ->assertSessionHasNoErrors();

    $bid = Bid::query()
        ->where('project_id', $project->id)
        ->with('scopes.products')
        ->firstOrFail();

    $line = $bid->scopes->first()?->products->first();

    expect($line?->location)->toBe('Bldg 19');
    expect((float) $line?->quantity)->toBe(2.0);
    expect((float) $line?->unit_bid)->toBe(1250.0);
    expect((float) $line?->extended)->toBe(2500.0);
    expect((float) $bid->scopes->first()?->quantity)->toBe(2.0);
    expect((float) $bid->scopes->first()?->unit_bid)->toBe(1250.0);
    expect((float) $bid->scopes->first()?->extended)->toBe(2500.0);
    expect($bid->latestTotal())->toBe(2500.0);
});

test('a bid stores a custom product description without a catalog product', function () {
    $admin = bidAdmin();
    $project = bidProject($admin);
    $stage = BidStageType::query()->where('name', 'Preliminary Bid')->firstOrFail();
    $title = bidScopeType('RF Doors');

    $this->actingAs($admin)
        ->post(route('admin.bids.store'), [
            'project_id' => $project->id,
            'stages' => [
                [
                    'stage_type_id' => $stage->id,
                    'stage_date' => '2026-09-01',
                    'notes' => '',
                ],
            ],
            'scopes' => [
                [
                    'title_id' => $title->id,
                    'notations' => '',
                    'products' => [
                        [
                            'description' => '8x8 RF shielded blast door, LH, honeycomb core',
                            'location' => 'Bldg 19',
                            'quantity' => '2',
                            'unit_bid' => '1250',
                            'allocated_handling' => '150',
                        ],
                    ],
                ],
            ],
        ])
        ->assertSessionHasNoErrors();

    $bid = Bid::query()
        ->where('project_id', $project->id)
        ->with('scopes.products')
        ->firstOrFail();

    $line = $bid->scopes->first()?->products->first();

    expect($line?->product_id)->toBeNull();
    expect($line?->service_id)->toBeNull();
    expect($line?->description)->toBe('8x8 RF shielded blast door, LH, honeycomb core');
    expect($line?->location)->toBe('Bldg 19');
    expect((float) $line?->quantity)->toBe(2.0);
    expect((float) $line?->unit_bid)->toBe(1250.0);
    expect((float) $line?->allocated_handling)->toBe(150.0);
    expect((float) $line?->combined_price)->toBe(1400.0);
    expect((float) $line?->extended)->toBe(2800.0);
});

test('a bid building total is combined installed unit price times quantity', function () {
    $admin = bidAdmin();
    $project = bidProject($admin);
    $stage = BidStageType::query()->where('name', 'Preliminary Bid')->firstOrFail();
    $title = bidScopeType('RF Doors');

    $this->actingAs($admin)
        ->post(route('admin.bids.store'), [
            'project_id' => $project->id,
            'stages' => [
                [
                    'stage_type_id' => $stage->id,
                    'stage_date' => '2026-09-01',
                    'notes' => '',
                ],
            ],
            'scopes' => [
                [
                    'title_id' => $title->id,
                    'notations' => '',
                    'products' => [
                        [
                            'description' => 'Custom RF door, LH, honeycomb core',
                            'location' => 'Bldg 19',
                            'quantity' => '2',
                            'unit_bid' => '1250',
                            'allocated_handling' => '150',
                            'combined_price' => '1400',
                        ],
                    ],
                ],
            ],
        ])
        ->assertSessionHasNoErrors();

    $bid = Bid::query()
        ->where('project_id', $project->id)
        ->with('scopes.products')
        ->firstOrFail();

    $line = $bid->scopes->first()?->products->first();

    expect((float) $line?->combined_price)->toBe(1400.0);
    expect((float) $line?->extended)->toBe(2800.0);
    expect((float) $bid->scopes->first()?->extended)->toBe(2800.0);
    expect($bid->latestTotal())->toBe(2800.0);
});

test('a bid combined installed unit price is material plus allocated', function () {
    $admin = bidAdmin();
    $project = bidProject($admin);
    $stage = BidStageType::query()->where('name', 'Preliminary Bid')->firstOrFail();
    $title = bidScopeType('RF Doors');
    $door = Product::create(['name' => 'RF door leaf', 'kind' => Product::KIND_DOOR]);
    $service = bidService();

    $this->actingAs($admin)
        ->post(route('admin.bids.store'), [
            'project_id' => $project->id,
            'stages' => [
                [
                    'stage_type_id' => $stage->id,
                    'stage_date' => '2026-09-01',
                    'notes' => '',
                ],
            ],
            'scopes' => [
                [
                    'title_id' => $title->id,
                    'notations' => '',
                    'products' => [
                        [
                            'product_id' => $door->id,
                            'service_id' => $service->id,
                            'location' => 'Room 54',
                            'quantity' => '2',
                            'unit_bid' => '1250',
                            'allocated_handling' => '100',
                        ],
                    ],
                ],
            ],
        ])
        ->assertSessionHasNoErrors();

    $bid = Bid::query()
        ->where('project_id', $project->id)
        ->with('scopes.products')
        ->firstOrFail();

    $line = $bid->scopes->first()?->products->first();

    expect((float) $line?->quantity)->toBe(2.0);
    expect((float) $line?->unit_bid)->toBe(1250.0);
    expect((float) $line?->allocated_handling)->toBe(100.0);
    expect((float) $line?->combined_price)->toBe(1350.0);
    expect((float) $line?->extended)->toBe(2700.0);
    expect((float) $bid->scopes->first()?->extended)->toBe(2700.0);
    expect($bid->latestTotal())->toBe(2700.0);
});

test('project and bid scope dropdowns share the same catalog', function () {
    $admin = bidAdmin();

    $this->actingAs($admin)
        ->post(route('admin.project-scope-types.store'), [
            'name' => 'Shared SCIF doors',
        ])
        ->assertSessionHasNoErrors();

    $this->actingAs($admin)
        ->get(route('admin.projects.create'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('options.scopeTypes')
            ->where(
                'options.scopeTypes',
                fn ($types) => collect($types)->contains(
                    fn ($type) => ($type['name'] ?? null) === 'Shared SCIF doors',
                ),
            )
        );

    $this->actingAs($admin)
        ->get(route('admin.bids.create'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('options.scopeTitles')
            ->where(
                'options.scopeTitles',
                fn ($titles) => collect($titles)->contains(
                    fn ($title) => ($title['name'] ?? null) === 'Shared SCIF doors',
                ),
            )
        );
});

test('a bid can store revisions like a project', function () {
    $admin = bidAdmin();
    $project = bidProject($admin);
    $stage = BidStageType::query()->where('name', 'Preliminary Bid')->firstOrFail();
    $title = bidScopeType('RF Doors');
    $door = Product::create(['name' => 'RF door leaf', 'kind' => Product::KIND_DOOR]);
    $service = bidService();

    $this->actingAs($admin)
        ->post(route('admin.bids.store'), [
            'project_id' => $project->id,
            'stages' => [
                [
                    'stage_type_id' => $stage->id,
                    'stage_date' => '2026-09-01',
                    'notes' => '',
                ],
            ],
            'scopes' => [
                [
                    'title_id' => $title->id,
                    'notations' => '',
                    'products' => [
                        [
                            'product_id' => $door->id,
                            'service_id' => $service->id,
                            'quantity' => '1',
                            'unit_bid' => '100',
                        ],
                    ],
                ],
            ],
            'revisions' => [
                [
                    'number' => 'A',
                    'revision_date' => '2026-09-15',
                    'notes' => 'Issued for owner review',
                ],
            ],
        ])
        ->assertSessionHasNoErrors();

    $bid = Bid::query()
        ->where('project_id', $project->id)
        ->with('revisions.user')
        ->firstOrFail();

    expect($bid->revisions)->toHaveCount(1);
    expect($bid->revisions->first()?->number)->toBe('A');
    expect($bid->revisions->first()?->revision_date?->toDateString())->toBe('2026-09-15');
    expect($bid->revisions->first()?->notes)->toBe('Issued for owner review');
    expect($bid->revisions->first()?->user_id)->toBe($admin->id);

    $this->actingAs($admin)
        ->get(route('admin.bids.print', $bid))
        ->assertOk()
        ->assertDontSee('Bid revisions', false)
        ->assertDontSee('Issued for owner review', false);
});

test('a bid can be created with stages reusable scopes and pricing revisions', function () {
    $admin = bidAdmin();
    $project = bidProject($admin);
    $stage = BidStageType::query()->where('name', 'Preliminary Bid')->firstOrFail();
    $title = bidScopeType('RF Doors');
    $doorLeaf = Product::create(['name' => 'RF door leaf', 'kind' => Product::KIND_DOOR]);
    $frame = Product::create(['name' => 'RF frame', 'kind' => Product::KIND_PART]);
    $service = bidService();
    $status = BidPricingStatus::query()->where('name', 'Budget allowance')->firstOrFail();

    $response = $this
        ->actingAs($admin)
        ->post(route('admin.bids.store'), [
            'project_id' => $project->id,
            'assigned_to' => $admin->id,
            'notes' => 'First pass for the owner',
            'stages' => [
                [
                    'stage_type_id' => $stage->id,
                    'stage_date' => '2026-09-01',
                    'notes' => 'Issued for review',
                ],
            ],
            'scopes' => [
                [
                    'title_id' => $title->id,
                    'notations' => 'Include frames and hardware',
                    'products' => [
                        ['product_id' => $doorLeaf->id, 'service_id' => $service->id],
                        ['product_id' => $frame->id, 'service_id' => $service->id],
                    ],
                ],
            ],
            'pricings' => [
                [
                    'name' => 'Preliminary pricing',
                    'revision_date' => '2026-09-01',
                    'notes' => 'Initial numbers',
                    'items' => [
                        [
                            'description' => 'RF door package',
                            'pricing_basis' => 'Per opening',
                            'status_id' => $status->id,
                            'amount' => '12500.00',
                        ],
                    ],
                ],
            ],
        ]);

    $bid = Bid::query()
        ->where('project_id', $project->id)
        ->with(['stages.type', 'scopes.title', 'scopes.products', 'pricings.items.status'])
        ->firstOrFail();

    $response
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success', 'Bid created successfully.')
        ->assertRedirect(route('admin.bids.index', ['highlight' => $bid->id]));

    expect($bid->stages)->toHaveCount(1);
    expect($bid->stages->first()?->type?->name)->toBe('Preliminary Bid');
    expect($bid->scopes)->toHaveCount(1);
    expect($bid->scopes->first()?->title?->name)->toBe('RF Doors');
    expect($bid->scopes->first()?->notations)->toBe('Include frames and hardware');
    expect($bid->scopes->first()?->products)->toHaveCount(2);
    expect($bid->scopes->first()?->products->pluck('service_id')->unique()->values()->all())->toBe([$service->id]);
    expect($bid->scopes->first()?->products->first()?->description)->toBe('RF door leaf — Assembly w/ vision glazing');
    expect($bid->pricings)->toHaveCount(1);
    expect($bid->pricings->first()?->items)->toHaveCount(1);
    expect((float) $bid->pricings->first()?->items->first()?->amount)->toBe(12500.0);
    expect($bid->assigned_to)->toBe($admin->id);
});

test('a bid scope pairs a product with a service', function () {
    $admin = bidAdmin();
    $project = bidProject($admin);
    $title = bidScopeType('Blast');
    $door = Product::create([
        'name' => '8x8 blast door',
        'kind' => Product::KIND_DOOR,
    ]);
    $service = bidService();

    $this->actingAs($admin)
        ->post(route('admin.bids.store'), [
            'project_id' => $project->id,
            'notes' => '',
            'stages' => [],
            'scopes' => [
                [
                    'title_id' => $title->id,
                    'notations' => '',
                    'products' => [
                        ['product_id' => $door->id, 'service_id' => $service->id],
                    ],
                ],
            ],
            'pricings' => [],
        ])
        ->assertSessionHasNoErrors();

    $bid = Bid::query()->where('project_id', $project->id)->with('scopes.products.product', 'scopes.products.service')->firstOrFail();

    expect($bid->scopes->first()?->products)->toHaveCount(1);
    expect($bid->scopes->first()?->products->first()?->product?->name)->toBe('8x8 blast door');
    expect($bid->scopes->first()?->products->first()?->service?->name)->toBe('Assembly w/ vision glazing');
    expect($bid->scopes->first()?->products->first()?->description)->toBe('8x8 blast door — Assembly w/ vision glazing');
});

test('a bid scope can save rich text information', function () {
    $admin = bidAdmin();
    $project = bidProject($admin);
    $title = bidScopeType('Blast');
    $door = Product::create(['name' => '8x8 blast door', 'kind' => Product::KIND_DOOR]);
    $service = bidService();

    $this->actingAs($admin)
        ->post(route('admin.bids.store'), [
            'project_id' => $project->id,
            'notes' => '',
            'stages' => [],
            'scopes' => [
                [
                    'title_id' => $title->id,
                    'notations' => '<p>Include <strong>vision glazing</strong> at the opening.</p>',
                    'products' => [
                        ['product_id' => $door->id, 'service_id' => $service->id],
                    ],
                ],
            ],
            'pricings' => [],
        ])
        ->assertSessionHasNoErrors();

    $bid = Bid::query()->where('project_id', $project->id)->with('scopes')->firstOrFail();

    expect($bid->scopes->first()?->notations)->toContain('vision glazing');
    expect($bid->scopes->first()?->notations)->toContain('<strong>');
});

test('a bid can save rich text notes', function () {
    $admin = bidAdmin();
    $project = bidProject($admin);
    $title = bidScopeType('Blast');
    $door = Product::create(['name' => '8x8 blast door', 'kind' => Product::KIND_DOOR]);
    $service = bidService();

    $this->actingAs($admin)
        ->post(route('admin.bids.store'), [
            'project_id' => $project->id,
            'notes' => '<p>Owner wants <strong>weekend delivery</strong>.</p>',
            'stages' => [],
            'scopes' => [
                [
                    'title_id' => $title->id,
                    'notations' => '',
                    'products' => [
                        ['product_id' => $door->id, 'service_id' => $service->id],
                    ],
                ],
            ],
        ])
        ->assertSessionHasNoErrors();

    $bid = Bid::query()->where('project_id', $project->id)->firstOrFail();

    expect($bid->notes)->toContain('weekend delivery');
    expect($bid->notes)->toContain('<strong>');
});

test('a bid can be created from a project scope of work', function () {
    $admin = bidAdmin();
    $project = bidProject($admin, 'Project With Scopes');
    $project->scopes()->create([
        'scope_type' => 'radio_frequency_doors',
        'notes' => 'RF shielded pair',
    ]);
    $project->scopes()->create([
        'scope_type' => 'blast',
        'notes' => 'Blast rated opening',
    ]);
    $stage = BidStageType::query()->where('name', 'Preliminary Bid')->firstOrFail();
    $door = Product::create(['name' => 'RF door leaf', 'kind' => Product::KIND_DOOR]);
    $blastDoor = Product::create(['name' => 'Blast door', 'kind' => Product::KIND_DOOR]);
    $service = bidService();

    $this->actingAs($admin)
        ->post(route('admin.bids.store'), [
            'project_id' => $project->id,
            'notes' => '',
            'stages' => [
                [
                    'stage_type_id' => $stage->id,
                    'stage_date' => '',
                    'notes' => '',
                ],
            ],
            'scopes' => [
                [
                    'title_id' => '',
                    'scope_type' => 'radio_frequency_doors',
                    'notations' => 'RF shielded pair',
                    'products' => [
                        ['product_id' => $door->id, 'service_id' => $service->id],
                    ],
                ],
                [
                    'title_id' => '',
                    'scope_type' => 'blast',
                    'notations' => 'Owner requested extra notation',
                    'products' => [
                        ['product_id' => $blastDoor->id, 'service_id' => $service->id],
                    ],
                ],
            ],
            'pricings' => [],
        ])
        ->assertSessionHasNoErrors();

    $bid = Bid::query()
        ->where('project_id', $project->id)
        ->with(['scopes.title', 'scopes.products'])
        ->firstOrFail();

    expect($bid->scopes)->toHaveCount(2);
    expect($bid->scopes->pluck('title.name')->all())
        ->toEqualCanonicalizing(['Radio frequency doors', 'Blast']);
    expect($bid->scopes->first(fn ($scope) => $scope->title?->name === 'Radio frequency doors')?->notations)
        ->toBe('RF shielded pair');
    expect($bid->scopes->first(fn ($scope) => $scope->title?->name === 'Blast')?->products->first()?->product_id)
        ->toBe($blastDoor->id);
});

test('a bid scope can include the same product and service twice', function () {
    $admin = bidAdmin();
    $project = bidProject($admin, 'Duplicate Product Project');
    $stage = BidStageType::query()->where('name', 'Preliminary Bid')->firstOrFail();
    $title = bidScopeType('RF Doors');
    $door = Product::create(['name' => 'RF door leaf', 'kind' => Product::KIND_DOOR]);
    $service = bidService();

    $this->actingAs($admin)
        ->post(route('admin.bids.store'), [
            'project_id' => $project->id,
            'notes' => '',
            'stages' => [
                [
                    'stage_type_id' => $stage->id,
                    'stage_date' => '',
                    'notes' => '',
                ],
            ],
            'scopes' => [
                [
                    'title_id' => $title->id,
                    'scope_type' => '',
                    'notations' => '',
                    'products' => [
                        [
                            'product_id' => $door->id,
                            'service_id' => $service->id,
                            'quantity' => '2',
                            'unit_bid' => '1250',
                        ],
                        [
                            'product_id' => $door->id,
                            'service_id' => $service->id,
                            'quantity' => '1',
                            'unit_bid' => '1100',
                        ],
                    ],
                ],
            ],
            'pricings' => [],
        ])
        ->assertSessionHasNoErrors();

    $bid = Bid::query()
        ->where('project_id', $project->id)
        ->with('scopes.products')
        ->firstOrFail();

    $lines = $bid->scopes->first()?->products;

    expect($lines)->toHaveCount(2);
    expect((float) $lines[0]->quantity)->toBe(2.0);
    expect((float) $lines[0]->unit_bid)->toBe(1250.0);
    expect((float) $lines[0]->extended)->toBe(2500.0);
    expect((float) $lines[1]->quantity)->toBe(1.0);
    expect((float) $lines[1]->unit_bid)->toBe(1100.0);
    expect((float) $lines[1]->extended)->toBe(1100.0);
    expect((float) $bid->scopes->first()?->extended)->toBe(3600.0);
    expect($bid->latestTotal())->toBe(3600.0);
});

test('a bid scope can include the same product with different services', function () {
    $admin = bidAdmin();
    $project = bidProject($admin, 'Same Product Different Services');
    $title = bidScopeType('Blast');
    $door = Product::create(['name' => '8x8 blast door', 'kind' => Product::KIND_DOOR]);
    $assembly = bidService();
    $install = bidService('Installation');

    $this->actingAs($admin)
        ->post(route('admin.bids.store'), [
            'project_id' => $project->id,
            'notes' => '',
            'stages' => [],
            'scopes' => [
                [
                    'title_id' => $title->id,
                    'scope_type' => '',
                    'notations' => '',
                    'products' => [
                        ['product_id' => $door->id, 'service_id' => $assembly->id],
                        ['product_id' => $door->id, 'service_id' => $install->id],
                    ],
                ],
            ],
            'pricings' => [],
        ])
        ->assertSessionHasNoErrors();

    $bid = Bid::query()
        ->where('project_id', $project->id)
        ->with('scopes.products.service')
        ->firstOrFail();

    expect($bid->scopes->first()?->products)->toHaveCount(2);
    expect($bid->scopes->first()?->products->pluck('service.name')->all())
        ->toEqualCanonicalizing(['Assembly w/ vision glazing', 'Installation']);
});

test('a bid can update its stages scopes and pricing revisions', function () {
    $admin = bidAdmin();
    $project = bidProject($admin, 'Existing Bid Project');
    $preliminary = BidStageType::query()->where('name', 'Preliminary Bid')->firstOrFail();
    $revised = BidStageType::query()->where('name', 'Revised Bid')->firstOrFail();
    $title = bidScopeType('Hardware set');
    $lockset = Product::create(['name' => 'Locksets', 'kind' => Product::KIND_PART]);
    $service = bidService();
    $status = BidPricingStatus::query()->where('name', 'Firm')->firstOrFail();

    $bid = Bid::create([
        'project_id' => $project->id,
        'notes' => 'Original',
        'created_by' => $admin->id,
    ]);
    $bid->stages()->create([
        'bid_stage_type_id' => $preliminary->id,
        'sort_order' => 0,
    ]);

    $this->actingAs($admin)
        ->patch(route('admin.bids.update', $bid), [
            'project_id' => $project->id,
            'notes' => 'Updated owner set',
            'stages' => [
                [
                    'stage_type_id' => $revised->id,
                    'stage_date' => '2026-09-08',
                    'notes' => 'After comments',
                ],
            ],
            'scopes' => [
                [
                    'title_id' => $title->id,
                    'notations' => 'Owner selected finish',
                    'products' => [
                        ['product_id' => $lockset->id, 'service_id' => $service->id],
                    ],
                ],
            ],
            'pricings' => [
                [
                    'name' => 'Revision A',
                    'revision_date' => '2026-09-08',
                    'notes' => '',
                    'items' => [
                        [
                            'description' => 'Locksets',
                            'pricing_basis' => 'Lump sum',
                            'status_id' => $status->id,
                            'amount' => '2400',
                        ],
                    ],
                ],
            ],
        ])
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success', 'Bid updated successfully.')
        ->assertRedirect(route('admin.bids.index', ['highlight' => $bid->id]));

    $bid->refresh()->load(['stages.type', 'scopes.title', 'scopes.products', 'pricings.items']);

    expect($bid->notes)->toBe('Updated owner set');
    expect($bid->stages->first()?->type?->name)->toBe('Revised Bid');
    expect($bid->scopes->first()?->title?->name)->toBe('Hardware set');
    expect($bid->scopes->first()?->products->first()?->product_id)->toBe($lockset->id);
    expect($bid->scopes->first()?->products->first()?->service_id)->toBe($service->id);
    expect($bid->pricings->first()?->name)->toBe('Revision A');
});

test('reusable bid catalogs can be created and reused', function () {
    $admin = bidAdmin();

    $this->actingAs($admin)
        ->post(route('admin.bid-stage-types.store'), [
            'name' => 'Value engineering',
        ])
        ->assertSessionHasNoErrors();

    $this->actingAs($admin)
        ->post(route('admin.bid-scopes.store'), [
            'name' => 'Blast doors',
        ])
        ->assertSessionHasNoErrors();

    $this->actingAs($admin)
        ->post(route('admin.bid-pricing-statuses.store'), [
            'name' => 'Owner allowance',
        ])
        ->assertSessionHasNoErrors();

    $this->actingAs($admin)
        ->post(route('admin.bid-scopes.store'), [
            'name' => 'blast doors',
        ])
        ->assertSessionHasNoErrors();

    expect(BidStageType::query()->whereRaw('LOWER(name) = ?', ['value engineering'])->count())->toBe(1);
    expect(ProjectScopeType::query()->whereRaw('LOWER(name) = ?', ['blast doors'])->count())->toBe(1);
    expect(BidPricingStatus::query()->whereRaw('LOWER(name) = ?', ['owner allowance'])->count())->toBe(1);
});

test('reusable scope texts can be saved and reused', function () {
    $admin = bidAdmin();

    $this->actingAs($admin)
        ->post(route('admin.bid-text-templates.store'), [
            'kind' => 'scope',
            'name' => 'Owner cover letter',
            'body' => '<p>Thank you for the opportunity to bid on {{project_name}}.</p>',
        ])
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success', 'Scope text saved successfully.');

    $this->actingAs($admin)
        ->post(route('admin.bid-text-templates.store'), [
            'kind' => 'scope',
            'name' => 'owner cover letter',
            'body' => '<p>Updated letter for {{project_name}} at {{site_address}}.</p>',
        ])
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success', 'Scope text updated successfully.');

    expect(BidTextTemplate::query()->whereRaw('LOWER(name) = ?', ['owner cover letter'])->count())->toBe(1);
    expect(BidTextTemplate::query()->whereRaw('LOWER(name) = ?', ['owner cover letter'])->value('body'))
        ->toContain('{{site_address}}');
});

test('saving reusable bid text from the create page does not create a bid', function () {
    $admin = bidAdmin();
    $before = Bid::query()->count();

    $this->actingAs($admin)
        ->from(route('admin.bids.create'))
        ->post(route('admin.bid-text-templates.store'), [
            'kind' => 'scope',
            'name' => 'Standalone cover letter',
            'body' => '<p>Library-only text for {{project_name}}.</p>',
        ])
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success', 'Scope text saved successfully.');

    expect(Bid::query()->count())->toBe($before);
    expect(BidTextTemplate::query()->where('name', 'Standalone cover letter')->exists())->toBeTrue();
});

test('reusable scope texts can be saved and stored on a bid', function () {
    $admin = bidAdmin();
    $project = bidProject($admin, 'Scope Text Project');
    $title = bidScopeType('RF Doors');
    $door = Product::create(['name' => 'RF door leaf', 'kind' => Product::KIND_DOOR]);
    $service = bidService();

    $this->actingAs($admin)
        ->from(route('admin.bids.create'))
        ->post(route('admin.bid-text-templates.store'), [
            'kind' => 'scope',
            'name' => 'Standard RF scope',
            'body' => '<p>Install RF doors at {{project_name}}.</p>',
        ])
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success', 'Scope text saved successfully.');

    $template = BidTextTemplate::query()
        ->where('kind', BidTextTemplate::KIND_SCOPE)
        ->where('name', 'Standard RF scope')
        ->firstOrFail();

    $this->actingAs($admin)
        ->post(route('admin.bids.store'), [
            'project_id' => $project->id,
            'bid_scope_text_template_id' => $template->id,
            'scope_of_work_text' => '<p>Install RF doors at {{project_name}}.</p>',
            'scopes' => [
                [
                    'title_id' => $title->id,
                    'notations' => '',
                    'products' => [
                        ['product_id' => $door->id, 'service_id' => $service->id],
                    ],
                ],
            ],
        ])
        ->assertSessionHasNoErrors();

    $bid = Bid::query()->where('project_id', $project->id)->firstOrFail();

    expect($bid->bid_scope_text_template_id)->toBe($template->id);
    expect($bid->scope_of_work_text)->toContain('Scope Text Project');
    expect($bid->scopes)->toHaveCount(1);
});

test('shipping and scope texts can share the same name', function () {
    $admin = bidAdmin();

    $this->actingAs($admin)
        ->post(route('admin.bid-text-templates.store'), [
            'kind' => 'shipping',
            'name' => 'Shared wording',
            'body' => '<p>Shipping library text.</p>',
        ])
        ->assertSessionHasNoErrors();

    $this->actingAs($admin)
        ->post(route('admin.bid-text-templates.store'), [
            'kind' => 'scope',
            'name' => 'Shared wording',
            'body' => '<p>Scope library text.</p>',
        ])
        ->assertSessionHasNoErrors();

    expect(BidTextTemplate::query()->where('name', 'Shared wording')->count())->toBe(2);
    expect(
        BidTextTemplate::query()
            ->where('kind', BidTextTemplate::KIND_SHIPPING)
            ->where('name', 'Shared wording')
            ->value('body'),
    )->toContain('Shipping library text');
    expect(
        BidTextTemplate::query()
            ->where('kind', BidTextTemplate::KIND_SCOPE)
            ->where('name', 'Shared wording')
            ->value('body'),
    )->toContain('Scope library text');
});

test('a saved scope text can be created from the dropdown with only a name', function () {
    $admin = bidAdmin();

    $this->actingAs($admin)
        ->from(route('admin.bids.create'))
        ->post(route('admin.bid-text-templates.store'), [
            'kind' => 'scope',
            'name' => 'On-site RF doors',
        ])
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success', 'Scope text saved successfully.');

    $template = BidTextTemplate::query()
        ->where('kind', BidTextTemplate::KIND_SCOPE)
        ->where('name', 'On-site RF doors')
        ->firstOrFail();

    expect($template->body)->toContain('{{scope_of_work}}');
});

test('a saved shipping and handling text can be created with only a name', function () {
    $admin = bidAdmin();

    $this->actingAs($admin)
        ->from(route('admin.bids.create'))
        ->post(route('admin.bid-text-templates.store'), [
            'kind' => 'shipping',
            'name' => 'Freight excluded',
        ])
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success', 'Shipping and handling text saved successfully.');

    $template = BidTextTemplate::query()
        ->where('kind', BidTextTemplate::KIND_SHIPPING)
        ->where('name', 'Freight excluded')
        ->firstOrFail();

    expect($template->body)->toContain('{{project_name}}');
});

test('shipping and handling text can be stored on a bid', function () {
    $admin = bidAdmin();
    $project = bidProject($admin, 'Harbor Freight Project');

    $this->actingAs($admin)
        ->post(route('admin.bid-text-templates.store'), [
            'kind' => 'shipping',
            'name' => 'Weekend delivery',
            'body' => '<p>Freight excluded for {{project_name}}.</p>',
        ])
        ->assertSessionHasNoErrors();

    $template = BidTextTemplate::query()
        ->where('kind', BidTextTemplate::KIND_SHIPPING)
        ->where('name', 'Weekend delivery')
        ->firstOrFail();

    $this->actingAs($admin)
        ->post(route('admin.bids.store'), [
            'project_id' => $project->id,
            'bid_shipping_text_template_id' => $template->id,
            'notes' => '<p>Freight excluded for {{project_name}}.</p>',
            'scopes' => [],
        ])
        ->assertSessionHasNoErrors();

    $bid = Bid::query()->where('project_id', $project->id)->firstOrFail();

    expect($bid->bid_shipping_text_template_id)->toBe($template->id);
    expect($bid->notes)->toContain('Harbor Freight Project');
});

test('custom insert fields can be created and filled on a bid', function () {
    $admin = bidAdmin();
    $project = bidProject($admin, 'Custom Field Project');

    $title = bidScopeType('RF Doors');
    $door = Product::create(['name' => 'RF door leaf', 'kind' => Product::KIND_DOOR]);
    $service = bidService();

    $this->actingAs($admin)
        ->from(route('admin.bids.create'))
        ->post(route('admin.bid-text-fields.store'), [
            'name' => 'Doors total',
            'source' => 'latest_revision_total',
        ])
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success', 'Insert field added successfully.')
        ->assertSessionHas('created_text_field', fn ($field) => ($field['key'] ?? null) === 'doors_total');

    expect(BidTextField::query()->where('key', 'doors_total')->value('source'))
        ->toBe('latest_revision_total');

    $this->actingAs($admin)
        ->post(route('admin.bids.store'), [
            'project_id' => $project->id,
            'notes' => '<p>Coverage: {{doors_total}} for {{item_quantity}} items, {{latest_revision_total}}.</p>',
            'scopes' => [
                [
                    'title_id' => $title->id,
                    'notations' => '',
                    'products' => [
                        [
                            'product_id' => $door->id,
                            'service_id' => $service->id,
                            'quantity' => '4',
                            'unit_bid' => '1250',
                        ],
                    ],
                ],
            ],
        ])
        ->assertSessionHasNoErrors();

    $bid = Bid::query()->where('project_id', $project->id)->firstOrFail();

    expect($bid->notes)->toContain('$5,000.00');
    expect($bid->notes)->toContain('4 items');
    expect($bid->notes)->not->toContain('{{doors_total}}');
});

test('amount insert fields fill materials allocation and grand total', function () {
    $admin = bidAdmin();
    $project = bidProject($admin, 'Amount Fields Project');
    $title = bidScopeType('RF Doors');
    $door = Product::create(['name' => 'RF door leaf', 'kind' => Product::KIND_DOOR]);
    $service = bidService();

    $this->actingAs($admin)
        ->post(route('admin.bids.store'), [
            'project_id' => $project->id,
            'notes' => '<p>Materials {{materials}}. Allocation/install {{allocation_install}}. Installation {{installation}}. Grand {{grand_total}}. Building {{building_total}}. Unit {{material_unit_price}}. Allocated {{allocated_handling}}. Combined {{combined_price}}.</p>',
            'scopes' => [
                [
                    'title_id' => $title->id,
                    'notations' => '',
                    'products' => [
                        [
                            'product_id' => $door->id,
                            'service_id' => $service->id,
                            'quantity' => '2',
                            'unit_bid' => '1250',
                            'allocated_handling' => '150',
                        ],
                    ],
                ],
            ],
        ])
        ->assertSessionHasNoErrors();

    $bid = Bid::query()->where('project_id', $project->id)->firstOrFail();

    expect($bid->notes)->toContain('$2,500.00');
    expect($bid->notes)->toContain('$300.00');
    expect($bid->notes)->toContain('$2,800.00');
    expect($bid->notes)->toContain('$1,250.00');
    expect($bid->notes)->toContain('$150.00');
    expect($bid->notes)->toContain('$1,400.00');
    expect($bid->notes)->not->toContain('{{allocation_install}}');
    expect($bid->notes)->not->toContain('{{materials}}');
    expect($bid->notes)->not->toContain('{{grand_total}}');
});

test('reserved insert fields cannot be created', function () {
    $admin = bidAdmin();

    $this->actingAs($admin)
        ->post(route('admin.bid-text-fields.store'), [
            'name' => 'Project name',
            'source' => 'today',
        ])
        ->assertSessionHasErrors('name');

    $this->actingAs($admin)
        ->post(route('admin.bid-text-fields.store'), [
            'name' => 'Allocation/install',
            'source' => 'today',
        ])
        ->assertSessionHasErrors('name');

    expect(BidTextField::query()->count())->toBe(0);
});

test('a text file can be imported and saved as reusable scope text', function () {
    $admin = bidAdmin();
    $file = UploadedFile::fake()->createWithContent(
        'owner_cover_letter.txt',
        "Thank you for the opportunity to bid on {{project_name}}.\n\nPlease review this proposal.",
    );

    $this->actingAs($admin)
        ->from(route('admin.bids.create'))
        ->post(route('admin.bid-text-templates.import'), [
            'kind' => 'scope',
            'name' => 'Imported cover letter',
            'save' => 1,
            'file' => $file,
        ])
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success', 'Scope text imported and saved.')
        ->assertSessionHas('imported_scope_text');

    $template = BidTextTemplate::query()
        ->where('name', 'Imported cover letter')
        ->firstOrFail();

    expect($template->body)
        ->toContain('{{project_name}}')
        ->toContain('Please review this proposal');
});

test('an imported text can be used on a bid without saving it', function () {
    $admin = bidAdmin();
    $before = BidTextTemplate::query()->count();
    $file = UploadedFile::fake()->createWithContent(
        'one-off.html',
        '<p>One-off proposal for {{project_name}}.</p>',
    );

    $this->actingAs($admin)
        ->from(route('admin.bids.create'))
        ->post(route('admin.bid-text-templates.import'), [
            'kind' => 'scope',
            'save' => 0,
            'file' => $file,
        ])
        ->assertSessionHasNoErrors()
        ->assertSessionHas('imported_scope_text');

    expect(BidTextTemplate::query()->count())->toBe($before);
    expect(session('imported_scope_text'))->toContain('{{project_name}}');
    expect(session('imported_scope_text_template_id'))->toBeNull();
});

test('a word document can be imported as reusable bid text', function () {
    $admin = bidAdmin();
    $phpWord = new PhpWord;
    $phpWord->addSection()->addText('Word proposal for {{project_name}}.');
    $path = sys_get_temp_dir().'/bid-import-'.uniqid('', true).'.docx';
    IOFactory::createWriter($phpWord, 'Word2007')->save($path);

    $file = new UploadedFile(
        $path,
        'word-cover.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        null,
        true,
    );

    try {
        $this->actingAs($admin)
            ->from(route('admin.bids.create'))
            ->post(route('admin.bid-text-templates.import'), [
                'kind' => 'scope',
                'name' => 'Word cover letter',
                'save' => 1,
                'file' => $file,
            ])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success', 'Scope text imported and saved.');

        expect(BidTextTemplate::query()->where('name', 'Word cover letter')->value('body'))
            ->toContain('{{project_name}}');
    } finally {
        @unlink($path);
    }
});

test('imported word documents keep colors spacing and backgrounds', function () {
    $admin = bidAdmin();
    $phpWord = new PhpWord;
    $phpWord->addSection()->addText(
        'Styled proposal for {{project_name}}.',
        [
            'name' => 'Calibri',
            'size' => 14,
            'color' => 'C53030',
            'fgColor' => 'yellow',
            'bold' => true,
        ],
        [
            'alignment' => Jc::CENTER,
            'spaceAfter' => 400,
            'spaceBefore' => 200,
            'shading' => ['fill' => 'FFF2CC'],
        ],
    );
    $path = sys_get_temp_dir().'/bid-import-styled-'.uniqid('', true).'.docx';
    IOFactory::createWriter($phpWord, 'Word2007')->save($path);

    $file = new UploadedFile(
        $path,
        'styled-cover.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        null,
        true,
    );

    try {
        $this->actingAs($admin)
            ->from(route('admin.bids.create'))
            ->post(route('admin.bid-text-templates.import'), [
                'name' => 'Styled Word cover',
                'save' => 1,
                'file' => $file,
            ])
            ->assertSessionHasNoErrors();

        $body = (string) BidTextTemplate::query()->where('name', 'Styled Word cover')->value('body');

        expect($body)
            ->toContain('{{project_name}}')
            ->toContain('#c53030')
            ->toContain('#ffff00')
            ->toContain('#fff2cc')
            ->toContain('text-align: center')
            ->toContain('14pt')
            ->toContain('margin-bottom: 20pt')
            ->toContain('margin-top: 10pt');
    } finally {
        @unlink($path);
    }
});

test('imported html keeps stylesheet colors spacing and backgrounds', function () {
    $admin = bidAdmin();
    $file = UploadedFile::fake()->createWithContent(
        'styled-cover.html',
        <<<'HTML'
<!doctype html>
<html>
<head>
<style type="text/css">
.Normal { margin-bottom: 18pt; background-color: #FFF2CC; }
span.red { color: #C53030; }
span.hi { background-color: #ffff00; font-size: 14pt; }
</style>
</head>
<body>
<p class="Normal" style="text-align: center;">Hello <span class="red">{{project_name}}</span> <span class="hi">highlighted</span></p>
</body>
</html>
HTML,
    );

    $this->actingAs($admin)
        ->from(route('admin.bids.create'))
        ->post(route('admin.bid-text-templates.import'), [
            'name' => 'Styled HTML cover',
            'save' => 1,
            'file' => $file,
        ])
        ->assertSessionHasNoErrors();

    $body = (string) BidTextTemplate::query()->where('name', 'Styled HTML cover')->value('body');

    expect($body)
        ->toContain('{{project_name}}')
        ->toContain('#C53030')
        ->toContain('#ffff00')
        ->toContain('#FFF2CC')
        ->toContain('text-align: center')
        ->toContain('14pt')
        ->toContain('margin-bottom: 18pt')
        ->not->toContain('<style');
});

test('imported html keeps tables colored headers sections and separator lines', function () {
    $admin = bidAdmin();
    $file = UploadedFile::fake()->createWithContent(
        'layout-cover.html',
        <<<'HTML'
<table>
  <tr>
    <th style="background-color: #1F4E79; color: #ffffff;">Scope</th>
    <th style="background-color: #1F4E79; color: #ffffff;">Amount</th>
  </tr>
  <tr>
    <td>Doors</td>
    <td>$12,000</td>
  </tr>
</table>
<hr style="border-top: 4px solid #047857;">
<p style="background-color: #FFF2CC; padding: 10px;">Section for {{project_name}}</p>
HTML,
    );

    $this->actingAs($admin)
        ->from(route('admin.bids.create'))
        ->post(route('admin.bid-text-templates.import'), [
            'name' => 'Layout HTML cover',
            'save' => 1,
            'file' => $file,
        ])
        ->assertSessionHasNoErrors();

    $body = (string) BidTextTemplate::query()->where('name', 'Layout HTML cover')->value('body');

    expect($body)
        ->toContain('<table')
        ->toContain('<th')
        ->toContain('#1F4E79')
        ->toContain('#047857')
        ->toContain('#FFF2CC')
        ->toContain('<hr')
        ->toContain('{{project_name}}');
});

test('imported word documents keep table header colors', function () {
    $admin = bidAdmin();
    $phpWord = new PhpWord;
    $section = $phpWord->addSection();
    $table = $section->addTable();
    $table->addRow();
    $table->addCell(3000, ['bgColor' => '1F4E79'])->addText('Scope', ['color' => 'FFFFFF', 'bold' => true]);
    $table->addCell(3000, ['bgColor' => '1F4E79'])->addText('Amount', ['color' => 'FFFFFF', 'bold' => true]);
    $table->addRow();
    $table->addCell(3000)->addText('Doors');
    $table->addCell(3000)->addText('12000');
    $path = sys_get_temp_dir().'/bid-import-table-'.uniqid('', true).'.docx';
    IOFactory::createWriter($phpWord, 'Word2007')->save($path);

    $file = new UploadedFile(
        $path,
        'table-cover.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        null,
        true,
    );

    try {
        $this->actingAs($admin)
            ->from(route('admin.bids.create'))
            ->post(route('admin.bid-text-templates.import'), [
                'name' => 'Table Word cover',
                'save' => 1,
                'file' => $file,
            ])
            ->assertSessionHasNoErrors();

        $body = (string) BidTextTemplate::query()->where('name', 'Table Word cover')->value('body');

        expect($body)
            ->toContain('<table')
            ->toContain('#1f4e79')
            ->toContain('Scope')
            ->toContain('Doors');
    } finally {
        @unlink($path);
    }
});

test('a doc file can be imported as reusable bid text', function () {
    $admin = bidAdmin();
    $path = sys_get_temp_dir().'/bid-import-'.uniqid('', true).'.doc';
    file_put_contents(
        $path,
        "\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1".mb_convert_encoding(
            'Doc proposal for {{project_name}}.',
            'UTF-16LE',
            'UTF-8',
        ),
    );

    $file = new UploadedFile($path, 'doc-cover.doc', 'application/msword', null, true);

    try {
        $this->actingAs($admin)
            ->from(route('admin.bids.create'))
            ->post(route('admin.bid-text-templates.import'), [
                'kind' => 'scope',
                'name' => 'Doc cover letter',
                'save' => 1,
                'file' => $file,
            ])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success', 'Scope text imported and saved.');

        expect(BidTextTemplate::query()->where('name', 'Doc cover letter')->value('body'))
            ->toContain('{{project_name}}');
    } finally {
        @unlink($path);
    }
});

test('a pdf can be imported as reusable bid text', function () {
    $admin = bidAdmin();
    $path = sys_get_temp_dir().'/bid-import-'.uniqid('', true).'.pdf';
    file_put_contents(
        $path,
        Pdf::loadHTML('<html><body><p>PDF proposal for {{project_name}}.</p></body></html>')->output(),
    );

    $file = new UploadedFile($path, 'pdf-cover.pdf', 'application/pdf', null, true);

    try {
        $this->actingAs($admin)
            ->from(route('admin.bids.create'))
            ->post(route('admin.bid-text-templates.import'), [
                'kind' => 'scope',
                'name' => 'PDF cover letter',
                'save' => 1,
                'file' => $file,
            ])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success', 'Scope text imported and saved.');

        expect(BidTextTemplate::query()->where('name', 'PDF cover letter')->value('body'))
            ->toContain('{{project_name}}');
    } finally {
        @unlink($path);
    }
});

test('a bid can be printed and exported as pdf or word', function () {
    $admin = bidAdmin();
    $project = bidProject($admin, 'Harbor Print Package');
    $project->update([
        'project_number' => 'P-2026-PRINT',
        'site_address_line_1' => '12 Dock Road',
        'site_city' => 'Portsmouth',
        'site_state' => 'NH',
    ]);
    $contractor = Contractor::create(['name' => 'Turner Construction']);
    $project->contractors()->attach($contractor->id);
    $stage = BidStageType::query()->where('name', 'Preliminary Bid')->firstOrFail();
    $title = bidScopeType('RF Doors');
    $door = Product::create(['name' => 'RF door leaf', 'kind' => Product::KIND_DOOR]);
    $service = bidService();

    $representative = User::factory()->create([
        'name' => 'Jordan Hale',
        'level_id' => $admin->level_id,
    ]);

    $this->actingAs($admin)
        ->post(route('admin.bids.store'), [
            'project_id' => $project->id,
            'assigned_to' => $representative->id,
            'notes' => 'Owner review draft',
            'scope_of_work_text' => '<p>Furnish and install RF doors for Harbor Print Package.</p>',
            'stages' => [
                [
                    'stage_type_id' => $stage->id,
                    'stage_date' => '2026-09-01',
                    'notes' => 'Issued for review',
                ],
            ],
            'scopes' => [
                [
                    'title_id' => $title->id,
                    'notations' => '<p>Include frames and hardware</p>',
                    'products' => [
                        [
                            'product_id' => $door->id,
                            'service_id' => $service->id,
                            'quantity' => '2',
                            'unit_bid' => '1250',
                            'allocated_handling' => '150',
                        ],
                    ],
                ],
            ],
        ])
        ->assertSessionHasNoErrors();

    $bid = Bid::query()->where('project_id', $project->id)->firstOrFail();

    $this->actingAs($admin)
        ->get(route('admin.bids.print', $bid))
        ->assertOk()
        ->assertSee('Bid', false)
        ->assertSee('Gateway Door Systems', false)
        ->assertSee('Harbor Print Package', false)
        ->assertSee('Project information', false)
        ->assertDontSee('Revised bid', false)
        ->assertDontSee('Issued for review', false)
        ->assertSee('P-2026-PRINT', false)
        ->assertSee('12 Dock Road', false)
        ->assertDontSee('Bid revisions', false)
        ->assertDontSee('Bid application text', false)
        ->assertDontSee('Proposal for Harbor Print Package.', false)
        ->assertSee('Furnish and install RF doors for Harbor Print Package.', false)
        ->assertSee('RF Doors', false)
        ->assertDontSee('Location', false)
        ->assertSee('Product Description', false)
        ->assertSee('Qty', false)
        ->assertSee('Material Unit Price', false)
        ->assertSee('Combined Installed Unit Price', false)
        ->assertSee('Building Total', false)
        ->assertDontSee('Include frames and hardware', false)
        ->assertSee('Assembly w/ vision glazing', false)
        ->assertSee('RF door leaf', false)
        ->assertSee('$1,250.00', false)
        ->assertSee('$150.00', false)
        ->assertSee('$1,400.00', false)
        ->assertSee('$2,500.00', false)
        ->assertSee('$300.00', false)
        ->assertSee('$2,800.00', false)
        ->assertSee('Materials', false)
        ->assertSee('Installation', false)
        ->assertSee('Grand total', false)
        ->assertDontSee('Product / work subtotal', false)
        ->assertDontSee('Bid total', false)
        ->assertSee('Owner review draft', false)
        ->assertSee('Submitted by', false)
        ->assertSee('Authorized representative', false)
        ->assertSee('Jordan Hale', false)
        ->assertSee('Authorization', false)
        ->assertSee('Signature', false)
        ->assertSee(now()->format('F j, Y'), false)
        ->assertSee('Accepted by', false)
        ->assertSee('Print bid', false)
        ->assertDontSee('Preliminary pricing', false)
        ->assertDontSee('>Stages<', false)
        ->assertSee('Word 2026', false)
        ->assertSee('data:image', false)
        ->assertSee('Gateway Facilities', false)
        ->assertSee('Turner Construction', false);

    $pdf = $this->actingAs($admin)
        ->get(route('admin.bids.export.pdf', $bid));

    $pdf->assertOk();
    $pdf->assertHeader('content-disposition');
    expect((string) $pdf->headers->get('content-type'))->toStartWith('application/pdf');
    expect((string) $pdf->headers->get('content-disposition'))->toContain('bid-p-2026-print-'.$bid->id.'.pdf');
    expect($pdf->getContent())->toStartWith('%PDF');

    $word = $this->actingAs($admin)
        ->get(route('admin.bids.export.word', $bid));

    $word->assertOk();
    expect((string) $word->headers->get('content-type'))->toContain('wordprocessingml.document');
    expect((string) $word->headers->get('content-disposition'))->toContain('bid-p-2026-print-'.$bid->id.'.docx');
});

test('printed scope tables omit the empty information placeholder', function () {
    $admin = bidAdmin();
    $project = bidProject($admin, 'Harbor Empty Notes');
    $title = bidScopeType('RF Doors');
    $door = Product::create(['name' => 'RF door leaf', 'kind' => Product::KIND_DOOR]);
    $service = bidService();

    $this->actingAs($admin)
        ->post(route('admin.bids.store'), [
            'project_id' => $project->id,
            'scopes' => [
                [
                    'title_id' => $title->id,
                    'notations' => '',
                    'products' => [
                        [
                            'product_id' => $door->id,
                            'service_id' => $service->id,
                            'quantity' => '1',
                            'unit_bid' => '100',
                        ],
                    ],
                ],
            ],
        ])
        ->assertSessionHasNoErrors();

    $bid = Bid::query()->where('project_id', $project->id)->firstOrFail();

    $this->actingAs($admin)
        ->get(route('admin.bids.print', $bid))
        ->assertOk()
        ->assertSee('RF door leaf', false)
        ->assertSee('Product Description', false)
        ->assertDontSee('Location', false)
        ->assertDontSee('No information added', false);
});

test('printed scope tables include location when it is set', function () {
    $admin = bidAdmin();
    $project = bidProject($admin, 'Harbor Located Package');
    $title = bidScopeType('RF Doors');
    $door = Product::create(['name' => 'RF door leaf', 'kind' => Product::KIND_DOOR]);
    $service = bidService();

    $this->actingAs($admin)
        ->post(route('admin.bids.store'), [
            'project_id' => $project->id,
            'scopes' => [
                [
                    'title_id' => $title->id,
                    'notations' => '',
                    'products' => [
                        [
                            'product_id' => $door->id,
                            'service_id' => $service->id,
                            'location' => 'Bldg 19',
                            'quantity' => '1',
                            'unit_bid' => '100',
                        ],
                    ],
                ],
            ],
        ])
        ->assertSessionHasNoErrors();

    $bid = Bid::query()->where('project_id', $project->id)->firstOrFail();

    $this->actingAs($admin)
        ->get(route('admin.bids.print', $bid))
        ->assertOk()
        ->assertSee('Location', false)
        ->assertSee('Bldg 19', false);
});

test('the bid list can be printed and exported as pdf or word', function () {
    $admin = bidAdmin();
    $listed = bidProject($admin, 'Harbor Directory Package');
    Bid::create([
        'project_id' => $listed->id,
        'created_by' => $admin->id,
        'notes' => 'Owner review draft',
    ]);
    $contractor = Contractor::create(['name' => 'Turner Construction']);
    $listed->contractors()->attach($contractor->id);
    $hidden = bidProject($admin, 'Hidden Warehouse Fit-out');
    Bid::create([
        'project_id' => $hidden->id,
        'created_by' => $admin->id,
    ]);

    $this->actingAs($admin)
        ->get(route('admin.bids.list.print', ['search' => 'Harbor Directory']))
        ->assertOk()
        ->assertSee('Bid directory', false)
        ->assertSee('Gateway Door Systems', false)
        ->assertSee('Harbor Directory Package', false)
        ->assertSee('Gateway Facilities', false)
        ->assertSee('Turner Construction', false)
        ->assertSee('data:image', false)
        ->assertDontSee('Hidden Warehouse Fit-out', false);

    $pdf = $this->actingAs($admin)
        ->get(route('admin.bids.list.export.pdf', ['search' => 'Harbor Directory']));

    $pdf->assertOk();
    $pdf->assertHeader('content-disposition');
    expect((string) $pdf->headers->get('content-type'))->toStartWith('application/pdf');
    expect($pdf->getContent())->toStartWith('%PDF');
    expect((string) $pdf->headers->get('content-disposition'))->toContain('bid-directory-'.now()->year.'.pdf');

    $word = $this->actingAs($admin)
        ->get(route('admin.bids.list.export.word'));

    $word->assertOk();
    expect((string) $word->headers->get('content-type'))->toContain('wordprocessingml.document');
    expect((string) $word->headers->get('content-disposition'))->toContain('bid-directory-'.now()->year.'.docx');
});

test('a bid can be deleted', function () {
    $admin = bidAdmin();
    $project = bidProject($admin, 'Delete Me');
    $bid = Bid::create([
        'project_id' => $project->id,
        'created_by' => $admin->id,
    ]);

    $this->actingAs($admin)
        ->delete(route('admin.bids.destroy', $bid))
        ->assertRedirect(route('admin.bids.index'))
        ->assertSessionHas('success', 'Bid removed successfully.');

    expect(Bid::query()->whereKey($bid->id)->exists())->toBeFalse();
});

test('the bids index page includes a summarization of all bids ordered by bid stage', function () {
    $admin = bidAdmin();
    $stageEstimating = BidStageType::create(['name' => 'Estimating']);
    $stageWon = BidStageType::create(['name' => 'Won']);
    $stageDraft = BidStageType::create(['name' => 'Draft']);
    $scopeTitle = \App\Models\BidScopeTitle::create(['name' => 'Doors']);

    $project1 = bidProject($admin, 'Project 1');
    $bid1 = Bid::create([
        'project_id' => $project1->id,
        'created_by' => $admin->id,
    ]);
    $bid1->stages()->create([
        'bid_stage_type_id' => $stageWon->id,
        'stage_date' => '2026-03-01',
    ]);
    $bid1->scopes()->create([
        'bid_scope_title_id' => $scopeTitle->id,
        'extended' => 5000.00,
    ]);

    $project2 = bidProject($admin, 'Project 2');
    $bid2 = Bid::create([
        'project_id' => $project2->id,
        'created_by' => $admin->id,
    ]);
    $bid2->stages()->create([
        'bid_stage_type_id' => $stageDraft->id,
        'stage_date' => '2026-03-02',
    ]);
    $bid2->scopes()->create([
        'bid_scope_title_id' => $scopeTitle->id,
        'extended' => 3000.00,
    ]);

    $project3 = bidProject($admin, 'Project 3');
    $bid3 = Bid::create([
        'project_id' => $project3->id,
        'created_by' => $admin->id,
    ]);
    $bid3->stages()->create([
        'bid_stage_type_id' => $stageDraft->id,
        'stage_date' => '2026-03-03',
    ]);
    $bid3->scopes()->create([
        'bid_scope_title_id' => $scopeTitle->id,
        'extended' => 2000.00,
    ]);

    $response = $this->actingAs($admin)
        ->get(route('admin.bids.index'));

    $response->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Bids/Index')
            ->has('summary')
            ->where('summary.total_count', 3)
            ->where('summary.total_amount', 10000)
            ->where('summary.formatted_total_amount', '$10,000.00')
            ->has('summary.stages', 2)
            ->where('summary.stages.0.stage', 'Draft')
            ->where('summary.stages.0.count', 2)
            ->where('summary.stages.0.total_amount', 5000)
            ->where('summary.stages.0.formatted_total', '$5,000.00')
            ->where('summary.stages.1.stage', 'Won')
            ->where('summary.stages.1.count', 1)
            ->where('summary.stages.1.total_amount', 5000)
            ->where('summary.stages.1.formatted_total', '$5,000.00')
        );
});
