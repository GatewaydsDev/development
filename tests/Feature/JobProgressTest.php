<?php

use App\Models\DailyTask;
use App\Models\Employee;
use App\Models\EmployeeAttendanceDay;
use App\Models\EmployeeAttendanceWeek;
use App\Models\EmployeeWorkSchedule;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\QualityControlReport;
use App\Models\User;
use App\Models\UserLevel;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

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
            ->where('progress.attendance.members.0.present', true)
            ->has('progress.timeline', 1)
            ->where('can.inspect', false));
});

test('the quality control person files a report and the task shows the result', function () {
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

    expect(QualityControlReport::firstOrFail()->fail_reasons)->toBe(['workmanship' => 'Studs are 24 in. apart']);

    $this->actingAs($inspector)->get(route('admin.job-progress.show', $schedule))
        ->assertInertia(fn (Assert $page) => $page
            ->where('can.inspect', true)
            ->where('progress.tasks.0.qc_open', true)
            ->where('progress.tasks.0.quality_control.result', 'rework')
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
    Storage::fake('local');
    ['schedule' => $schedule, 'foreman' => $foreman, 'inspector' => $inspector, 'task' => $task] = progressJob();
    $url = route('admin.job-progress.tasks.update', [$schedule, $task]);

    $this->actingAs($inspector)->post($url, ['status' => 'in_progress', 'progress' => 10])->assertForbidden();

    $this->actingAs($foreman)->post($url, ['status' => 'in_progress', 'progress' => 40, 'notes' => 'Half framed'])
        ->assertSessionHasNoErrors();
    $this->actingAs(progressUser(UserLevel::SUPER_ADMIN))->post($url, ['status' => 'in_progress', 'progress' => 75])
        ->assertSessionHasNoErrors();

    $this->actingAs($foreman)->post($url, ['status' => 'completed'])->assertSessionHasErrors('photos');
    $this->actingAs($foreman)->post($url, [
        'status' => 'completed',
        'photos' => [UploadedFile::fake()->image('done.jpg')],
    ])->assertSessionHasNoErrors();

    $this->actingAs($foreman)->get(route('admin.job-progress.show', $schedule))
        ->assertInertia(fn (Assert $page) => $page
            ->where('can.update', true)
            ->where('progress.tasks.0.progress', 100)
            ->where('progress.tasks.0.photo_count', 1));
    expect(\App\Models\DailyTaskCompletion::count())->toBe(1);
});

test('the foreman can set the crew rate and the hours worked from job progress', function () {
    ['schedule' => $schedule, 'foreman' => $foreman, 'worker' => $worker] = progressJob();
    $skill = \App\Models\Skill::create(['name' => 'Framing']);
    $worker->skills()->attach($skill->id);
    $rate = \App\Models\EmployeePayRate::create([
        'employee_id' => $worker->id,
        'skill_id' => $skill->id,
        'rate_type' => \App\Models\EmployeePayRate::RATE_HOURLY,
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
});

test('a rate that belongs to another employee is rejected for the crew', function () {
    ['schedule' => $schedule, 'foreman' => $foreman, 'worker' => $worker] = progressJob();
    $other = Employee::create(['first_name' => 'Oz', 'last_name' => 'Else', 'email' => 'oz@example.com', 'employment_status' => Employee::STATUS_ACTIVE]);
    $rate = \App\Models\EmployeePayRate::create(['employee_id' => $other->id, 'rate_type' => 'daily', 'amount' => 200]);

    $this->actingAs($foreman)
        ->post(route('admin.job-progress.crew.update', [$schedule->uuid, $worker->uuid]), ['employee_pay_rate_id' => $rate->id])
        ->assertSessionHasErrors('employee_pay_rate_id');
});
