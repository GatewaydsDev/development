<?php

use App\Models\Bid;
use App\Models\Contractor;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\Quotation;
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
        'extended' => 2500,
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
            'line_items' => [
                [
                    'description' => 'RF door leaf',
                    'quantity' => '2',
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
        ->and((float) $quotation->lineItems->first()->extended)->toBe(2500.0);
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
        ->and((float) $bid->scopes->first()->extended)->toBe(2500.0)
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

test('quotation pages include convert actions', function () {
    $admin = quotationAdmin();
    $project = quotationProject($admin);
    $quotation = makeQuotation($admin, $project);

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
