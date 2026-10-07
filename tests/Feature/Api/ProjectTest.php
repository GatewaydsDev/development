<?php

use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\User;
use App\Models\UserLevel;
use App\Support\ProjectListVersion;
use Inertia\Testing\AssertableInertia as Assert;

function apiProjectUser(string $levelName): User
{
    $level = UserLevel::firstOrCreate(['name' => $levelName]);
    $level->forceFill([
        'permissions' => $level->defaultPermissions(),
    ])->save();

    return User::factory()->create([
        'level_id' => $level->id,
    ]);
}

function apiProjectStatusId(string $slug = 'quoted'): int
{
    return (int) ProjectStatus::query()->where('slug', $slug)->value('id');
}

/**
 * @return array<string, mixed>
 */
function apiProjectPayload(string $name = 'SCIF Door Package'): array
{
    return [
        'name' => $name,
        'assigned_to' => null,
        'status_id' => apiProjectStatusId(),
        'priority' => 'high',
        'site_address_line_1' => '100 Secure Way',
        'site_city' => 'Newark',
        'site_state' => 'NJ',
        'site_postal_code' => '07102',
        'site_country' => 'United States',
        'public_notes' => 'Secure opening package',
        'budget_amount' => '15000.00',
        'internal_notes' => 'Internal pricing note',
        'contractors' => [],
        'scopes' => [
            [
                'type' => 'radio_frequency_doors',
                'notes' => 'RF shielded pair',
            ],
        ],
        'revisions' => [
            [
                'number' => 'A',
                'revision_date' => '2026-09-01',
                'notes' => 'Initial submittal',
            ],
        ],
    ];
}

test('project api routes require a token', function () {
    $this->getJson('/api/projects')->assertUnauthorized();
    $this->getJson('/api/projects/options')->assertUnauthorized();
    $this->postJson('/api/projects')->assertUnauthorized();
});

test('users without the mobile project right cannot list projects', function () {
    $user = apiProjectUser(UserLevel::USER);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/projects')
        ->assertForbidden();
});

test('a removed mobile project right blocks the projects api', function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::ADMINISTRATOR]);
    $permissions = $level->defaultPermissions();
    $mobile = $permissions;
    $mobile['view-projects'] = false;

    $level->forceFill([
        'permissions' => $permissions,
        'mobile_permissions' => $mobile,
    ])->save();

    $user = User::factory()->create([
        'level_id' => $level->id,
    ]);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/projects')
        ->assertForbidden();
});

test('mobile users can list search and open projects', function () {
    $user = apiProjectUser(UserLevel::ADMINISTRATOR);

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/projects', apiProjectPayload('Harbor SCIF'))
        ->assertCreated();

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/projects', apiProjectPayload('Airport Blast'))
        ->assertCreated();

    $list = $this->actingAs($user, 'sanctum')
        ->getJson('/api/projects?search=Harbor');

    $list->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.name', 'Harbor SCIF')
        ->assertJsonPath('data.0.uuid', fn (mixed $uuid): bool => is_string($uuid) && $uuid !== '')
        ->assertJsonPath('data.0.budget_amount', '15000.00')
        ->assertJsonPath('can.view', true)
        ->assertJsonPath('can.create', true)
        ->assertJsonPath('can.delete', true);

    $projectId = $list->json('data.0.id');
    $projectUuid = $list->json('data.0.uuid');

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/projects/'.$projectUuid)
        ->assertOk()
        ->assertJsonPath('project.uuid', $projectUuid)
        ->assertJsonPath('project.name', 'Harbor SCIF');

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/projects/'.$projectId)
        ->assertOk()
        ->assertJsonPath('project.name', 'Harbor SCIF')
        ->assertJsonPath('project.public_notes', 'Secure opening package')
        ->assertJsonPath('project.internal_notes', 'Internal pricing note')
        ->assertJsonPath('project.scopes.0.type', 'radio_frequency_doors')
        ->assertJsonPath('project.revisions.0.number', 'A')
        ->assertJsonPath('project.site_city', 'Newark');
});

test('mobile users can load project form options', function () {
    $user = apiProjectUser(UserLevel::ADMINISTRATOR);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/projects/options')
        ->assertOk()
        ->assertJsonPath('options.priorities', Project::PRIORITIES)
        ->assertJsonStructure([
            'options' => ['statuses', 'scopeTypes', 'assignees', 'nextProjectNumber'],
        ]);
});

test('mobile users can create update and delete a project', function () {
    $user = apiProjectUser(UserLevel::ADMINISTRATOR);

    $created = $this->actingAs($user, 'sanctum')
        ->postJson('/api/projects', apiProjectPayload())
        ->assertCreated()
        ->assertJsonPath('project.name', 'SCIF Door Package')
        ->assertJsonPath('project.priority', 'high');

    $projectId = $created->json('project.id');
    $revisionId = $created->json('project.revisions.0.id');

    expect($created->json('project.project_number'))->toStartWith('GDS-');

    $payload = apiProjectPayload('SCIF Door Package Revised');
    $payload['priority'] = 'urgent';
    $payload['revisions'][0]['id'] = $revisionId;

    $this->actingAs($user, 'sanctum')
        ->patchJson('/api/projects/'.$projectId, $payload)
        ->assertOk()
        ->assertJsonPath('project.name', 'SCIF Door Package Revised')
        ->assertJsonPath('project.priority', 'urgent');

    $this->actingAs($user, 'sanctum')
        ->deleteJson('/api/projects/'.$projectId)
        ->assertOk()
        ->assertJsonPath('message', 'Project removed.');

    $this->assertDatabaseMissing('projects', [
        'id' => $projectId,
    ]);
});

test('project managers can update a project but cannot create or delete one', function () {
    $administrator = apiProjectUser(UserLevel::ADMINISTRATOR);
    $manager = apiProjectUser(UserLevel::PROJECT_MANAGER);

    $projectId = $this->actingAs($administrator, 'sanctum')
        ->postJson('/api/projects', apiProjectPayload('Manager Project'))
        ->json('project.id');

    $this->actingAs($manager, 'sanctum')
        ->postJson('/api/projects', apiProjectPayload('Blocked Project'))
        ->assertForbidden();

    $this->actingAs($manager, 'sanctum')
        ->patchJson('/api/projects/'.$projectId, [
            'status_id' => apiProjectStatusId('lead'),
            'priority' => 'normal',
            'public_notes' => 'Updated by the project manager',
        ])
        ->assertOk()
        ->assertJsonPath('project.priority', 'normal')
        ->assertJsonPath('project.public_notes', 'Updated by the project manager')
        ->assertJsonMissingPath('project.budget_amount');

    $this->actingAs($manager, 'sanctum')
        ->deleteJson('/api/projects/'.$projectId)
        ->assertForbidden();

    $this->assertDatabaseHas('projects', [
        'id' => $projectId,
        'name' => 'Manager Project',
    ]);
});

test('adding or updating a project advances the list version', function () {
    $user = apiProjectUser(UserLevel::ADMINISTRATOR);
    $before = ProjectListVersion::current();

    $created = $this->actingAs($user, 'sanctum')
        ->postJson('/api/projects', apiProjectPayload('Live list project'))
        ->assertCreated();

    $createdVersion = ProjectListVersion::current();

    expect($createdVersion)->not->toBe($before);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/projects/version')
        ->assertOk()
        ->assertJsonPath('version', $createdVersion);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/projects')
        ->assertOk()
        ->assertJsonPath('meta.version', $createdVersion);

    $this->actingAs($user)
        ->getJson(route('admin.projects.version'))
        ->assertOk()
        ->assertJsonPath('version', $createdVersion);

    $this->actingAs($user)
        ->get(route('admin.projects.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Projects/Index')
            ->where('listVersion', $createdVersion)
            ->where('projects.data.0.priority', 'high')
        );

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard')
            ->where('listVersion', $createdVersion)
            ->where('charts.byPriority.2', [
                'key' => 'high',
                'label' => 'High',
                'value' => 1,
            ])
            ->missing('projects')
        );

    $projectId = $created->json('project.id');
    $revisionId = $created->json('project.revisions.0.id');
    $payload = apiProjectPayload('Live list project');
    $payload['priority'] = 'urgent';
    $payload['revisions'][0]['id'] = $revisionId;

    $this->actingAs($user, 'sanctum')
        ->patchJson('/api/projects/'.$projectId, $payload)
        ->assertOk();

    $updatedVersion = ProjectListVersion::current();

    expect($updatedVersion)->not->toBe($createdVersion);

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard')
            ->where('listVersion', $updatedVersion)
            ->where('charts.byPriority.3', [
                'key' => 'urgent',
                'label' => 'Urgent',
                'value' => 1,
            ])
            ->where('charts.byPriority.2.value', 0)
        );

    $this->actingAs($user)
        ->get(route('admin.projects.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Projects/Index')
            ->where('listVersion', $updatedVersion)
            ->where('projects.data.0.priority', 'urgent')
        );

    $this->actingAs($user, 'sanctum')
        ->deleteJson('/api/projects/'.$projectId)
        ->assertOk();

    expect(ProjectListVersion::current())->not->toBe($updatedVersion);
});

test('the project list version is hidden without the mobile project right', function () {
    $user = apiProjectUser(UserLevel::USER);

    $this->getJson('/api/projects/version')->assertUnauthorized();

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/projects/version')
        ->assertForbidden();

    $this->actingAs($user)
        ->getJson(route('admin.projects.version'))
        ->assertForbidden();
});
