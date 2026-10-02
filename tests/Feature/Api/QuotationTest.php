<?php

use App\Models\Contractor;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\User;
use App\Models\UserLevel;
use App\Support\QuotationListVersion;
use Inertia\Testing\AssertableInertia as Assert;

function apiQuoteUser(string $levelName): User
{
    $level = UserLevel::firstOrCreate(['name' => $levelName]);
    $level->forceFill([
        'permissions' => $level->defaultPermissions(),
    ])->save();

    return User::factory()->create([
        'level_id' => $level->id,
    ]);
}

function apiQuoteProject(User $user, string $name = 'Harbor Quote Project'): Project
{
    $contractor = Contractor::query()->firstOrCreate([
        'name' => 'Harbor Facilities',
    ]);

    $project = Project::create([
        'name' => $name,
        'project_status_id' => ProjectStatus::idFor('quoted'),
        'priority' => 'normal',
        'created_by' => $user->id,
    ]);

    $project->contractors()->syncWithoutDetaching([$contractor->id]);

    return $project;
}

/**
 * @return array<string, mixed>
 */
function apiQuotePayload(Project $project, string $status = 'sent'): array
{
    return [
        'contractor_id' => $project->contractors()->firstOrFail()->id,
        'project_id' => $project->id,
        'title' => 'Harbor RF quote',
        'status' => $status,
        'quoted_at' => '2026-09-15',
        'valid_until' => '2026-10-15',
        'notes' => 'Includes hardware.',
        'line_items' => [
            [
                'description' => 'RF door leaf',
                'quantity' => '2',
                'size' => '3x7',
                'unit_price' => '1250',
            ],
        ],
    ];
}

test('quotation api routes require a token', function () {
    $this->getJson('/api/quotations')->assertUnauthorized();
    $this->getJson('/api/quotations/version')->assertUnauthorized();
    $this->getJson('/api/quotations/options')->assertUnauthorized();
    $this->postJson('/api/quotations')->assertUnauthorized();
});

test('users without the mobile quotation right cannot list quotations', function () {
    $user = apiQuoteUser(UserLevel::USER);

    $this->getJson('/api/quotations/version')->assertUnauthorized();

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/quotations')
        ->assertForbidden();

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/quotations/version')
        ->assertForbidden();

    $this->actingAs($user)
        ->getJson(route('admin.quotations.version'))
        ->assertForbidden();
});

test('mobile users can list show create and update quotations', function () {
    $user = apiQuoteUser(UserLevel::ADMINISTRATOR);
    $project = apiQuoteProject($user);

    $created = $this->actingAs($user, 'sanctum')
        ->postJson('/api/quotations', apiQuotePayload($project))
        ->assertCreated()
        ->assertJsonPath('quotation.title', 'Harbor RF quote')
        ->assertJsonPath('quotation.status', 'sent')
        ->assertJsonPath('quotation.total', 1250)
        ->assertJsonPath('can.create', true);

    $quotationId = $created->json('quotation.id');

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/quotations?search=Harbor')
        ->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.title', 'Harbor RF quote')
        ->assertJsonPath('can.view', true);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/quotations/'.$quotationId)
        ->assertOk()
        ->assertJsonPath('quotation.id', $quotationId)
        ->assertJsonPath('quotation.line_items.0.description', 'RF door leaf');

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/quotations/options')
        ->assertOk()
        ->assertJsonStructure(['options', 'can']);

    $this->actingAs($user, 'sanctum')
        ->patchJson('/api/quotations/'.$quotationId, apiQuotePayload($project, 'accepted'))
        ->assertOk()
        ->assertJsonPath('quotation.status', 'accepted')
        ->assertJsonPath('can.update', true);
});

test('a project manager can update a quotation but cannot create one', function () {
    $administrator = apiQuoteUser(UserLevel::ADMINISTRATOR);
    $manager = apiQuoteUser(UserLevel::PROJECT_MANAGER);
    $project = apiQuoteProject($administrator);

    $created = $this->actingAs($administrator, 'sanctum')
        ->postJson('/api/quotations', apiQuotePayload($project))
        ->assertCreated();

    $this->actingAs($manager, 'sanctum')
        ->postJson('/api/quotations', apiQuotePayload($project))
        ->assertForbidden();

    $this->actingAs($manager, 'sanctum')
        ->patchJson('/api/quotations/'.$created->json('quotation.id'), apiQuotePayload($project, 'accepted'))
        ->assertOk()
        ->assertJsonPath('can.create', false)
        ->assertJsonPath('can.update', true);
});

test('adding or updating a quotation advances the list version', function () {
    $user = apiQuoteUser(UserLevel::ADMINISTRATOR);
    $project = apiQuoteProject($user);
    $before = QuotationListVersion::current();

    $created = $this->actingAs($user, 'sanctum')
        ->postJson('/api/quotations', apiQuotePayload($project))
        ->assertCreated();

    $createdVersion = QuotationListVersion::current();

    expect($createdVersion)->not->toBe($before);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/quotations/version')
        ->assertOk()
        ->assertJsonPath('version', $createdVersion);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/quotations')
        ->assertOk()
        ->assertJsonPath('meta.version', $createdVersion);

    $this->actingAs($user)
        ->getJson(route('admin.quotations.version'))
        ->assertOk()
        ->assertJsonPath('version', $createdVersion);

    $this->actingAs($user)
        ->get(route('admin.quotations.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Quotations/Index')
            ->where('listVersion', $createdVersion)
            ->where('quotations.data.0.status', 'sent')
        );

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard')
            ->where('quotationListVersion', $createdVersion)
        );

    $this->actingAs($user, 'sanctum')
        ->patchJson('/api/quotations/'.$created->json('quotation.id'), apiQuotePayload($project, 'accepted'))
        ->assertOk();

    $updatedVersion = QuotationListVersion::current();

    expect($updatedVersion)->not->toBe($createdVersion);

    $this->actingAs($user)
        ->get(route('admin.quotations.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Quotations/Index')
            ->where('listVersion', $updatedVersion)
            ->where('quotations.data.0.status', 'accepted')
        );

    $this->actingAs($user)
        ->delete(route('admin.quotations.destroy', $created->json('quotation.id')))
        ->assertRedirect();

    expect(QuotationListVersion::current())->not->toBe($updatedVersion);
});
