<?php

use App\Models\Bid;
use App\Models\BidTextTemplate;
use App\Models\Contractor;
use App\Models\Product;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\Quotation;
use App\Models\QuotationField;
use App\Models\QuotationTitle;
use App\Models\User;
use App\Models\UserLevel;
use Inertia\Testing\AssertableInertia as Assert;

function quotationAdmin(): User
{
    $level = UserLevel::firstOrCreate([
        'name' => UserLevel::SUPER_ADMIN,
    ]);

    return User::factory()->create([
        'level_id' => $level->id,
    ]);
}

function quotationProject(User $admin, string $name = 'Quoted Entry Package'): Project
{
    $contractor = Contractor::query()->firstOrCreate([
        'name' => 'Harbor Facilities',
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

function makeQuotation(User $admin, ?Project $project = null, array $overrides = []): Quotation
{
    $contractorId = $project?->contractors()->first()?->id
        ?? Contractor::query()->firstOrCreate(['name' => 'Harbor Facilities'])->id;

    $quotation = Quotation::create(array_merge([
        'contractor_id' => $contractorId,
        'project_id' => $project?->id,
        'title' => 'RF door quotation',
        'status' => 'draft',
        'quoted_at' => '2026-09-15',
        'notes' => 'Lead time two weeks.',
        'created_by' => $admin->id,
    ], $overrides));

    $quotation->lineItems()->create([
        'description' => 'RF door leaf',
        'quantity' => 2,
        'unit_price' => 1250,
        'extended' => 1250,
        'sort_order' => 0,
    ]);

    return $quotation->fresh(['lineItems', 'project', 'contractor']);
}

test('an admin can save a quotation for a contractor', function () {
    $admin = quotationAdmin();
    $project = quotationProject($admin);
    $contractorId = $project->contractors()->first()?->id;

    $this->actingAs($admin)
        ->post(route('admin.quotations.store'), [
            'contractor_id' => $contractorId,
            'project_id' => $project->id,
            'title' => 'Harbor RF quote',
            'status' => 'sent',
            'quoted_at' => '2026-09-15',
            'valid_until' => '2026-10-15',
            'notes' => 'Includes hardware.',
            'pricing_conditions' => '<p>Net 30. Freight excluded.</p>',
            'pricing_basis' => '<p>Based on {{project_name}} and {{base_bid_total}}.</p>',
            'line_items' => [
                [
                    'description' => 'RF door leaf',
                    'quantity' => '2',
                    'size' => '3x7',
                    'unit_price' => '1250',
                ],
            ],
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    $quotation = Quotation::query()->where('title', 'Harbor RF quote')->firstOrFail();

    expect($quotation->contractor_id)->toBe($contractorId)
        ->and($quotation->project_id)->toBe($project->id)
        ->and($quotation->status)->toBe('sent')
        ->and($quotation->quotation_number)->toStartWith('GDS-Q-')
        ->and($quotation->lineItems)->toHaveCount(1)
        ->and($quotation->lineItems->first()->size)->toBe('3x7')
        ->and((float) $quotation->lineItems->first()->extended)->toBe(1250.0)
        ->and($quotation->pricing_conditions)->toContain('Net 30')
        ->and($quotation->pricing_conditions)->toContain('<p>')
        ->and($quotation->pricing_basis)->toContain('{{project_name}}')
        ->and($quotation->pricing_basis)->toContain('{{base_bid_total}}');

    $this->actingAs($admin)
        ->get(route('admin.quotations.print', $quotation))
        ->assertOk()
        ->assertSee('Pricing Basis', false)
        ->assertSee($project->name, false)
        ->assertSee('Authorization', false)
        ->assertSee('Submitted by', false)
        ->assertSee('Accepted by', false);

    expect(QuotationTitle::query()->where('name', 'Harbor RF quote')->exists())->toBeTrue();
});

test('an admin can add a reusable quotation title', function () {
    $admin = quotationAdmin();

    $this->actingAs($admin)
        ->from(route('admin.quotations.create'))
        ->post(route('admin.quotation-titles.store'), [
            'name' => 'Standard RF quotation',
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('admin.quotations.create'));

    expect(QuotationTitle::query()->where('name', 'Standard RF quotation')->exists())->toBeTrue();
});

test('an admin can save reusable quotation texts', function () {
    $admin = quotationAdmin();

    $this->actingAs($admin)
        ->from(route('admin.quotations.create'))
        ->post(route('admin.bid-text-templates.store'), [
            'name' => 'Standard bid proposal',
            'kind' => BidTextTemplate::KIND_QUOTATION_PROPOSAL,
            'body' => '<p>Based on the approved proposal.</p>',
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('admin.quotations.create'));

    $this->actingAs($admin)
        ->from(route('admin.quotations.create'))
        ->post(route('admin.bid-text-templates.store'), [
            'name' => 'Standard pricing terms',
            'kind' => BidTextTemplate::KIND_QUOTATION_PRICING,
            'body' => '<p>Net 30. Freight excluded.</p>',
        ])
        ->assertSessionHasNoErrors();

    $this->actingAs($admin)
        ->from(route('admin.quotations.create'))
        ->post(route('admin.bid-text-templates.store'), [
            'name' => 'Standard pricing basis',
            'kind' => BidTextTemplate::KIND_QUOTATION_PRICING_BASIS,
            'body' => '<p>Based on {{project_name}} and {{base_bid_total}}.</p>',
        ])
        ->assertSessionHasNoErrors();

    $this->actingAs($admin)
        ->get(route('admin.quotations.create'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Quotations/Create')
            ->has('options.proposalTextTemplates', 1)
            ->where('options.proposalTextTemplates.0.name', 'Standard bid proposal')
            ->has('options.pricingTextTemplates', 1)
            ->where('options.pricingTextTemplates.0.name', 'Standard pricing terms')
            ->has('options.pricingBasisTextTemplates', 1)
            ->where('options.pricingBasisTextTemplates.0.name', 'Standard pricing basis'));

    expect(BidTextTemplate::query()->where('kind', BidTextTemplate::KIND_QUOTATION_PROPOSAL)->count())->toBe(1)
        ->and(BidTextTemplate::query()->where('kind', BidTextTemplate::KIND_QUOTATION_PRICING)->count())->toBe(1)
        ->and(BidTextTemplate::query()->where('kind', BidTextTemplate::KIND_QUOTATION_PRICING_BASIS)->count())->toBe(1);
});

test('a quotation can be saved from an existing title', function () {
    $admin = quotationAdmin();
    $project = quotationProject($admin);
    $contractorId = $project->contractors()->first()?->id;
    $title = QuotationTitle::firstOrCreateByName('Catalog RF title');

    $this->actingAs($admin)
        ->post(route('admin.quotations.store'), [
            'contractor_id' => $contractorId,
            'project_id' => $project->id,
            'title_id' => $title->id,
            'status' => 'draft',
            'line_items' => [
                [
                    'description' => 'RF door leaf',
                    'quantity' => '1',
                    'unit_price' => '1000',
                ],
            ],
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    $quotation = Quotation::query()->where('title', 'Catalog RF title')->firstOrFail();

    expect($quotation->title)->toBe('Catalog RF title')
        ->and(QuotationTitle::query()->where('name', 'Catalog RF title')->count())->toBe(1);
});

test('a quotation stores the selected contractor contacts', function () {
    $admin = quotationAdmin();
    $project = quotationProject($admin);
    $contractor = $project->contractors()->firstOrFail();
    $primary = $contractor->contacts()->create([
        'name' => 'Alex Rivera',
        'title' => 'Project manager',
        'email' => 'alex@harbor.example',
        'is_primary' => true,
    ]);
    $secondary = $contractor->contacts()->create([
        'name' => 'Jordan Lee',
        'title' => 'Estimator',
        'email' => 'jordan@harbor.example',
        'is_primary' => false,
    ]);

    $this->actingAs($admin)
        ->post(route('admin.quotations.store'), [
            'contractor_id' => $contractor->id,
            'project_id' => $project->id,
            'title' => 'Harbor contacts quote',
            'status' => 'draft',
            'contact_ids' => [$secondary->id],
            'line_items' => [
                [
                    'description' => 'RF door leaf',
                    'quantity' => '1',
                    'unit_price' => '1000',
                ],
            ],
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    $quotation = Quotation::query()->where('title', 'Harbor contacts quote')->firstOrFail();

    expect($quotation->contacts->pluck('id')->all())->toBe([$secondary->id])
        ->and($quotation->contacts->pluck('id')->all())->not->toContain($primary->id);

    $this->actingAs($admin)
        ->get(route('admin.quotations.show', $quotation))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Quotations/Show')
            ->where('quotation.title', 'Harbor contacts quote')
            ->where('quotation.contacts.0.id', $secondary->id)
            ->has('options.titles'));
});

test('converting a quotation attaches the contractor to a project that has none', function () {
    $admin = quotationAdmin();
    $project = Project::create([
        'name' => 'Unassigned job',
        'project_status_id' => ProjectStatus::idFor('quoted'),
        'priority' => 'normal',
        'created_by' => $admin->id,
    ]);
    $quotation = makeQuotation($admin, $project);

    expect($project->fresh('contractors')->contractors)->toHaveCount(0)
        ->and($quotation->contractor_id)->not->toBeNull();

    $this->actingAs($admin)
        ->post(route('admin.quotations.convert-to-bid', $quotation))
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    expect($project->fresh('contractors')->contractors->pluck('id')->all())
        ->toContain($quotation->contractor_id);
});

test('converting a quotation without a project is rejected', function () {
    $admin = quotationAdmin();
    $quotation = makeQuotation($admin);

    $this->actingAs($admin)
        ->from(route('admin.quotations.show', $quotation))
        ->post(route('admin.quotations.convert-to-bid', $quotation))
        ->assertRedirect(route('admin.quotations.show', $quotation))
        ->assertSessionHasErrors('project_id');

    expect(Bid::query()->count())->toBe(0)
        ->and($quotation->fresh()->converted_bid_id)->toBeNull();
});

test('converting a quotation creates a linked bid and keeps the quote', function () {
    $admin = quotationAdmin();
    $project = quotationProject($admin, 'Harbor RF Upgrade');
    $quotation = makeQuotation($admin, $project);

    $this->actingAs($admin)
        ->post(route('admin.quotations.convert-to-bid', $quotation))
        ->assertRedirect();

    $quotation->refresh();
    $bid = Bid::query()->where('quotation_id', $quotation->id)->firstOrFail();

    expect($quotation->converted_bid_id)->toBe($bid->id)
        ->and($bid->project_id)->toBe($project->id)
        ->and($bid->scope_of_work_text)->toContain('RF door leaf')
        ->and($bid->scope_of_work_text)->toContain($quotation->quotation_number)
        ->and($bid->pricings)->toHaveCount(1)
        ->and($bid->pricings->first()->items)->toHaveCount(1)
        ->and($bid->scopes)->toHaveCount(1)
        ->and((float) $bid->scopes->first()->extended)->toBe(1250.0)
        ->and(Quotation::query()->whereKey($quotation->id)->exists())->toBeTrue();

    $this->actingAs($admin)
        ->get(route('admin.bids.edit', $bid))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Bids/Edit')
            ->where('bid.quotation.id', $quotation->id)
            ->where('bid.quotation.quotation_number', $quotation->quotation_number));
});

test('converting a quotation twice reuses the existing bid', function () {
    $admin = quotationAdmin();
    $project = quotationProject($admin);
    $quotation = makeQuotation($admin, $project);

    $this->actingAs($admin)
        ->post(route('admin.quotations.convert-to-bid', $quotation))
        ->assertRedirect();

    $bidId = $quotation->fresh()->converted_bid_id;

    $this->actingAs($admin)
        ->post(route('admin.quotations.convert-to-bid', $quotation))
        ->assertRedirect(route('admin.bids.edit', $bidId));

    expect(Bid::query()->where('quotation_id', $quotation->id)->count())->toBe(1);
});

test('the add bid form can import a saved quotation', function () {
    $admin = quotationAdmin();
    $project = quotationProject($admin, 'Importable Quote Project');
    $quotation = makeQuotation($admin, $project, ['title' => 'Importable quote']);

    $this->actingAs($admin)
        ->get(route('admin.bids.create', ['quotation' => $quotation->id]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Bids/Create')
            ->where('importQuotationId', $quotation->id)
            ->has('options.quotations', 1)
            ->where('options.quotations.0.id', $quotation->id)
            ->where('options.quotations.0.project_id', $project->id)
            ->where('options.quotations.0.line_items.0.description', 'RF door leaf'));
});

test('a bid can be saved with a linked quotation without converting it', function () {
    $admin = quotationAdmin();
    $project = quotationProject($admin);
    $quotation = makeQuotation($admin, $project);

    $this->actingAs($admin)
        ->post(route('admin.bids.store'), [
            'project_id' => $project->id,
            'quotation_id' => $quotation->id,
            'notes' => 'Imported shipping notes',
            'scope_of_work_text' => '<p>RF door leaf</p>',
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    $bid = Bid::query()->where('project_id', $project->id)->firstOrFail();

    expect($bid->quotation_id)->toBe($quotation->id)
        ->and($quotation->fresh()->converted_bid_id)->toBeNull()
        ->and($quotation->fresh()->title)->toBe('RF door quotation');
});

test('a quotation can store revisions like a bid', function () {
    $admin = quotationAdmin();
    $project = quotationProject($admin);
    $contractorId = $project->contractors()->first()?->id;

    $this->actingAs($admin)
        ->post(route('admin.quotations.store'), [
            'contractor_id' => $contractorId,
            'project_id' => $project->id,
            'title' => 'Harbor revision quote',
            'status' => 'draft',
            'line_items' => [
                [
                    'description' => 'RF door leaf',
                    'quantity' => '1',
                    'unit_price' => '1000',
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
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    $quotation = Quotation::query()
        ->where('title', 'Harbor revision quote')
        ->with('revisions.user')
        ->firstOrFail();

    expect($quotation->revisions)->toHaveCount(1)
        ->and($quotation->revisions->first()?->number)->toBe('A')
        ->and($quotation->revisions->first()?->revision_date?->toDateString())->toBe('2026-09-15')
        ->and($quotation->revisions->first()?->notes)->toBe('Issued for owner review')
        ->and($quotation->revisions->first()?->user_id)->toBe($admin->id);

    $this->actingAs($admin)
        ->get(route('admin.quotations.show', $quotation))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Quotations/Show')
            ->where('quotation.revisions.0.number', 'A')
            ->where('quotation.revisions.0.notes', 'Issued for owner review')
            ->where('quotation.revisions.0.user.name', $admin->name));

    $this->actingAs($admin)
        ->get(route('admin.quotations.print', $quotation))
        ->assertOk()
        ->assertDontSee('Quotation revisions', false)
        ->assertDontSee('Issued for owner review', false);
});

test('converting a quotation copies revisions onto the bid', function () {
    $admin = quotationAdmin();
    $project = quotationProject($admin, 'Harbor RF Upgrade');
    $quotation = makeQuotation($admin, $project);
    $quotation->revisions()->create([
        'number' => 'B',
        'revision_date' => '2026-09-18',
        'notes' => 'Revised hardware package',
        'user_id' => $admin->id,
    ]);

    $this->actingAs($admin)
        ->post(route('admin.quotations.convert-to-bid', $quotation))
        ->assertRedirect();

    $bid = Bid::query()->where('quotation_id', $quotation->id)->with('revisions')->firstOrFail();

    expect($bid->revisions)->toHaveCount(1)
        ->and($bid->revisions->first()?->number)->toBe('B')
        ->and($bid->revisions->first()?->notes)->toBe('Revised hardware package')
        ->and($bid->revisions->first()?->revision_date?->toDateString())->toBe('2026-09-18');
});

test('an admin can add a reusable quotation field', function () {
    $admin = quotationAdmin();

    $this->actingAs($admin)
        ->from(route('admin.quotations.create'))
        ->post(route('admin.quotation-fields.store'), [
            'name' => 'Finish',
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('admin.quotations.create'));

    expect(QuotationField::query()->where('name', 'Finish')->exists())->toBeTrue();
});

test('a quotation can store product fields from a catalog product or on the fly', function () {
    $admin = quotationAdmin();
    $project = quotationProject($admin);
    $contractorId = $project->contractors()->first()?->id;
    $product = Product::create([
        'name' => 'RF door leaf',
        'kind' => Product::KIND_DOOR,
        'fire_label' => '90 min',
        'thickness' => '1 3/4"',
    ]);
    $fireRating = QuotationField::firstOrCreateByName('Fire rating');
    $qty = QuotationField::firstOrCreateByName('Qty');

    $this->actingAs($admin)
        ->post(route('admin.quotations.store'), [
            'contractor_id' => $contractorId,
            'project_id' => $project->id,
            'title' => 'Harbor product fields quote',
            'status' => 'draft',
            'line_items' => [
                [
                    'description' => 'RF door leaf',
                    'quantity' => '1',
                    'unit_price' => '1000',
                ],
            ],
            'field_tables' => [
                [
                    'title' => 'Project / opening conditions',
                    'fields' => [
                        [
                            'product_id' => $product->id,
                            'field_id' => $fireRating->id,
                            'value' => '90 min',
                        ],
                        [
                            'field' => 'Location',
                            'value' => 'Loading dock',
                        ],
                        [
                            'field_id' => $qty->id,
                            'value' => '2',
                        ],
                    ],
                ],
            ],
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    $quotation = Quotation::query()
        ->where('title', 'Harbor product fields quote')
        ->with(['tables.fields.field', 'tables.fields.product'])
        ->firstOrFail();

    expect($quotation->tables)->toHaveCount(1)
        ->and($quotation->tables->first()?->title)->toBe('Project / opening conditions')
        ->and($quotation->tables->first()?->fields)->toHaveCount(3)
        ->and($quotation->tables->first()?->fields->firstWhere('value', '90 min')?->product_id)->toBe($product->id)
        ->and($quotation->tables->first()?->fields->firstWhere('value', '90 min')?->field?->name)->toBe('Fire rating')
        ->and($quotation->tables->first()?->fields->firstWhere('value', 'Loading dock')?->field?->name)->toBe('Location')
        ->and($quotation->tables->first()?->fields->firstWhere('value', '2')?->field?->name)->toBe('Qty');

    $this->actingAs($admin)
        ->get(route('admin.quotations.show', $quotation))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Quotations/Show')
            ->has('quotation.field_tables', 1)
            ->where('quotation.field_tables.0.title', 'Project / opening conditions')
            ->where('quotation.field_tables.0.fields', function ($fields) {
                $rows = collect($fields);

                return $rows->contains(fn ($row) => ($row['field'] ?? null) === 'Fire rating' && ($row['value'] ?? null) === '90 min')
                    && $rows->contains(fn ($row) => ($row['field'] ?? null) === 'Location' && ($row['value'] ?? null) === 'Loading dock')
                    && $rows->contains(fn ($row) => ($row['field'] ?? null) === 'Qty' && ($row['value'] ?? null) === '2');
            }));

    $this->actingAs($admin)
        ->get(route('admin.quotations.print', $quotation))
        ->assertOk()
        ->assertSee('Project / opening conditions', false)
        ->assertSee('Fire rating', false)
        ->assertSee('Loading dock', false);
});

test('quotation pages include convert actions', function () {
    $admin = quotationAdmin();
    $project = quotationProject($admin);
    $quotation = makeQuotation($admin, $project);
    QuotationTitle::firstOrCreateByName($quotation->title);

    $this->actingAs($admin)
        ->get(route('admin.quotations.create'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Quotations/Create')
            ->has('options.titles')
            ->where('options.titles.0.name', $quotation->title)
            ->where('options.nextQuotationNumber', Quotation::nextNumber()));

    $this->actingAs($admin)
        ->get(route('admin.quotations.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Quotations/Index')
            ->where('options.can.convert_to_bid', true)
            ->where('quotations.data.0.id', $quotation->id));

    $this->actingAs($admin)
        ->get(route('admin.quotations.show', $quotation))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Quotations/Show')
            ->where('quotation.id', $quotation->id)
            ->where('quotation.converted_bid', null)
            ->where('options.can.convert_to_bid', true));
});
