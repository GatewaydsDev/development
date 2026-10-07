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
            'project_uuid' => $project->uuid,
            'starts_on' => '2026-10-05',
            'ends_on' => '2026-10-10',
            'status' => 'active',
            'foreman_user_id' => $foreman->id,
            'employee_uuids' => [$jordan->uuid, $sam->uuid],
            'notes' => 'Morning install',
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('admin.employee-schedules.index', ['date' => '2026-10-05']));

    $schedule = EmployeeWorkSchedule::query()->firstOrFail();

    expect($schedule->uuid)->not->toBeEmpty();
    expect($schedule->employees()->pluck('employees.id')->all())
        ->toEqualCanonicalizing([$jordan->id, $sam->id]);

    $this->actingAs($admin)
        ->get(route('admin.employee-schedules.index', ['date' => '2026-10-07']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/EmployeeSchedules/Index')
            ->has('schedules.data', 1)
            ->where('schedules.data.0.uuid', $schedule->uuid)
            ->where('schedules.data.0.project.uuid', $project->uuid)
            ->where('schedules.data.0.project.name', 'Harbor Doors')
            ->where('schedules.data.0.foreman.name', 'Alex Foreman')
            ->where('schedules.data.0.starts_on', '2026-10-05')
            ->where('schedules.data.0.ends_on', '2026-10-10')
            ->where('schedules.data.0.status', 'active')
            ->where('schedules.data.0.date_label', 'Monday, Oct 5 – Saturday, Oct 10, 2026')
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
                'project_uuid' => $project->uuid,
                'starts_on' => '2026-10-07',
                'ends_on' => '2026-10-07',
                'foreman_user_id' => $foreman->id,
                'employee_uuids' => [$jordan->uuid],
            ])
            ->assertSessionHasNoErrors();
    }

    expect($jordan->workSchedules()->covering('2026-10-07')->count())->toBe(2);
});

test('a job cannot have two crews on the same date', function () {
    $admin = scheduleAdmin();
    $foreman = scheduleForeman('foreman.dup@example.com');
    $project = scheduleProject($admin, 'Harbor Doors');
    $jordan = scheduleEmployee('jordan.dup@example.com', 'Jordan');

    $payload = [
        'project_uuid' => $project->uuid,
        'starts_on' => '2026-10-05',
        'ends_on' => '2026-10-10',
        'foreman_user_id' => $foreman->id,
        'employee_uuids' => [$jordan->uuid],
    ];

    $this->actingAs($admin)
        ->post(route('admin.employee-schedules.store'), $payload)
        ->assertSessionHasNoErrors();

    $this->actingAs($admin)
        ->from(route('admin.employee-schedules.create'))
        ->post(route('admin.employee-schedules.store'), $payload)
        ->assertSessionHasErrors('starts_on');
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
        'starts_on' => '2026-10-07',
        'ends_on' => '2026-10-07',
        'status' => 'active',
        'foreman_user_id' => $foreman->id,
    ])->employees()->sync([$jordan->id]);

    EmployeeWorkSchedule::query()->create([
        'project_id' => $otherProject->id,
        'starts_on' => '2026-10-07',
        'ends_on' => '2026-10-07',
        'status' => 'inactive',
        'foreman_user_id' => $other->id,
    ])->employees()->sync([$jordan->id]);

    $this->actingAs($foreman)
        ->get(route('admin.employee-schedules.index', ['date' => '2026-10-07']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('schedules.data', 1));
});

test('a job can require a competent person who holds that certification', function () {
    $admin = scheduleAdmin();
    $foreman = scheduleForeman('foreman.competent@example.com');
    $project = scheduleProject($admin, 'Harbor Doors');
    $jordan = scheduleEmployee('jordan.competent@example.com', 'Jordan');
    $sam = scheduleEmployee('sam.competent@example.com', 'Sam');

    $certification = \App\Models\Certification::findOrCreateByName(
        'OSHA competent person',
        true,
    );

    $jordan->certifications()->create([
        'certification_id' => $certification->id,
        'issued_on' => '2026-01-15',
    ]);

    $payload = [
        'project_uuid' => $project->uuid,
        'starts_on' => '2026-10-05',
        'ends_on' => '2026-10-10',
        'status' => 'active',
        'foreman_user_id' => $foreman->id,
        'employee_uuids' => [$sam->uuid],
        'requires_competent_person' => true,
    ];

    $this->actingAs($admin)
        ->from(route('admin.employee-schedules.create'))
        ->post(route('admin.employee-schedules.store'), [
            ...$payload,
            'competent_person_uuid' => $sam->uuid,
        ])
        ->assertSessionHasErrors('competent_person_uuid');

    $this->actingAs($admin)
        ->post(route('admin.employee-schedules.store'), [
            ...$payload,
            'competent_person_uuid' => $jordan->uuid,
        ])
        ->assertSessionHasNoErrors();

    $schedule = EmployeeWorkSchedule::query()->firstOrFail();

    expect($schedule->requires_competent_person)->toBeTrue()
        ->and($schedule->competent_person_employee_id)->toBe($jordan->id)
        ->and($schedule->employees()->pluck('employees.id')->all())
        ->toEqualCanonicalizing([$sam->id, $jordan->id]);

    $this->actingAs($admin)
        ->get(route('admin.employee-schedules.index', ['date' => '2026-10-07']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('schedules.data.0.employees.0.full_name', 'Jordan Crew')
            ->where('schedules.data.0.employees.0.certifications.0.name', 'OSHA competent person')
            ->where('schedules.data.0.employees.0.certifications.0.is_competent_person', true));
});

test('employee search matches a skill or a qualification', function () {
    $admin = scheduleAdmin();
    $welder = scheduleEmployee('welder.search@example.com', 'Riley');
    $qualified = scheduleEmployee('qualified.search@example.com', 'Casey');

    $welder->skills()->create(['name' => 'Orbital welding']);

    $certification = \App\Models\Certification::findOrCreateByName('OSHA 30', true);
    $qualified->certifications()->create([
        'certification_id' => $certification->id,
    ]);

    $this->actingAs($admin)
        ->get(route('admin.employees.index', ['search' => 'Orbital']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('employees.data', 1)
            ->where('employees.data.0.email', 'welder.search@example.com')
            ->where('employees.data.0.skills.0.name', 'Orbital welding'));

    $this->actingAs($admin)
        ->get(route('admin.employees.index', ['search' => 'OSHA']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('employees.data', 1)
            ->where('employees.data.0.email', 'qualified.search@example.com')
            ->where('employees.data.0.certifications.0.name', 'OSHA 30'));
});

test('an employee can store a competent person certification', function () {
    $admin = scheduleAdmin();

    $this->actingAs($admin)
        ->post(route('admin.employees.store'), [
            'first_name' => 'Casey',
            'last_name' => 'Qualified',
            'email' => 'casey.qualified@example.com',
            'employment_status' => Employee::STATUS_ACTIVE,
            'pay_rates' => [],
            'certifications' => [[
                'name' => 'Competent person',
                'is_competent_person' => true,
                'issued_on' => '2026-01-15',
                'expires_on' => '2027-01-15',
            ]],
        ])
        ->assertSessionHasNoErrors();

    $employee = Employee::query()->where('email', 'casey.qualified@example.com')->firstOrFail();

    $assignment = $employee->certifications()->with('certification')->firstOrFail();

    expect($employee->certifications)->toHaveCount(1)
        ->and($assignment->certification->name)->toBe('Competent person')
        ->and($assignment->certification->is_competent_person)->toBeTrue();
});
