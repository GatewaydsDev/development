<?php

use App\Models\Bid;
use App\Models\BidPricingStatus;
use App\Models\BidScopeTitle;
use App\Models\BidStageType;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\User;
use App\Models\UserLevel;
use Inertia\Testing\AssertableInertia as Assert;

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
    $customer = Customer::create([
        'name' => 'Gateway Customer',
        'company_name' => 'Gateway Facilities',
    ]);

    return Project::create([
        'name' => $name,
        'customer_id' => $customer->id,
        'project_status_id' => ProjectStatus::idFor('quoted'),
        'priority' => 'normal',
        'created_by' => $admin->id,
    ]);
}

test('the create bid page includes stages scopes and pricing catalogs', function () {
    $admin = bidAdmin();

    $this->actingAs($admin)
        ->get(route('admin.bids.create'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Bids/Create')
            ->has('options.projects')
            ->has('options.stageTypes')
            ->has('options.scopeTitles')
            ->has('options.products')
            ->has('options.pricingStatuses')
        );
});

test('a bid can be created with stages reusable scopes and pricing revisions', function () {
    $admin = bidAdmin();
    $project = bidProject($admin);
    $stage = BidStageType::query()->where('name', 'Preliminary Bid')->firstOrFail();
    $title = BidScopeTitle::create(['name' => 'RF Doors']);
    $doorLeaf = Product::create(['name' => 'RF door leaf', 'kind' => Product::KIND_DOOR]);
    $frame = Product::create(['name' => 'RF frame', 'kind' => Product::KIND_PART]);
    $status = BidPricingStatus::query()->where('name', 'Budget allowance')->firstOrFail();

    $response = $this
        ->actingAs($admin)
        ->post(route('admin.bids.store'), [
            'project_id' => $project->id,
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
                        ['product_id' => $doorLeaf->id],
                        ['product_id' => $frame->id],
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
    expect($bid->pricings)->toHaveCount(1);
    expect($bid->pricings->first()?->items)->toHaveCount(1);
    expect((float) $bid->pricings->first()?->items->first()?->amount)->toBe(12500.0);
});

test('a bid can update its stages scopes and pricing revisions', function () {
    $admin = bidAdmin();
    $project = bidProject($admin, 'Existing Bid Project');
    $preliminary = BidStageType::query()->where('name', 'Preliminary Bid')->firstOrFail();
    $revised = BidStageType::query()->where('name', 'Revised Bid')->firstOrFail();
    $title = BidScopeTitle::create(['name' => 'Hardware set']);
    $lockset = Product::create(['name' => 'Locksets', 'kind' => Product::KIND_PART]);
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
                        ['product_id' => $lockset->id],
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
    expect(BidScopeTitle::query()->whereRaw('LOWER(name) = ?', ['blast doors'])->count())->toBe(1);
    expect(BidPricingStatus::query()->whereRaw('LOWER(name) = ?', ['owner allowance'])->count())->toBe(1);
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
