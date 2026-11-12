<?php

use App\Events\JobProgressChanged;
use App\Models\Certification;
use App\Models\DailyTask;
use App\Models\DailyTaskCompletion;
use App\Models\DailyTaskTitle;
use App\Models\Employee;
use App\Models\EmployeeWorkSchedule;
use App\Models\JobTitle;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\User;
use App\Models\UserLevel;
use App\Models\WorkScheduleOverview;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Sanctum\Sanctum;

function dailyTaskUser(string $levelName): User
{
    $level = UserLevel::firstOrCreate(['name' => $levelName]);
    $level->forceFill(['permissions' => $level->defaultPermissions()])->save();

    return User::factory()->create(['level_id' => $level->id]);
}

test('only super admins and foremen can open daily tasks', function () {
    $this->actingAs(dailyTaskUser(UserLevel::SUPER_ADMIN))
        ->get(route('admin.daily-tasks.index'))->assertOk();
    $this->actingAs(dailyTaskUser(UserLevel::FOREMAN))
        ->get(route('admin.daily-tasks.index'))->assertOk();
    $this->actingAs(dailyTaskUser(UserLevel::ADMIN))
        ->get(route('admin.daily-tasks.index'))->assertForbidden();
});

test('only super admins manage daily tasks', function () {
    $this->actingAs(dailyTaskUser(UserLevel::FOREMAN))
        ->post(route('admin.daily-tasks.store'), ['title' => 'Nope', 'is_active' => true])
        ->assertForbidden();

    $this->actingAs(dailyTaskUser(UserLevel::SUPER_ADMIN))
        ->post(route('admin.daily-tasks.store'), ['title' => 'Safety briefing', 'is_active' => true])
        ->assertSessionHasNoErrors();

    $task = DailyTask::firstOrFail();
    expect($task->title)->toBe('Safety briefing');

    $this->actingAs(dailyTaskUser(UserLevel::SUPER_ADMIN))
        ->patch(route('admin.daily-tasks.update', $task), ['title' => 'Toolbox talk', 'is_active' => false])
        ->assertSessionHasNoErrors();
    expect($task->fresh()->title)->toBe('Toolbox talk')->and($task->fresh()->is_active)->toBeFalse();
});

test('a foreman checks active tasks and super admins see compliance', function () {
    $foreman = dailyTaskUser(UserLevel::FOREMAN);
    $admin = dailyTaskUser(UserLevel::SUPER_ADMIN);
    $task = DailyTask::create(['title' => 'Inspect equipment', 'is_active' => true]);
    DailyTask::create(['title' => 'Retired', 'is_active' => false]);

    $this->actingAs($foreman)->get(route('admin.daily-tasks.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->has('checklist', 1)
            ->where('checklist.0.completed', false));

    $this->actingAs($foreman)
        ->post(route('admin.daily-tasks.complete', $task), ['completed' => true])
        ->assertSessionHasNoErrors();
    $this->actingAs($foreman)
        ->post(route('admin.daily-tasks.complete', $task), ['completed' => true]);

    expect(DailyTaskCompletion::count())->toBe(1);

    $this->actingAs($admin)->get(route('admin.daily-tasks.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('compliance.0.completed', 1)
            ->where('compliance.0.total', 1));

    $this->actingAs($foreman)
        ->post(route('admin.daily-tasks.complete', $task), ['completed' => false]);
    expect(DailyTaskCompletion::first()->status)->toBe(DailyTaskCompletion::STATUS_PENDING);

    $this->actingAs($admin)
        ->post(route('admin.daily-tasks.complete', $task), ['completed' => true])
        ->assertForbidden();
});

test('a task needs a photo before it can be completed when it requires one', function () {
    Storage::fake('local');
    $admin = dailyTaskUser(UserLevel::SUPER_ADMIN);
    $foreman = dailyTaskUser(UserLevel::FOREMAN);

    $this->actingAs($admin)->post(route('admin.daily-tasks.store'), [
        'title' => 'Site walk',
        'is_active' => true,
        'requires_photo' => true,
        'requires_quality_control' => true,
    ])->assertSessionHasNoErrors();

    $task = DailyTask::firstOrFail();
    expect($task->requires_photo)->toBeTrue()->and($task->requires_quality_control)->toBeTrue();

    $this->actingAs($foreman)->post(route('admin.daily-tasks.progress', $task), ['status' => 'completed'])
        ->assertSessionHasErrors('photos');

    $this->actingAs($foreman)->post(route('admin.daily-tasks.progress', $task), [
        'status' => 'completed',
        'photos' => [UploadedFile::fake()->image('wall.jpg')],
    ])->assertSessionHasNoErrors();

    expect(DailyTaskCompletion::firstOrFail()->photos()->count())->toBe(1);

    $this->actingAs($admin)->delete(route('admin.daily-tasks.destroy', $task))->assertRedirect();
    expect(DailyTask::count())->toBe(0);
});

test('job titles are created from the dropdown and linked to employees', function () {
    $admin = dailyTaskUser(UserLevel::SUPER_ADMIN);

    $this->actingAs($admin)->post(route('admin.job-titles.store'), ['name' => 'Site Lead'])
        ->assertSessionHasNoErrors();
    $title = JobTitle::where('name', 'Site Lead')->firstOrFail();

    $employee = Employee::create([
        'first_name' => 'Ana',
        'last_name' => 'Silva',
        'email' => 'ana@example.com',
        'employment_status' => Employee::STATUS_ACTIVE,
        'job_title_id' => $title->id,
    ]);

    expect($employee->fresh()->job_title)->toBe('Site Lead')
        ->and($employee->jobTitle->is($title))->toBeTrue();
});

function fieldSchedule(User $foreman, array $tasks, string $status = EmployeeWorkSchedule::STATUS_ACTIVE): EmployeeWorkSchedule
{
    $project = Project::create([
        'name' => 'Site '.fake()->unique()->word(),
        'project_status_id' => ProjectStatus::idFor('quoted'),
        'priority' => 'normal',
        'created_by' => $foreman->id,
    ]);

    $schedule = EmployeeWorkSchedule::create([
        'project_id' => $project->id,
        'starts_on' => now()->subDay()->toDateString(),
        'ends_on' => now()->addDay()->toDateString(),
        'status' => $status,
        'foreman_user_id' => $foreman->id,
    ]);
    $schedule->dailyTasks()->sync(collect($tasks)->pluck('id'));

    return $schedule;
}

test('one reusable task can be attached to many work schedules', function () {
    $foreman = dailyTaskUser(UserLevel::FOREMAN);
    $task = DailyTask::create(['title' => 'Toolbox talk', 'is_active' => true]);
    $first = fieldSchedule($foreman, [$task]);
    $second = fieldSchedule($foreman, [$task]);

    expect($task->schedules()->count())->toBe(2)
        ->and($first->dailyTasks()->count())->toBe(1);

    $this->actingAs($foreman)->get(route('admin.daily-tasks.index'))
        ->assertInertia(fn (Assert $page) => $page->has('checklist', 2));
});

test('super admins attach daily tasks when saving a work schedule', function () {
    $admin = dailyTaskUser(UserLevel::SUPER_ADMIN);
    $foreman = dailyTaskUser(UserLevel::FOREMAN);
    $task = DailyTask::create(['title' => 'Site walk', 'is_active' => true]);
    $schedule = fieldSchedule($foreman, []);

    $this->actingAs($admin)->get(route('admin.employee-schedules.edit', $schedule))
        ->assertInertia(fn (Assert $page) => $page
            ->has('dailyTasks', 1)
            ->where('schedule.daily_task_uuids', []));

    $employee = Employee::create([
        'first_name' => 'Crew',
        'last_name' => 'Hand',
        'email' => 'hand@example.com',
        'employment_status' => Employee::STATUS_ACTIVE,
    ]);

    $this->actingAs($admin)->patch(route('admin.employee-schedules.update', $schedule), [
        'project_uuid' => $schedule->project->uuid,
        'starts_on' => $schedule->starts_on->toDateString(),
        'ends_on' => $schedule->ends_on->toDateString(),
        'status' => 'active',
        'foreman_user_id' => $foreman->id,
        'employee_uuids' => [$employee->uuid],
        'daily_task_uuids' => [$task->uuid],
    ])->assertSessionHasNoErrors();

    expect($schedule->dailyTasks()->pluck('daily_tasks.uuid')->all())->toBe([$task->uuid]);
});

test('a foreman records progress, notes and photos for a scheduled task', function () {
    Event::fake([JobProgressChanged::class]);
    Storage::fake('local');
    $foreman = dailyTaskUser(UserLevel::FOREMAN);
    $other = dailyTaskUser(UserLevel::FOREMAN);
    $task = DailyTask::create(['title' => 'Check scaffolding', 'is_active' => true]);
    $schedule = fieldSchedule($foreman, [$task]);

    $this->actingAs($foreman)->post(route('admin.daily-tasks.progress', $task), [
        'schedule_uuid' => $schedule->uuid,
        'status' => 'in_progress',
        'progress' => 40,
        'notes' => 'Half the frames inspected',
        'photos' => [UploadedFile::fake()->image('frame.jpg')],
    ])->assertSessionHasNoErrors();

    Event::assertDispatched(
        JobProgressChanged::class,
        fn (JobProgressChanged $event) => $event->scheduleUuid === $schedule->uuid
            && $event->change === 'task',
    );

    $completion = DailyTaskCompletion::firstOrFail();
    expect($completion->status)->toBe('in_progress')
        ->and($completion->progress)->toBe(40)
        ->and($completion->employee_work_schedule_id)->toBe($schedule->id)
        ->and($completion->photos)->toHaveCount(1);
    Storage::disk('local')->assertExists($completion->photos->first()->path);

    $this->actingAs($foreman)->get(route('admin.daily-tasks.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('checklist.0.status', 'in_progress')
            ->where('checklist.0.progress', 40)
            ->has('checklist.0.photos', 1)
            ->where('checklist.0.project.name', $schedule->project->name));

    $photo = $completion->photos->first();
    $this->actingAs($foreman)->get(route('admin.daily-task-photos.show', $photo))->assertOk();
    $this->actingAs($other)->get(route('admin.daily-task-photos.show', $photo))->assertForbidden();
    $this->actingAs($other)->post(route('admin.daily-tasks.progress', $task), [
        'schedule_uuid' => $schedule->uuid,
        'status' => 'completed',
    ])->assertForbidden();

    $this->actingAs($foreman)->post(route('admin.daily-tasks.progress', $task), [
        'schedule_uuid' => $schedule->uuid,
        'status' => 'completed',
    ])->assertSessionHasNoErrors();
    expect(DailyTaskCompletion::count())->toBe(1)
        ->and($completion->fresh()->progress)->toBe(100)
        ->and($completion->fresh()->completed_at)->not->toBeNull();

    $this->actingAs($foreman)->delete(route('admin.daily-task-photos.destroy', $photo));
    Storage::disk('local')->assertMissing($photo->path);
});

test('inactive or out of range schedules do not put tasks on the checklist', function () {
    $foreman = dailyTaskUser(UserLevel::FOREMAN);
    $task = DailyTask::create(['title' => 'Check scaffolding', 'is_active' => true]);
    fieldSchedule($foreman, [$task], EmployeeWorkSchedule::STATUS_ON_HOLD);

    $this->actingAs($foreman)->get(route('admin.daily-tasks.index'))
        ->assertInertia(fn (Assert $page) => $page->has('checklist', 0));
});

test('the mobile api lists and updates the foreman checklist', function () {
    Event::fake([JobProgressChanged::class]);
    Storage::fake('local');
    $foreman = dailyTaskUser(UserLevel::FOREMAN);
    $task = DailyTask::create(['title' => 'Check scaffolding', 'is_active' => true]);
    $schedule = fieldSchedule($foreman, [$task]);

    Sanctum::actingAs($foreman);

    $this->getJson('/api/me/daily-tasks')
        ->assertOk()
        ->assertJsonPath('pending', 1)
        ->assertJsonPath('tasks.0.schedule_uuid', $schedule->uuid);

    $this->post("/api/me/daily-tasks/{$task->uuid}/progress", [
        'schedule_uuid' => $schedule->uuid,
        'status' => 'blocked',
        'notes' => 'No access',
        'photos' => [UploadedFile::fake()->image('gate.jpg')],
    ], ['Accept' => 'application/json'])
        ->assertOk()
        ->assertJsonPath('task.status', 'blocked')
        ->assertJsonCount(1, 'task.photos')
        ->assertJsonPath('pending', 1);

    Event::assertDispatched(
        JobProgressChanged::class,
        fn (JobProgressChanged $event) => $event->scheduleUuid === $schedule->uuid
            && $event->change === 'task',
    );

    $photo = DailyTaskCompletion::firstOrFail()->photos()->firstOrFail();
    $this->deleteJson("/api/me/daily-tasks/photos/{$photo->getRouteKey()}")
        ->assertOk();

    Event::assertDispatchedTimes(JobProgressChanged::class, 2);
});

test('a permitted foreman creates and updates audited tasks only on their own schedule', function () {
    $foreman = dailyTaskUser(UserLevel::FOREMAN);
    $other = dailyTaskUser(UserLevel::FOREMAN);
    $schedule = fieldSchedule($foreman, []);

    Sanctum::actingAs($foreman);
    $response = $this->postJson("/api/me/daily-tasks/schedules/{$schedule->uuid}", [
        'title' => 'Verify opening dimensions',
        'description' => 'Measure before installation',
        'performed_by' => 'foreman',
        'requires_photo' => true,
        'requires_quality_control' => false,
    ])->assertCreated()
        ->assertJsonPath('task.created_by.id', $foreman->id)
        ->assertJsonPath('task.updated_by.id', $foreman->id);

    $task = DailyTask::where('uuid', $response->json('task.uuid'))->firstOrFail();
    expect($task->created_by)->toBe($foreman->id)
        ->and($task->updated_by)->toBe($foreman->id)
        ->and($task->foreman_user_id)->toBe($foreman->id)
        ->and($schedule->dailyTasks()->whereKey($task->id)->exists())->toBeTrue();

    $this->patchJson("/api/me/daily-tasks/schedules/{$schedule->uuid}/{$task->uuid}", [
        'title' => 'Verify final opening dimensions',
        'description' => 'Measure before installation',
        'performed_by' => 'foreman',
        'requires_photo' => true,
        'requires_quality_control' => true,
    ])->assertOk()
        ->assertJsonPath('task.title', 'Verify final opening dimensions')
        ->assertJsonPath('task.updated_by.id', $foreman->id);

    $overview = WorkScheduleOverview::query()->whereKey($schedule->id)->firstOrFail();
    expect($overview->daily_tasks[0]['title'])->toBe('Verify final opening dimensions')
        ->and((int) $overview->daily_tasks[0]['created_by_id'])->toBe($foreman->id)
        ->and((int) $overview->daily_tasks[0]['updated_by_id'])->toBe($foreman->id);

    $this->getJson('/api/me/work-schedule')
        ->assertOk()
        ->assertJsonPath('schedules.0.daily_tasks.0.title', 'Verify final opening dimensions')
        ->assertJsonPath('schedules.0.daily_tasks.0.updated_by_name', $foreman->name);

    Sanctum::actingAs($other);
    $this->patchJson("/api/me/daily-tasks/schedules/{$schedule->uuid}/{$task->uuid}", [
        'title' => 'Unauthorized change',
        'description' => null,
        'performed_by' => 'anyone',
        'requires_photo' => false,
        'requires_quality_control' => false,
    ])->assertForbidden();

    Sanctum::actingAs($foreman);
    $this->deleteJson("/api/me/daily-tasks/schedules/{$schedule->uuid}/{$task->uuid}")
        ->assertOk()
        ->assertJsonPath('message', 'Task removed from the work schedule.');

    expect($schedule->dailyTasks()->whereKey($task->id)->exists())->toBeFalse()
        ->and($task->fresh()->is_active)->toBeFalse()
        ->and($task->fresh()->updated_by)->toBe($foreman->id);

    $permissions = $foreman->level->permissions;
    $foreman->level->forceFill([
        'permissions' => [
            ...$permissions,
            'create-schedule-tasks' => false,
        ],
    ])->save();
    $foreman->unsetRelation('level');
    Sanctum::actingAs($foreman);

    $this->postJson("/api/me/daily-tasks/schedules/{$schedule->uuid}", [
        'title' => 'Permission denied',
        'description' => null,
        'performed_by' => 'anyone',
        'requires_photo' => false,
        'requires_quality_control' => false,
    ])->assertForbidden();
});

test('the schedule foreman dropdown lists employees with their job title', function () {
    $admin = dailyTaskUser(UserLevel::SUPER_ADMIN);
    $foremanUser = dailyTaskUser(UserLevel::FOREMAN);
    $title = JobTitle::create(['name' => 'Site Superintendent']);
    Employee::create([
        'first_name' => 'Marta',
        'last_name' => 'Lopes',
        'email' => 'marta@example.com',
        'employment_status' => Employee::STATUS_ACTIVE,
        'user_id' => $foremanUser->id,
        'job_title_id' => $title->id,
    ]);
    $schedule = fieldSchedule($foremanUser, []);

    $this->actingAs($admin)->get(route('admin.employee-schedules.create'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('foremen.0.id', $foremanUser->id)
            ->where('foremen.0.name', 'Marta Lopes')
            ->where('foremen.0.job_title', 'Site Superintendent'));

    $this->actingAs($admin)->get(route('admin.employee-schedules.edit', $schedule))
        ->assertInertia(fn (Assert $page) => $page
            ->where('schedule.foreman.name', 'Marta Lopes')
            ->where('schedule.foreman.job_title', 'Site Superintendent'));
});

test('an employee login stays in the users list even when the name matches the private account', function () {
    $admin = dailyTaskUser(UserLevel::SUPER_ADMIN);
    $foreman = dailyTaskUser(UserLevel::FOREMAN);
    $foreman->forceFill(['name' => 'Ricardo Scarpim', 'email' => 'rscarpim@example.com'])->save();
    Employee::create([
        'first_name' => 'Ricardo',
        'last_name' => 'Scarpim',
        'email' => 'rscarpim@example.com',
        'employment_status' => Employee::STATUS_ACTIVE,
        'user_id' => $foreman->id,
    ]);

    $this->actingAs($admin)->get(route('admin.users.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('users.data', fn ($users) => collect($users)->pluck('email')->contains('rscarpim@example.com')));
});

test('an employee login sharing the private account name can be opened for editing', function () {
    $admin = dailyTaskUser(UserLevel::SUPER_ADMIN);
    $foreman = dailyTaskUser(UserLevel::FOREMAN);
    $foreman->forceFill(['name' => 'Ricardo Scarpim', 'email' => 'rscarpim2@example.com'])->save();
    Employee::create([
        'first_name' => 'Ricardo',
        'last_name' => 'Scarpim',
        'email' => 'rscarpim2@example.com',
        'employment_status' => Employee::STATUS_ACTIVE,
        'user_id' => $foreman->id,
    ]);

    $this->actingAs($admin)->get(route('admin.users.edit', $foreman))->assertOk();
});

test('a schedule accepts only quality control employees and certifications can be marked competent', function () {
    $admin = dailyTaskUser(UserLevel::SUPER_ADMIN);
    $foreman = dailyTaskUser(UserLevel::FOREMAN);
    $schedule = fieldSchedule($foreman, []);
    $make = fn (string $name, bool $qc) => Employee::create([
        'first_name' => $name,
        'last_name' => 'Test',
        'email' => strtolower($name).'@example.com',
        'employment_status' => Employee::STATUS_ACTIVE,
        'is_quality_control' => $qc,
    ]);
    $inspector = $make('Quinn', true);
    $regular = $make('Rex', false);

    $payload = fn (Employee $qc) => [
        'project_uuid' => $schedule->project->uuid,
        'starts_on' => $schedule->starts_on->toDateString(),
        'ends_on' => $schedule->ends_on->toDateString(),
        'status' => 'active',
        'foreman_user_id' => $foreman->id,
        'employee_uuids' => [$regular->uuid],
        'quality_control_uuid' => $qc->uuid,
    ];

    $this->actingAs($admin)->patch(route('admin.employee-schedules.update', $schedule), $payload($regular))
        ->assertSessionHasErrors('quality_control_uuid');
    $this->actingAs($admin)->patch(route('admin.employee-schedules.update', $schedule), $payload($inspector))
        ->assertSessionHasNoErrors();

    expect($schedule->fresh()->quality_control_employee_id)->toBe($inspector->id);

    $certification = Certification::findOrCreateByName('Scaffold Competent');
    $this->actingAs($admin)->patch(route('admin.certifications.update', $certification), ['is_competent_person' => true])
        ->assertSessionHasNoErrors();
    expect($certification->fresh()->is_competent_person)->toBeTrue();
});

test('a task can be created on the fly from just a name', function () {
    $admin = dailyTaskUser(UserLevel::SUPER_ADMIN);

    $this->actingAs($admin)->post(route('admin.daily-tasks.store'), ['name' => 'Wear PPE', 'is_active' => '1'])
        ->assertSessionHasNoErrors();

    expect(DailyTask::where('title', 'Wear PPE')->where('is_active', true)->exists())->toBeTrue();
});

test('daily tasks pick a reusable title from a catalog', function () {
    $admin = dailyTaskUser(UserLevel::SUPER_ADMIN);

    $this->actingAs($admin)->post(route('admin.daily-task-titles.store'), ['name' => 'Safety walk'])->assertSessionHasNoErrors();
    $titleId = DailyTaskTitle::where('name', 'Safety walk')->value('id');

    $this->actingAs($admin)->post(route('admin.daily-tasks.store'), [
        'daily_task_title_id' => $titleId,
        'description' => 'North crew',
        'is_active' => true,
    ])->assertSessionHasNoErrors();

    $tasks = DailyTask::where('daily_task_title_id', $titleId)->get();
    expect($tasks)->toHaveCount(1)->and($tasks->first()->title)->toBe('Safety walk');

    $this->actingAs($admin)->patch(route('admin.daily-tasks.update', $tasks->first()), [
        'daily_task_title_id' => $titleId,
        'description' => 'Changed',
        'is_active' => true,
    ])->assertSessionHasNoErrors();
});

test('the same active task cannot be added twice', function () {
    $admin = dailyTaskUser(UserLevel::SUPER_ADMIN);
    $titleId = DailyTaskTitle::create(['name' => 'Lockout check'])->id;
    $body = ['daily_task_title_id' => $titleId, 'is_active' => true];

    $this->actingAs($admin)->post(route('admin.daily-tasks.store'), $body)->assertSessionHasNoErrors();
    $this->actingAs($admin)->post(route('admin.daily-tasks.store'), $body)->assertSessionHasErrors('daily_task_title_id');

    expect(DailyTask::where('daily_task_title_id', $titleId)->count())->toBe(1);
});

test('an inactive task still blocks adding the same task again', function () {
    $admin = dailyTaskUser(UserLevel::SUPER_ADMIN);
    $titleId = DailyTaskTitle::create(['name' => 'Door check'])->id;
    DailyTask::create(['title' => 'Door check', 'is_active' => false]);

    $this->actingAs($admin)->post(route('admin.daily-tasks.store'), ['daily_task_title_id' => $titleId, 'is_active' => true])
        ->assertSessionHasErrors('daily_task_title_id');
});

test('an employee sees only their own jobs and cannot manage levels or employees', function () {
    $foreman = dailyTaskUser(UserLevel::FOREMAN);
    $schedule = fieldSchedule($foreman, []);
    $worker = dailyTaskUser(UserLevel::EMPLOYEE);
    $other = dailyTaskUser(UserLevel::EMPLOYEE);

    $make = fn (User $user, string $name) => Employee::create([
        'first_name' => $name,
        'last_name' => 'Test',
        'email' => strtolower($name).'@example.com',
        'employment_status' => Employee::STATUS_ACTIVE,
        'user_id' => $user->id,
    ]);
    $crew = $make($worker, 'Wally');
    $make($other, 'Olga');
    $schedule->employees()->attach($crew->id);
    $task = DailyTask::create(['title' => 'Hang doors', 'is_active' => true, 'requires_photo' => true]);
    $schedule->dailyTasks()->attach($task->id);

    $this->actingAs($worker)->get(route('admin.my-schedule.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/MySchedule/Index')
            ->has('schedules', 1)
            ->where('schedules.0.tasks.0.title', 'Hang doors')
            ->where('schedules.0.foreman.id', $foreman->id)
            ->where('schedules.0.project.name', $schedule->project->name));

    $this->actingAs($other)->get(route('admin.my-schedule.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('schedules', 0));

    $this->actingAs($worker)->get(route('dashboard'))->assertOk();
    $this->actingAs($worker)->get(route('profile.edit'))->assertOk();
    $this->actingAs($worker)->get(route('admin.access-control.edit'))->assertForbidden();
    $this->actingAs($worker)->get(route('admin.employees.index'))->assertForbidden();
    $this->actingAs($worker)->get(route('admin.employee-schedules.index'))->assertForbidden();
});

test('a foreman delegates a task to a crew member but restricted tasks stay with their role', function () {
    $foreman = dailyTaskUser(UserLevel::FOREMAN);
    $mk = fn (string $name) => Employee::create([
        'first_name' => $name,
        'last_name' => 'Test',
        'email' => strtolower($name).'@example.com',
        'employment_status' => Employee::STATUS_ACTIVE,
    ]);
    $crew = $mk('Crew');
    $foremanEmployee = $mk('Lead');
    $foremanEmployee->update(['user_id' => $foreman->id]);
    $outsider = $mk('Outsider');
    $qc = $mk('Quinn');

    $open = DailyTask::create(['title' => 'Sweep', 'is_active' => true]);
    $foremanOnly = DailyTask::create(['title' => 'Sign off', 'is_active' => true, 'performed_by' => DailyTask::PERFORMER_FOREMAN]);
    $qcTask = DailyTask::create(['title' => 'Inspect', 'is_active' => true, 'performed_by' => DailyTask::PERFORMER_QUALITY_CONTROL]);
    $competentTask = DailyTask::create(['title' => 'Scaffold', 'is_active' => true, 'performed_by' => DailyTask::PERFORMER_COMPETENT]);
    $schedule = fieldSchedule($foreman, [$open, $foremanOnly, $qcTask, $competentTask]);
    $schedule->employees()->attach($crew->id);

    $post = fn (DailyTask $task, array $extra = []) => $this->actingAs($foreman)
        ->post(route('admin.daily-tasks.progress', $task), ['schedule_uuid' => $schedule->uuid, 'status' => 'completed'] + $extra);

    $post($open, ['performed_by_employee_uuid' => $crew->uuid])->assertSessionHasNoErrors();
    expect(DailyTaskCompletion::where('daily_task_id', $open->id)->first()->performed_by_employee_id)->toBe($crew->id);

    $post($open, ['performed_by_employee_uuids' => [$crew->uuid, $foremanEmployee->uuid]])->assertSessionHasNoErrors();
    expect(DailyTaskCompletion::where('daily_task_id', $open->id)->first()->performers)->toHaveCount(2);

    $post($open, ['performed_by_employee_uuid' => $outsider->uuid])->assertSessionHasErrors('performed_by_employee_uuids');
    $post($foremanOnly, ['performed_by_employee_uuid' => $crew->uuid])->assertSessionHasErrors('performed_by_employee_uuids');
    $post($qcTask)->assertSessionHasErrors('performed_by_employee_uuids');
    $post($competentTask)->assertSessionHasErrors('performed_by_employee_uuids');

    $schedule->update(['quality_control_employee_id' => $qc->id]);
    $post($qcTask)->assertSessionHasNoErrors();
    expect(DailyTaskCompletion::where('daily_task_id', $qcTask->id)->first()->performed_by_employee_id)->toBe($qc->id);
});
