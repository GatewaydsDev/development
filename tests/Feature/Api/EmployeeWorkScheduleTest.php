<?php

use App\Models\Employee;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\User;
use App\Models\UserLevel;

function scheduleApiUser(string $levelName): User
{
    $level = UserLevel::firstOrCreate(['name' => $levelName]);
    $level->forceFill(['permissions' => $level->defaultPermissions()])->save();

    return User::factory()->create([
        'level_id' => $level->id,
        'role' => $levelName === UserLevel::FOREMAN ? 'foreman' : 'admin',
    ]);
}

test('work schedule api routes require a token', function () {
    $this->getJson('/api/employees/schedules')->assertUnauthorized();
    $this->postJson('/api/employees/schedules')->assertUnauthorized();
});

test('the mobile app can list add update and remove a job crew', function () {
    $admin = scheduleApiUser(UserLevel::ADMIN);
    $foreman = scheduleApiUser(UserLevel::FOREMAN);
    $project = Project::create([
        'name' => 'Harbor Schedule',
        'project_status_id' => ProjectStatus::idFor('quoted'),
        'priority' => 'normal',
        'created_by' => $admin->id,
    ]);
    $second = Project::create([
        'name' => 'North Schedule',
        'project_status_id' => ProjectStatus::idFor('quoted'),
        'priority' => 'normal',
        'created_by' => $admin->id,
    ]);
    $jordan = Employee::create([
        'first_name' => 'Jordan',
        'last_name' => 'Rivera',
        'email' => 'jordan.api.schedule@example.com',
        'employment_status' => Employee::STATUS_ACTIVE,
    ]);
    $sam = Employee::create([
        'first_name' => 'Sam',
        'last_name' => 'Crew',
        'email' => 'sam.api.schedule@example.com',
        'employment_status' => Employee::STATUS_ACTIVE,
    ]);

    $created = $this->actingAs($admin, 'sanctum')
        ->postJson('/api/employees/schedules', [
            'project_id' => $project->id,
            'work_date' => '2026-10-07',
            'foreman_user_id' => $foreman->id,
            'employee_ids' => [$jordan->id],
            'notes' => 'Morning',
        ])
        ->assertCreated()
        ->assertJsonPath('schedule.project.name', 'Harbor Schedule')
        ->assertJsonPath('schedule.foreman.email', $foreman->email)
        ->assertJsonPath('schedule.employees.0.full_name', 'Jordan Rivera');

    $scheduleId = $created->json('schedule.id');

    $this->actingAs($admin, 'sanctum')
        ->postJson('/api/employees/schedules', [
            'project_id' => $second->id,
            'work_date' => '2026-10-07',
            'foreman_user_id' => $foreman->id,
            'employee_ids' => [$jordan->id, $sam->id],
        ])
        ->assertCreated();

    $this->actingAs($admin, 'sanctum')
        ->getJson('/api/employees/schedules?date=2026-10-07&employee_id='.$jordan->id)
        ->assertOk()
        ->assertJsonCount(2, 'data');

    $this->actingAs($foreman, 'sanctum')
        ->getJson('/api/employees/schedules?date=2026-10-07')
        ->assertOk()
        ->assertJsonCount(2, 'data');

    $this->actingAs($admin, 'sanctum')
        ->patchJson("/api/employees/schedules/{$scheduleId}", [
            'project_id' => $project->id,
            'work_date' => '2026-10-07',
            'foreman_user_id' => $foreman->id,
            'employee_ids' => [$jordan->id, $sam->id],
            'notes' => 'Full crew',
        ])
        ->assertOk()
        ->assertJsonPath('schedule.notes', 'Full crew')
        ->assertJsonCount(2, 'schedule.employees');

    $this->actingAs($admin, 'sanctum')
        ->deleteJson("/api/employees/schedules/{$scheduleId}")
        ->assertOk();

    $this->assertDatabaseMissing('employee_work_schedules', ['id' => $scheduleId]);
});

test('a foreman cannot open a job assigned to someone else', function () {
    $admin = scheduleApiUser(UserLevel::ADMIN);
    $foreman = scheduleApiUser(UserLevel::FOREMAN);
    $other = scheduleApiUser(UserLevel::FOREMAN);
    $project = Project::create([
        'name' => 'Private Job',
        'project_status_id' => ProjectStatus::idFor('quoted'),
        'priority' => 'normal',
        'created_by' => $admin->id,
    ]);
    $jordan = Employee::create([
        'first_name' => 'Jordan',
        'last_name' => 'Rivera',
        'email' => 'jordan.private.schedule@example.com',
        'employment_status' => Employee::STATUS_ACTIVE,
    ]);

    $created = $this->actingAs($admin, 'sanctum')
        ->postJson('/api/employees/schedules', [
            'project_id' => $project->id,
            'work_date' => '2026-10-08',
            'foreman_user_id' => $other->id,
            'employee_ids' => [$jordan->id],
        ])
        ->assertCreated();

    $this->actingAs($foreman, 'sanctum')
        ->getJson('/api/employees/schedules/'.$created->json('schedule.id'))
        ->assertForbidden();
});
