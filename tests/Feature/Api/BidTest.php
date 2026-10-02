<?php

use App\Models\BidStageType;
use App\Models\Contractor;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\User;
use App\Models\UserLevel;
use App\Support\BidListVersion;
use Inertia\Testing\AssertableInertia as Assert;

function apiBidUser(string $levelName): User
{
    $level = UserLevel::firstOrCreate(['name' => $levelName]);
    $level->forceFill([
        'permissions' => $level->defaultPermissions(),
    ])->save();

    return User::factory()->create([
        'level_id' => $level->id,
    ]);
}

function apiBidProject(User $user, string $name = 'Harbor Bid Project'): Project
{
    $contractor = Contractor::query()->firstOrCreate([
        'name' => 'Gateway Facilities',
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
function apiBidPayload(Project $project, string $notes = 'Harbor bid notes'): array
{
    $stage = BidStageType::query()->where('name', 'Preliminary Bid')->firstOrFail();

    return [
        'project_id' => $project->id,
        'notes' => $notes,
        'stages' => [
            [
                'stage_type_id' => $stage->id,
                'stage_date' => '2026-09-01',
                'notes' => 'First look',
            ],
        ],
    ];
}

test('bid api routes require a token', function () {
    $this->getJson('/api/bids')->assertUnauthorized();
    $this->getJson('/api/bids/version')->assertUnauthorized();
    $this->getJson('/api/bids/options')->assertUnauthorized();
    $this->postJson('/api/bids')->assertUnauthorized();
});

test('users without the mobile bid right cannot list bids', function () {
    $user = apiBidUser(UserLevel::USER);

    $this->getJson('/api/bids/version')->assertUnauthorized();

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/bids')
        ->assertForbidden();

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/bids/version')
        ->assertForbidden();

    $this->actingAs($user)
        ->getJson(route('admin.bids.version'))
        ->assertForbidden();
});

test('mobile users can list show create and update bids', function () {
    $user = apiBidUser(UserLevel::ADMINISTRATOR);
    $project = apiBidProject($user);

    $created = $this->actingAs($user, 'sanctum')
        ->postJson('/api/bids', apiBidPayload($project))
        ->assertCreated()
        ->assertJsonPath('bid.project.name', 'Harbor Bid Project')
        ->assertJsonPath('can.create', true);

    $bidId = $created->json('bid.id');

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/bids?search=Harbor')
        ->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.project.name', 'Harbor Bid Project')
        ->assertJsonPath('can.view', true);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/bids/'.$bidId)
        ->assertOk()
        ->assertJsonPath('bid.id', $bidId)
        ->assertJsonPath('bid.project.id', $project->id);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/bids/options')
        ->assertOk()
        ->assertJsonStructure(['options', 'can']);

    $payload = apiBidPayload($project, 'Updated harbor notes');

    $this->actingAs($user, 'sanctum')
        ->patchJson('/api/bids/'.$bidId, $payload)
        ->assertOk()
        ->assertJsonPath('bid.id', $bidId)
        ->assertJsonPath('can.update', true);

    $this->assertDatabaseHas('bids', [
        'id' => $bidId,
        'project_id' => $project->id,
    ]);
});

test('adding or updating a bid advances the list version', function () {
    $user = apiBidUser(UserLevel::ADMINISTRATOR);
    $project = apiBidProject($user);
    $before = BidListVersion::current();

    $created = $this->actingAs($user, 'sanctum')
        ->postJson('/api/bids', apiBidPayload($project))
        ->assertCreated();

    $createdVersion = BidListVersion::current();

    expect($createdVersion)->not->toBe($before);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/bids/version')
        ->assertOk()
        ->assertJsonPath('version', $createdVersion);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/bids')
        ->assertOk()
        ->assertJsonPath('meta.version', $createdVersion);

    $this->actingAs($user)
        ->getJson(route('admin.bids.version'))
        ->assertOk()
        ->assertJsonPath('version', $createdVersion);

    $this->actingAs($user)
        ->get(route('admin.bids.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Bids/Index')
            ->where('listVersion', $createdVersion)
            ->where('bids.data.0.current_stage', 'Preliminary Bid')
        );

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard')
            ->where('bidListVersion', $createdVersion)
        );

    $finalStage = BidStageType::query()->where('name', 'Final Bid')->firstOrFail();
    $payload = apiBidPayload($project, 'Updated harbor notes');
    $payload['stages'][0]['stage_type_id'] = $finalStage->id;

    $this->actingAs($user, 'sanctum')
        ->patchJson('/api/bids/'.$created->json('bid.id'), $payload)
        ->assertOk();

    $updatedVersion = BidListVersion::current();

    expect($updatedVersion)->not->toBe($createdVersion);

    $this->actingAs($user)
        ->get(route('admin.bids.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Bids/Index')
            ->where('listVersion', $updatedVersion)
            ->where('bids.data.0.current_stage', 'Final Bid')
        );

    $this->actingAs($user)
        ->delete(route('admin.bids.destroy', $created->json('bid.id')))
        ->assertRedirect();

    expect(BidListVersion::current())->not->toBe($updatedVersion);
});

test('a project manager can update a bid but cannot create one', function () {
    $administrator = apiBidUser(UserLevel::ADMINISTRATOR);
    $manager = apiBidUser(UserLevel::PROJECT_MANAGER);
    $project = apiBidProject($administrator);
    $payload = apiBidPayload($project);

    $created = $this->actingAs($administrator, 'sanctum')
        ->postJson('/api/bids', $payload)
        ->assertCreated();

    $this->actingAs($manager, 'sanctum')
        ->postJson('/api/bids', $payload)
        ->assertForbidden();

    $this->actingAs($manager, 'sanctum')
        ->patchJson('/api/bids/'.$created->json('bid.id'), apiBidPayload($project, 'Manager notes'))
        ->assertOk()
        ->assertJsonPath('can.create', false)
        ->assertJsonPath('can.update', true);
});
