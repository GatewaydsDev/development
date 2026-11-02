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

test('an employee pay rates can be loaded from the schedule list', function () {
    $admin = scheduleAdmin();
    $employee = scheduleEmployee('rates.person@example.com', 'Rita');
    $skill = \App\Models\Skill::create(['name' => 'Painter']);
    $employee->skills()->attach($skill->id);
    $employee->payRates()->create([
        'skill_id' => $skill->id,
        'rate_type' => 'hourly',
        'amount' => '35.00',
    ]);

    $this->actingAs($admin)
        ->getJson(route('admin.employee-schedules.rates', $employee->uuid))
        ->assertOk()
        ->assertJsonPath('groups.0.name', 'Painter')
        ->assertJsonPath('groups.0.rates.0.label', 'Hourly')
        ->assertJsonPath('groups.0.rates.0.amount', '35.00');
});

test('the quality control person can be changed from the schedule list', function () {
    $admin = scheduleAdmin();
    $foreman = scheduleForeman();
    $project = scheduleProject($admin, 'Dock Repair');
    $jordan = scheduleEmployee('jordan.qc@example.com', 'Jordan');
    $qc = scheduleEmployee('qc.person@example.com', 'Quinn');
    $qc->forceFill(['is_quality_control' => true])->save();

    $schedule = EmployeeWorkSchedule::query()->create([
        'project_id' => $project->id,
        'starts_on' => '2026-10-05',
        'ends_on' => '2026-10-10',
        'status' => 'active',
        'foreman_user_id' => $foreman->id,
    ]);
    $schedule->employees()->sync([$jordan->id]);

    $this->actingAs($admin)
        ->patch(route('admin.employee-schedules.role', $schedule->uuid), [
            'role' => 'quality_control',
            'employee_uuid' => $jordan->uuid,
        ])
        ->assertSessionHasErrors('employee_uuid');

    $this->actingAs($admin)
        ->patch(route('admin.employee-schedules.role', $schedule->uuid), [
            'role' => 'quality_control',
            'employee_uuid' => $qc->uuid,
        ])
        ->assertSessionHasNoErrors();

    expect($schedule->fresh()->quality_control_employee_id)->toBe($qc->id);
    expect($schedule->employees()->pluck('employees.id')->all())->toContain($qc->id);
});

test('replacing the quality control person removes the previous one from the crew', function () {
    $admin = scheduleAdmin();
    $foreman = scheduleForeman();
    $project = scheduleProject($admin, 'Pier Paint');
    $old = scheduleEmployee('old.qc@example.com', 'Olga');
    $new = scheduleEmployee('new.qc@example.com', 'Nina');
    $old->forceFill(['is_quality_control' => true])->save();
    $new->forceFill(['is_quality_control' => true])->save();

    $schedule = EmployeeWorkSchedule::query()->create([
        'project_id' => $project->id,
        'starts_on' => '2026-10-05',
        'ends_on' => '2026-10-10',
        'status' => 'active',
        'foreman_user_id' => $foreman->id,
        'quality_control_employee_id' => $old->id,
    ]);
    $schedule->employees()->sync([$old->id]);

    $this->actingAs($admin)
        ->patch(route('admin.employee-schedules.role', $schedule->uuid), [
            'role' => 'quality_control',
            'employee_uuid' => $new->uuid,
        ])
        ->assertSessionHasNoErrors();

    expect($schedule->fresh()->quality_control_employee_id)->toBe($new->id);
    expect($schedule->employees()->pluck('employees.id')->all())->toBe([$new->id]);
});

function attendanceSchedule(User $admin, User $foreman, array $employees, string $status = 'active'): EmployeeWorkSchedule
{
    $schedule = EmployeeWorkSchedule::query()->create([
        'project_id' => scheduleProject($admin, 'Attendance Job')->id,
        'starts_on' => '2026-10-05',
        'ends_on' => '2026-10-10',
        'status' => $status,
        'foreman_user_id' => $foreman->id,
    ]);
    $schedule->employees()->sync(collect($employees)->pluck('id')->all());

    return $schedule;
}

function attendanceRate(Employee $employee, string $type = 'daily', string $amount = '200'): void
{
    $skill = App\Models\Skill::firstOrCreate(['name' => 'Carpenter']);
    $employee->payRates()->create(['skill_id' => $skill->id, 'rate_type' => $type, 'amount' => $amount]);
}

test('a foreman marking crew present creates linked attendance and absent removes it', function () {
    $this->travelTo('2026-10-07 07:00:00');
    $admin = scheduleAdmin();
    $foreman = scheduleForeman('foreman.attend@example.com');
    $jordan = scheduleEmployee('jordan.attend@example.com', 'Jordan');
    $sam = scheduleEmployee('sam.attend@example.com', 'Sam');
    attendanceRate($jordan);
    attendanceRate($sam, 'hourly', '30');
    $schedule = attendanceSchedule($admin, $foreman, [$jordan, $sam]);

    $this->actingAs($foreman)
        ->post(route('admin.daily-tasks.attendance', $schedule->uuid), ['entries' => [
            ['employee_uuid' => $jordan->uuid, 'present' => true],
            ['employee_uuid' => $sam->uuid, 'present' => true, 'hours' => 6],
        ]])
        ->assertSessionHasNoErrors();

    $days = App\Models\EmployeeAttendanceDay::query()->where('employee_work_schedule_id', $schedule->id)->get();
    expect($days)->toHaveCount(2)
        ->and($days->every(fn ($d) => $d->worked && $d->scheduled))->toBeTrue()
        ->and((float) $days->firstWhere('rate_type', 'hourly')->hours)->toBe(6.0);

    $this->actingAs($foreman)
        ->post(route('admin.daily-tasks.attendance', $schedule->uuid), ['entries' => [
            ['employee_uuid' => $jordan->uuid, 'present' => false],
        ]])
        ->assertSessionHasNoErrors();

    expect(App\Models\EmployeeAttendanceDay::query()->where('employee_work_schedule_id', $schedule->id)->count())->toBe(1);
});

test('attendance reports missing rates and other-job conflicts', function () {
    $this->travelTo('2026-10-07 07:00:00');
    $admin = scheduleAdmin();
    $foreman = scheduleForeman('foreman.conflict@example.com');
    $other = scheduleForeman('foreman.conflict2@example.com');
    $jordan = scheduleEmployee('jordan.conflict@example.com', 'Jordan');
    $sam = scheduleEmployee('sam.conflict@example.com', 'Sam');
    attendanceRate($jordan);
    $first = attendanceSchedule($admin, $other, [$jordan]);
    $second = attendanceSchedule($admin, $foreman, [$jordan, $sam]);

    $this->actingAs($other)
        ->post(route('admin.daily-tasks.attendance', $first->uuid), ['entries' => [
            ['employee_uuid' => $jordan->uuid, 'present' => true],
        ]])->assertSessionHasNoErrors();

    $this->actingAs($foreman)
        ->post(route('admin.daily-tasks.attendance', $second->uuid), ['entries' => [
            ['employee_uuid' => $jordan->uuid, 'present' => true],
            ['employee_uuid' => $sam->uuid, 'present' => true],
        ]])
        ->assertSessionHasErrors(["attendance.{$jordan->uuid}", "attendance.{$sam->uuid}"]);
});

test('only the schedule foreman can record its attendance', function () {
    $this->travelTo('2026-10-07 07:00:00');
    $admin = scheduleAdmin();
    $foreman = scheduleForeman('foreman.owner@example.com');
    $other = scheduleForeman('foreman.notowner@example.com');
    $jordan = scheduleEmployee('jordan.owner@example.com', 'Jordan');
    attendanceRate($jordan);
    $schedule = attendanceSchedule($admin, $foreman, [$jordan]);

    $this->actingAs($other)
        ->post(route('admin.daily-tasks.attendance', $schedule->uuid), ['entries' => [
            ['employee_uuid' => $jordan->uuid, 'present' => true],
        ]])->assertForbidden();
});

test('the foreman daily tasks page includes the attendance roster', function () {
    $this->travelTo('2026-10-07 07:00:00');
    $admin = scheduleAdmin();
    $foreman = scheduleForeman('foreman.page@example.com');
    $jordan = scheduleEmployee('jordan.page@example.com', 'Jordan');
    attendanceRate($jordan);
    attendanceSchedule($admin, $foreman, [$jordan]);

    $this->actingAs($foreman)
        ->get(route('admin.daily-tasks.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('attendance', 1));
});

test('bulk attendance can be recorded against a work schedule crew', function () {
    $admin = scheduleAdmin();
    $foreman = scheduleForeman('foreman.bulk@example.com');
    $jordan = scheduleEmployee('jordan.bulk@example.com', 'Jordan');
    $sam = scheduleEmployee('sam.bulk@example.com', 'Sam');
    $outsider = scheduleEmployee('out.bulk@example.com', 'Out');
    attendanceRate($jordan, 'hourly', '30');
    attendanceRate($outsider);
    $schedule = attendanceSchedule($admin, $foreman, [$jordan, $sam]);
    $rate = fn (Employee $e) => $e->payRates()->first();

    $this->actingAs($admin)
        ->get(route('admin.employee-attendance.bulk'))
        ->assertInertia(fn (Assert $page) => $page->has('schedules', 1)->where('schedules.0.uuid', $schedule->uuid));

    $row = fn (Employee $e, $hours = null) => [
        'employee_id' => $e->id,
        'skill_id' => $rate($e)->skill_id,
        'pay_rate_id' => $rate($e)->id,
        'hours' => $hours,
    ];
    $payload = fn (array $employees, string $date = '2026-10-07') => [
        'work_date' => $date,
        'schedule_uuid' => $schedule->uuid,
        'scheduled' => true,
        'worked' => true,
        'employees' => $employees,
    ];

    $this->actingAs($admin)
        ->post(route('admin.employee-attendance.bulk.store'), $payload([$row($jordan, '7.5')]))
        ->assertSessionHasNoErrors();

    $day = App\Models\EmployeeAttendanceDay::query()->where('employee_work_schedule_id', $schedule->id)->first();
    expect($day)->not->toBeNull()->and((float) $day->hours)->toBe(7.5);

    $this->actingAs($admin)
        ->post(route('admin.employee-attendance.bulk.store'), $payload([$row($outsider)]))
        ->assertSessionHasErrors('employees.0.employee_id');

    $this->actingAs($admin)
        ->post(route('admin.employee-attendance.bulk.store'), $payload([$row($jordan, '8')], '2026-10-12'))
        ->assertSessionHasErrors('work_date');
});

test('adding an attendance week for an employee adds them to the chosen work schedule', function () {
    $admin = scheduleAdmin();
    $foreman = scheduleForeman('foreman.week@example.com');
    $jordan = scheduleEmployee('jordan.week@example.com', 'Jordan');
    $newcomer = scheduleEmployee('new.week@example.com', 'Newcomer');
    attendanceRate($newcomer);
    $schedule = attendanceSchedule($admin, $foreman, [$jordan]);
    $rate = $newcomer->payRates()->first();

    $this->actingAs($admin)
        ->get(route('admin.employee-attendance.create'))
        ->assertInertia(fn (Assert $page) => $page->has('schedules', 1));

    $days = collect(range(0, 5))->map(fn (int $i) => [
        'work_date' => Carbon\Carbon::parse('2026-10-05')->addDays($i)->toDateString(),
        'skill_id' => $rate->skill_id,
        'pay_rate_id' => $rate->id,
        'scheduled' => $i === 2,
        'worked' => $i === 2,
    ])->all();

    $this->actingAs($admin)
        ->post(route('admin.employee-attendance.store'), [
            'schedule_uuid' => $schedule->uuid,
            'employee_id' => $newcomer->id,
            'week_start' => '2026-10-05',
            'days' => $days,
        ])
        ->assertSessionHasNoErrors();

    expect($schedule->employees()->whereKey($newcomer->id)->exists())->toBeTrue()
        ->and(App\Models\EmployeeAttendanceDay::where('employee_work_schedule_id', $schedule->id)->count())->toBe(1);
});

test('the attendance list shows each employee skills', function () {
    $admin = scheduleAdmin();
    $jordan = scheduleEmployee('jordan.skills@example.com', 'Jordan');
    attendanceRate($jordan);
    $jordan->skills()->sync([App\Models\Skill::firstWhere('name', 'Carpenter')->id]);
    $week = App\Models\EmployeeAttendanceWeek::create(['employee_id' => $jordan->id, 'week_start' => '2026-10-05']);
    $week->days()->create([
        'work_date' => '2026-10-05', 'skill_id' => $jordan->payRates()->first()->skill_id,
        'employee_pay_rate_id' => $jordan->payRates()->first()->id, 'rate_type' => 'daily',
        'amount' => 200, 'scheduled' => true, 'worked' => true,
    ]);

    $this->actingAs($admin)
        ->get(route('admin.employee-attendance.index'))
        ->assertInertia(fn (Assert $page) => $page->where('weeks.data.0.employee.skills', ['Carpenter']));
});
