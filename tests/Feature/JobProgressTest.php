<?php

use App\Events\JobProgressChanged;
use App\Models\ClientCompany;
use App\Models\DailyTask;
use App\Models\DailyTaskCompletion;
use App\Models\Employee;
use App\Models\EmployeeAttendanceDay;
use App\Models\EmployeeAttendanceWeek;
use App\Models\EmployeePayRate;
use App\Models\EmployeeWorkSchedule;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\QualityControlReport;
use App\Models\Skill;
use App\Models\User;
use App\Models\UserLevel;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Sanctum\Sanctum;

function progressUser(string $levelName): User
{
    $level = UserLevel::firstOrCreate(['name' => $levelName]);
    $level->forceFill(['permissions' => $level->defaultPermissions()])->save();

    return User::factory()->create(['level_id' => $level->id]);
}

/**
 * @return array{schedule: EmployeeWorkSchedule, foreman: User, inspector: User, task: DailyTask, worker: Employee}
 */
function progressJob(): array
{
    $foreman = progressUser(UserLevel::FOREMAN);
    $inspector = progressUser(UserLevel::EMPLOYEE);
    $inspectorEmployee = Employee::create([
        'first_name' => 'Quinn',
        'last_name' => 'Check',
        'email' => 'quinn@example.com',
        'employment_status' => Employee::STATUS_ACTIVE,
        'user_id' => $inspector->id,
        'is_quality_control' => true,
    ]);
    $worker = Employee::create([
        'first_name' => 'Wes',
        'last_name' => 'Crew',
        'email' => 'wes@example.com',
        'employment_status' => Employee::STATUS_ACTIVE,
    ]);
    $project = Project::create([
        'name' => 'Progress site',
        'project_status_id' => ProjectStatus::idFor('quoted'),
        'priority' => 'normal',
        'created_by' => $foreman->id,
    ]);
    $schedule = EmployeeWorkSchedule::create([
        'project_id' => $project->id,
        'starts_on' => now()->subDay()->toDateString(),
        'ends_on' => now()->addDay()->toDateString(),
        'status' => EmployeeWorkSchedule::STATUS_ACTIVE,
        'foreman_user_id' => $foreman->id,
        'quality_control_employee_id' => $inspectorEmployee->id,
    ]);
    $schedule->employees()->sync([$worker->id]);
    $task = DailyTask::create([
        'title' => 'Frame the wall',
        'is_active' => true,
        'requires_photo' => true,
        'requires_quality_control' => true,
    ]);
    $schedule->dailyTasks()->sync([$task->id]);

    return compact('schedule', 'foreman', 'inspector', 'task', 'worker');
}

test('job progress brings attendance, task progress, photos and quality control together', function () {
    Storage::fake('local');
    ['schedule' => $schedule, 'foreman' => $foreman, 'task' => $task, 'worker' => $worker] = progressJob();

    $week = EmployeeAttendanceWeek::create([
        'employee_id' => $worker->id,
        'week_start' => EmployeeAttendanceWeek::mondayOf(now()->toDateString())->toDateString(),
    ]);
    $week->days()->create([
        'work_date' => now()->toDateString(),
        'rate_type' => 'hourly',
        'amount' => 20,
        'hours' => 8,
        'scheduled' => true,
        'worked' => true,
        'employee_work_schedule_id' => $schedule->id,
    ]);

    $this->actingAs($foreman)->post(route('admin.daily-tasks.progress', $task), [
        'schedule_uuid' => $schedule->uuid,
        'status' => 'in_progress',
        'progress' => 60,
        'photos' => [UploadedFile::fake()->image('wall.jpg')],
    ])->assertSessionHasNoErrors();

    $this->actingAs($foreman)->get(route('admin.job-progress.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('jobs', 1)
            ->where('jobs.0.summary.progress', 60)
            ->where('jobs.0.summary.photos', 1)
            ->where('jobs.0.summary.days_worked', 1)
            ->where('jobs.0.summary.hours', 8));

    $this->actingAs($foreman)->get(route('admin.job-progress.show', $schedule))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('progress.tasks.0.progress', 60)
            ->where('progress.tasks.0.photo_count', 1)
            ->where('progress.tasks.0.last_changed_at', fn ($value) => is_string($value) && $value !== '')
            ->where('progress.attendance.members.0.present', true)
            ->has('progress.timeline', 1)
            ->where('can.inspect', false));
});

test('the quality control person files a report and the task shows the result', function () {
    Event::fake([JobProgressChanged::class]);
    ['schedule' => $schedule, 'foreman' => $foreman, 'inspector' => $inspector, 'task' => $task] = progressJob();

    $this->actingAs($foreman)->post(route('admin.daily-tasks.progress', $task), [
        'schedule_uuid' => $schedule->uuid,
        'status' => 'completed',
        'photos' => [UploadedFile::fake()->image('done.jpg')],
    ])->assertSessionHasNoErrors();

    $url = route('admin.job-progress.reports.store', [$schedule, $task]);
    $checklist = array_fill_keys(array_keys(QualityControlReport::CHECKLIST), 'pass');

    $this->actingAs($foreman)->post($url, ['result' => 'passed', 'checklist' => $checklist])->assertForbidden();

    $this->actingAs($inspector)->post($url, [
        'result' => 'passed',
        'checklist' => [...$checklist, 'safety' => 'fail'],
        'fail_reasons' => ['safety' => 'No harness'],
    ])->assertSessionHasErrors('result');

    $this->actingAs($inspector)->post($url, [
        'result' => 'rework',
        'checklist' => [...$checklist, 'workmanship' => 'fail'],
        'fail_reasons' => ['workmanship' => 'Studs are 24 in. apart'],
    ])->assertSessionHasErrors('corrective_action');

    $this->actingAs($inspector)->post($url, [
        'result' => 'rework',
        'checklist' => [...$checklist, 'workmanship' => 'fail'],
        'corrective_action' => 'Re-nail studs',
    ])->assertSessionHasErrors('fail_reasons.workmanship');

    $this->actingAs($inspector)->post($url, [
        'result' => 'rework',
        'checklist' => [...$checklist, 'workmanship' => 'fail'],
        'fail_reasons' => ['workmanship' => 'Studs are 24 in. apart'],
        'corrective_action' => 'Re-nail studs',
    ])->assertSessionHasNoErrors();

    Event::assertDispatched(
        JobProgressChanged::class,
        fn (JobProgressChanged $event) => $event->scheduleUuid === $schedule->uuid
            && $event->change === 'quality_control',
    );

    expect(QualityControlReport::firstOrFail()->fail_reasons)->toBe(['workmanship' => 'Studs are 24 in. apart']);

    $this->actingAs($inspector)->get(route('admin.job-progress.show', $schedule))
        ->assertInertia(fn (Assert $page) => $page
            ->where('can.inspect', true)
            ->where('progress.tasks.0.qc_open', true)
            ->where('progress.tasks.0.quality_control.result', 'rework')
            ->where('progress.tasks.0.reports.0.failed_checks', 1)
            ->where('progress.summary.qc_open', 1));

    $this->actingAs($inspector)->post($url, ['result' => 'passed', 'checklist' => $checklist])
        ->assertSessionHasNoErrors();

    $report = QualityControlReport::query()->latest('id')->firstOrFail();
    expect($report->daily_task_completion_id)->not->toBeNull();

    $this->actingAs($inspector)->get(route('admin.job-progress.report', $report))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('report.result', 'passed'));

    $this->actingAs($foreman)->get(route('admin.job-progress.show', $schedule))
        ->assertInertia(fn (Assert $page) => $page
            ->where('progress.tasks.0.qc_open', false)
            ->where('progress.summary.qc_passed', 1));
});

test('a permitted inspector sends a quality report to the project client company', function () {
    ['schedule' => $schedule, 'inspector' => $inspector, 'task' => $task] = progressJob();
    $company = ClientCompany::create(['name' => 'Tower Client']);
    $recipient = User::factory()->create([
        'level_id' => progressUser(UserLevel::CLIENT)->level_id,
    ]);
    $company->users()->attach($recipient->id, [
        'is_master' => false,
        'all_projects' => true,
    ]);
    $schedule->project->forceFill(['client_company_id' => $company->id])->save();

    $permissions = $inspector->level->permissions;
    $inspector->level->forceFill([
        'permissions' => [
            ...$permissions,
            'send-quality-control-reports' => true,
        ],
        'mobile_permissions' => [
            ...(array) $inspector->level->mobile_permissions,
            'send-quality-control-reports' => true,
        ],
    ])->save();
    $inspector = $inspector->fresh('level');

    $this->actingAs($inspector)
        ->get(route('admin.job-progress.show', $schedule))
        ->assertInertia(fn (Assert $page) => $page
            ->where('can.send_quality_reports', true)
            ->where('reportRecipients.0.uuid', $recipient->uuid));

    $checklist = array_fill_keys(array_keys(QualityControlReport::CHECKLIST), 'pass');
    $this->actingAs($inspector)->post(
        route('admin.job-progress.reports.store', [$schedule, $task]),
        [
            'result' => 'rework',
            'checklist' => [...$checklist, 'workmanship' => 'fail'],
            'fail_reasons' => ['workmanship' => 'Door is out of square'],
            'corrective_action' => 'Reset and shim the frame',
            'assigned_to_user_uuid' => $recipient->uuid,
        ],
    )->assertSessionHasNoErrors();

    $report = QualityControlReport::firstOrFail();
    expect($report->assigned_to_user_id)->toBe($recipient->id)
        ->and($report->assigned_at)->not->toBeNull();

    Sanctum::actingAs($inspector);
    $this->getJson('/api/me/quality-control')
        ->assertOk()
        ->assertJsonPath('can_send_reports', true)
        ->assertJsonPath('data.0.recipients.0.uuid', $recipient->uuid);
    $this->postJson(
        "/api/me/quality-control/{$schedule->uuid}/{$task->uuid}",
        [
            'result' => 'passed',
            'checklist' => $checklist,
            'assigned_to_user_uuid' => $recipient->uuid,
        ],
    )->assertCreated()
        ->assertJsonPath('assigned_to.uuid', $recipient->uuid);

    $this->actingAs($recipient)
        ->get(route('portal.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('qualityReports', 2)
            ->where('qualityReports.1.uuid', $report->uuid));

    $this->actingAs($recipient)
        ->get(route('portal.quality-reports.show', $report))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Portal/QualityReport')
            ->where('report.checklist.0.reason', 'Door is out of square')
            ->where('report.corrective_action', 'Reset and shim the frame'));

    Sanctum::actingAs($recipient);
    $this->getJson("/api/client-portal/quality-reports/{$report->uuid}")
        ->assertOk()
        ->assertJsonPath('report.corrective_action', 'Reset and shim the frame')
        ->assertJsonPath('report.checklist.0.reason', 'Door is out of square');

    $inspector->level->forceFill([
        'permissions' => [
            ...$permissions,
            'send-quality-control-reports' => false,
        ],
    ])->save();
    $inspector->unsetRelation('level');

    $this->actingAs($inspector)->post(
        route('admin.job-progress.reports.store', [$schedule, $task]),
        [
            'result' => 'passed',
            'checklist' => $checklist,
            'assigned_to_user_uuid' => $recipient->uuid,
        ],
    )->assertForbidden();
});

test('other foremen and employees cannot see someone else\'s job progress', function () {
    ['schedule' => $schedule] = progressJob();

    $this->actingAs(progressUser(UserLevel::FOREMAN))
        ->get(route('admin.job-progress.show', $schedule))->assertForbidden();
    $this->actingAs(progressUser(UserLevel::EMPLOYEE))
        ->get(route('admin.job-progress.index'))->assertForbidden();
    $this->actingAs(progressUser(UserLevel::SUPER_ADMIN))
        ->get(route('admin.job-progress.show', $schedule))->assertOk();
});

test('progress of a task can be changed from job progress', function () {
    Event::fake([JobProgressChanged::class]);
    Storage::fake('local');
    ['schedule' => $schedule, 'foreman' => $foreman, 'inspector' => $inspector, 'task' => $task] = progressJob();
    $url = route('admin.job-progress.tasks.update', [$schedule, $task]);

    $this->actingAs($inspector)->post($url, ['status' => 'in_progress', 'progress' => 10])->assertForbidden();
    Event::assertNotDispatched(JobProgressChanged::class);

    $this->actingAs($foreman)->post($url, ['status' => 'in_progress', 'progress' => 40, 'notes' => 'Half framed'])
        ->assertSessionHasNoErrors();
    $this->actingAs(progressUser(UserLevel::SUPER_ADMIN))->post($url, ['status' => 'in_progress', 'progress' => 75])
        ->assertSessionHasNoErrors();

    $this->actingAs($foreman)->post($url, ['status' => 'completed'])->assertSessionHasErrors('photos');
    $this->actingAs($foreman)->post($url, [
        'status' => 'completed',
        'photos' => [UploadedFile::fake()->image('done.jpg')],
    ])->assertSessionHasNoErrors();

    Event::assertDispatched(
        JobProgressChanged::class,
        fn (JobProgressChanged $event) => $event->scheduleUuid === $schedule->uuid
            && $event->change === 'task'
            && $event->broadcastAs() === 'job-progress.changed'
            && $event->broadcastOn()[0]->name === "private-job-progress.{$schedule->uuid}",
    );

    $this->actingAs($foreman)->get(route('admin.job-progress.show', $schedule))
        ->assertInertia(fn (Assert $page) => $page
            ->where('can.update', true)
            ->where('progress.tasks.0.progress', 100)
            ->where('progress.tasks.0.photo_count', 1));
    expect(DailyTaskCompletion::count())->toBe(1);
});

test('the foreman can set the crew rate and the hours worked from job progress', function () {
    Event::fake([JobProgressChanged::class]);
    ['schedule' => $schedule, 'foreman' => $foreman, 'worker' => $worker] = progressJob();
    $skill = Skill::create(['name' => 'Framing']);
    $worker->skills()->attach($skill->id);
    $rate = EmployeePayRate::create([
        'employee_id' => $worker->id,
        'skill_id' => $skill->id,
        'rate_type' => EmployeePayRate::RATE_HOURLY,
        'amount' => 30,
    ]);
    $today = now()->toDateString();

    $this->actingAs($foreman)
        ->post(route('admin.job-progress.crew.update', [$schedule->uuid, $worker->uuid]), [
            'skill_id' => $skill->id,
            'employee_pay_rate_id' => $rate->id,
        ])
        ->assertSessionHasNoErrors();

    expect($schedule->employees()->first()->pivot->employee_pay_rate_id)->toBe($rate->id);

    $this->actingAs($foreman)
        ->post(route('admin.job-progress.attendance', $schedule->uuid), [
            'date' => $today,
            'employee_uuid' => $worker->uuid,
            'present' => true,
            'hours' => 6.5,
        ])
        ->assertSessionHasNoErrors();

    $day = EmployeeAttendanceDay::first();
    expect((float) $day->hours)->toBe(6.5)
        ->and($day->employee_pay_rate_id)->toBe($rate->id)
        ->and($day->skill_id)->toBe($skill->id);

    Event::assertDispatched(
        JobProgressChanged::class,
        fn (JobProgressChanged $event) => $event->scheduleUuid === $schedule->uuid
            && $event->change === 'crew',
    );
    Event::assertDispatched(
        JobProgressChanged::class,
        fn (JobProgressChanged $event) => $event->scheduleUuid === $schedule->uuid
            && $event->change === 'attendance',
    );
});

test('a rate that belongs to another employee is rejected for the crew', function () {
    ['schedule' => $schedule, 'foreman' => $foreman, 'worker' => $worker] = progressJob();
    $other = Employee::create(['first_name' => 'Oz', 'last_name' => 'Else', 'email' => 'oz@example.com', 'employment_status' => Employee::STATUS_ACTIVE]);
    $rate = EmployeePayRate::create(['employee_id' => $other->id, 'rate_type' => 'daily', 'amount' => 200]);

    $this->actingAs($foreman)
        ->post(route('admin.job-progress.crew.update', [$schedule->uuid, $worker->uuid]), ['employee_pay_rate_id' => $rate->id])
        ->assertSessionHasErrors('employee_pay_rate_id');
});

test('job progress summarises hours and pay by week, and hides pay from the foreman', function () {
    ['schedule' => $schedule, 'foreman' => $foreman, 'worker' => $worker] = progressJob();
    $week = EmployeeAttendanceWeek::create([
        'employee_id' => $worker->id,
        'week_start' => EmployeeAttendanceWeek::mondayOf(now()->toDateString())->toDateString(),
    ]);
    $week->days()->create([
        'work_date' => now()->toDateString(), 'rate_type' => 'hourly', 'amount' => 20, 'hours' => 5,
        'scheduled' => true, 'worked' => true, 'employee_work_schedule_id' => $schedule->id,
    ]);
    $admin = progressUser(UserLevel::SUPER_ADMIN);

    $this->actingAs($admin)->get(route('admin.job-progress.show', $schedule->uuid))
        ->assertInertia(fn (Assert $page) => $page
            ->where('progress.payroll.total_pay', '100.00')
            ->where('progress.payroll.weeks.0.employees.0.hours', 5)
            ->where('canSeePay', true));

    $this->actingAs($foreman)->get(route('admin.job-progress.show', $schedule->uuid))
        ->assertInertia(fn (Assert $page) => $page
            ->where('progress.payroll.total_pay', '0.00')
            ->where('canSeePay', false));
});

test('a foreman level gets the field operations screens and can lose them', function () {
    $foreman = progressUser(UserLevel::FOREMAN);

    foreach (['view-work-schedule', 'view-job-progress', 'view-daily-tasks', 'view-attendance'] as $permission) {
        expect($foreman->hasPermission($permission))->toBeTrue();
    }

    $this->actingAs($foreman)->get(route('admin.job-progress.index'))->assertOk();
    $this->actingAs($foreman)->get(route('admin.employee-schedules.index'))->assertOk();
    $this->actingAs($foreman)->get(route('admin.employee-attendance.index'))->assertOk();

    $level = $foreman->level;
    $level->forceFill(['permissions' => array_merge($level->permissions, ['view-job-progress' => false, 'view-attendance' => false])])->save();

    $foreman = $foreman->fresh();
    $this->actingAs($foreman)->get(route('admin.job-progress.index'))->assertForbidden();
    $this->actingAs($foreman)->get(route('admin.employee-attendance.index'))->assertForbidden();
});
