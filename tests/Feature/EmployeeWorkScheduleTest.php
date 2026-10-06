<?php

use App\Models\Employee;
use App\Models\EmployeeWorkSchedule;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\User;
use App\Models\UserLevel;
use Inertia\Testing\AssertableInertia as Assert;

function scheduleAdmin(): User
{
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);

    return User::factory()->create(['level_id' => $level->id]);
}

function scheduleForeman(string $email = 'foreman.schedule@example.com'): User
{
    $level = UserLevel::firstOrCreate(['name' => UserLevel::FOREMAN]);
    $level->forceFill(['permissions' => $level->defaultPermissions()])->save();

    return User::factory()->create([
        'name' => 'Alex Foreman',
        'email' => $email,
        'level_id' => $level->id,
        'role' => 'foreman',
    ]);
}

function scheduleProject(User $user, string $name): Project
{
    return Project::create([
        'name' => $name,
        'project_status_id' => ProjectStatus::idFor('quoted'),
        'priority' => 'normal',
        'created_by' => $user->id,
    ]);
}

function scheduleEmployee(string $email, string $first): Employee
{
    return Employee::create([
        'first_name' => $first,
        'last_name' => 'Crew',
        'email' => $email,
        'employment_status' => Employee::STATUS_ACTIVE,
    ]);
}

test('a job can be scheduled with a foreman and attending employees', function () {
    $admin = scheduleAdmin();
    $foreman = scheduleForeman();
    $project = scheduleProject($admin, 'Harbor Doors');
    $jordan = scheduleEmployee('jordan.schedule@example.com', 'Jordan');
    $sam = scheduleEmployee('sam.schedule@example.com', 'Sam');

    $this->actingAs($admin)
        ->post(route('admin.employee-schedules.store'), [
            'project_id' => $project->id,
            'work_date' => '2026-10-07',
            'foreman_user_id' => $foreman->id,
            'employee_ids' => [$jordan->id, $sam->id],
            'notes' => 'Morning install',
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('admin.employee-schedules.index', ['date' => '2026-10-07']));

    $schedule = EmployeeWorkSchedule::query()->firstOrFail();

    expect($schedule->employees()->pluck('employees.id')->all())
        ->toEqualCanonicalizing([$jordan->id, $sam->id]);

    $this->actingAs($admin)
        ->get(route('admin.employee-schedules.index', ['date' => '2026-10-07']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/EmployeeSchedules/Index')
            ->has('schedules.data', 1)
            ->where('schedules.data.0.project.name', 'Harbor Doors')
            ->where('schedules.data.0.foreman.name', 'Alex Foreman')
            ->has('schedules.data.0.employees', 2)
        );
});

test('the same employee can attend more than one job on the same day', function () {
    $admin = scheduleAdmin();
    $foreman = scheduleForeman('foreman.two@example.com');
    $harbor = scheduleProject($admin, 'Harbor Doors');
    $north = scheduleProject($admin, 'North Lobby');
    $jordan = scheduleEmployee('jordan.two@example.com', 'Jordan');

    foreach ([$harbor, $north] as $project) {
        $this->actingAs($admin)
            ->post(route('admin.employee-schedules.store'), [
                'project_id' => $project->id,
                'work_date' => '2026-10-07',
                'foreman_user_id' => $foreman->id,
                'employee_ids' => [$jordan->id],
            ])
            ->assertSessionHasNoErrors();
    }

    expect($jordan->workSchedules()->whereDate('work_date', '2026-10-07')->count())->toBe(2);
});

test('a job cannot have two crews on the same date', function () {
    $admin = scheduleAdmin();
    $foreman = scheduleForeman('foreman.dup@example.com');
    $project = scheduleProject($admin, 'Harbor Doors');
    $jordan = scheduleEmployee('jordan.dup@example.com', 'Jordan');

    $payload = [
        'project_id' => $project->id,
        'work_date' => '2026-10-07',
        'foreman_user_id' => $foreman->id,
        'employee_ids' => [$jordan->id],
    ];

    $this->actingAs($admin)
        ->post(route('admin.employee-schedules.store'), $payload)
        ->assertSessionHasNoErrors();

    $this->actingAs($admin)
        ->from(route('admin.employee-schedules.create'))
        ->post(route('admin.employee-schedules.store'), $payload)
        ->assertSessionHasErrors('project_id');
});

test('a foreman sees only the jobs they are responsible for', function () {
    $admin = scheduleAdmin();
    $foreman = scheduleForeman('foreman.scope@example.com');
    $other = scheduleForeman('foreman.other@example.com');
    $project = scheduleProject($admin, 'Harbor Doors');
    $otherProject = scheduleProject($admin, 'North Lobby');
    $jordan = scheduleEmployee('jordan.scope@example.com', 'Jordan');

    EmployeeWorkSchedule::query()->create([
        'project_id' => $project->id,
        'work_date' => '2026-10-07',
        'foreman_user_id' => $foreman->id,
    ])->employees()->sync([$jordan->id]);

    EmployeeWorkSchedule::query()->create([
        'project_id' => $otherProject->id,
        'work_date' => '2026-10-07',
        'foreman_user_id' => $other->id,
    ])->employees()->sync([$jordan->id]);

    $this->actingAs($foreman)
        ->get(route('admin.employee-schedules.index', ['date' => '2026-10-07']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('schedules.data', 1));
});
