<?php

use App\Models\ClientCompany;
use App\Models\DailyTask;
use App\Models\DailyTaskCompletion;
use App\Models\Employee;
use App\Models\EmployeeWorkSchedule;
use App\Models\Project;
use App\Models\User;
use App\Models\UserLevel;
use App\Support\ClientPortalAccess;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

function portalLevel(string $name): UserLevel
{
    $level = UserLevel::firstOrCreate(['name' => $name]);
    $level->forceFill(['permissions' => $level->defaultPermissions()])->save();

    return $level;
}

function portalCompany(string $name = 'Acme'): ClientCompany
{
    return ClientCompany::create(['name' => $name]);
}

function portalProject(string $name = 'Tower A', ?ClientCompany $company = null): Project
{
    $project = Project::create(['name' => $name]);

    if ($company) {
        $project->forceFill(['client_company_id' => $company->id])->save();
    }

    return $project;
}

/** Creates a company member: role is master, manager or viewer. */
function portalMember(ClientCompany $company, string $role = 'viewer', bool $allProjects = true): User
{
    $manager = $role !== 'viewer';
    $user = User::factory()->create([
        'level_id' => portalLevel($manager ? UserLevel::CLIENT_MANAGER : UserLevel::CLIENT)->id,
    ]);
    $company->users()->attach($user->id, ['is_master' => $role === 'master', 'all_projects' => $allProjects]);

    return $user;
}

test('clients only see the projects of their company', function () {
    $company = portalCompany();
    $mine = portalProject('Mine', $company);
    $other = portalProject('Other', portalCompany('Other co'));
    $client = portalMember($company);

    $this->actingAs($client)->get(route('portal.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Portal/Index')
            ->has('projects', 1)
            ->where('projects.0.name', 'Mine')
            ->where('company', 'Acme'));

    $this->actingAs($client)->get(route('portal.projects.show', $mine))->assertOk();
    $this->actingAs($client)->get(route('portal.projects.show', $other))->assertNotFound();
});

test('delegated viewers only see the projects they were given', function () {
    $company = portalCompany();
    $first = portalProject('First', $company);
    $second = portalProject('Second', $company);
    $master = portalMember($company, 'master');
    $viewer = portalMember($company, 'viewer', allProjects: false);
    $viewer->clientProjects()->attach($first->id);

    $this->actingAs($master)->get(route('portal.index'))
        ->assertInertia(fn (Assert $page) => $page->has('projects', 2));
    $this->actingAs($viewer)->get(route('portal.index'))
        ->assertInertia(fn (Assert $page) => $page->has('projects', 1)->where('projects.0.name', 'First'));
    $this->actingAs($viewer)->get(route('portal.projects.show', $second))->assertNotFound();
});

test('clients cannot open the internal application', function () {
    $client = portalMember(portalCompany());

    $this->actingAs($client)->get(route('dashboard'))->assertForbidden();
    $this->actingAs($client)->get(route('admin.projects.index'))->assertForbidden();
});

test('team members cannot open the client portal', function () {
    $employee = User::factory()->create(['level_id' => portalLevel(UserLevel::EMPLOYEE)->id]);

    $this->actingAs($employee)->get(route('portal.index'))->assertForbidden();
});

test('the portal shows crew, progress and photos but no private data', function () {
    Storage::fake('local');
    $company = portalCompany();
    $project = portalProject('Tower A', $company);
    $client = portalMember($company);
    $foreman = User::factory()->create();
    $worker = Employee::create([
        'first_name' => 'Maria', 'last_name' => 'Silva', 'phone_number' => '555-0100', 'email' => 'maria@example.com',
    ]);

    $schedule = EmployeeWorkSchedule::create([
        'project_id' => $project->id,
        'starts_on' => now()->subDay()->toDateString(),
        'ends_on' => now()->addDay()->toDateString(),
        'status' => EmployeeWorkSchedule::STATUS_ACTIVE,
        'foreman_user_id' => $foreman->id,
    ]);
    $schedule->employees()->attach($worker->id);

    $task = DailyTask::create(['title' => 'Hang doors', 'is_active' => true]);
    $schedule->dailyTasks()->attach($task->id);
    $completion = DailyTaskCompletion::create([
        'daily_task_id' => $task->id,
        'user_id' => $foreman->id,
        'employee_work_schedule_id' => $schedule->id,
        'work_date' => now()->toDateString(),
        'status' => DailyTaskCompletion::STATUS_IN_PROGRESS,
        'progress' => 40,
    ]);
    Storage::disk('local')->put('daily-task-photos/a.jpg', 'img');
    $photo = $completion->photos()->create(['path' => 'daily-task-photos/a.jpg', 'original_name' => 'a.jpg']);

    $response = $this->actingAs($client)->get(route('portal.projects.show', $project))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Portal/Show')
            ->where('progress.overall_progress', 40)
            ->where('progress.is_working_today', true)
            ->where('progress.schedules.0.crew.0.name', 'Maria Silva')
            ->where('progress.tasks.0.title', 'Hang doors')
            ->has('progress.photos', 1)
            ->where('canManageTeam', false));

    expect($response->getContent())->not->toContain('555-0100');

    $this->actingAs($client)->get(route('portal.photos.show', $photo))->assertOk();
});

test('a client cannot open photos from another company', function () {
    Storage::fake('local');
    $client = portalMember(portalCompany());
    $other = portalProject('Other', portalCompany('Other co'));

    $schedule = EmployeeWorkSchedule::create([
        'project_id' => $other->id,
        'starts_on' => now()->toDateString(),
        'ends_on' => now()->toDateString(),
        'status' => EmployeeWorkSchedule::STATUS_ACTIVE,
    ]);
    $task = DailyTask::create(['title' => 'Secret', 'is_active' => true]);
    $completion = DailyTaskCompletion::create([
        'daily_task_id' => $task->id,
        'user_id' => User::factory()->create()->id,
        'employee_work_schedule_id' => $schedule->id,
        'work_date' => now()->toDateString(),
        'status' => DailyTaskCompletion::STATUS_COMPLETED,
    ]);
    Storage::disk('local')->put('daily-task-photos/b.jpg', 'img');
    $photo = $completion->photos()->create(['path' => 'daily-task-photos/b.jpg', 'original_name' => 'b.jpg']);

    $this->actingAs($client)->get(route('portal.photos.show', $photo))->assertNotFound();
});

test('the master adds viewers and managers and delegates project access', function () {
    Notification::fake();
    $company = portalCompany();
    $first = portalProject('First', $company);
    portalProject('Second', $company);
    $master = portalMember($company, 'master');

    $this->actingAs($master)->post(route('portal.team.store'), [
        'name' => 'Pat Viewer',
        'email' => 'pat@example.com',
        'role' => 'viewer',
        'all_projects' => false,
        'project_uuids' => [$first->uuid],
    ])->assertSessionHasNoErrors();

    $pat = User::where('email', 'pat@example.com')->firstOrFail();
    expect($pat->level->name)->toBe(UserLevel::CLIENT)
        ->and($company->users()->whereKey($pat->id)->exists())->toBeTrue()
        ->and($pat->clientProjects()->pluck('projects.id')->all())->toBe([$first->id]);

    $this->actingAs($master)->post(route('portal.team.store'), [
        'name' => 'Mia Manager', 'email' => 'mia@example.com', 'role' => 'manager',
    ])->assertSessionHasNoErrors();
    expect(User::where('email', 'mia@example.com')->first()->level->name)->toBe(UserLevel::CLIENT_MANAGER);

    $this->actingAs($master)->patch(route('portal.team.update', $pat), [
        'role' => 'viewer', 'all_projects' => true,
    ])->assertSessionHasNoErrors();
    expect($pat->clientProjects()->count())->toBe(0);

    $this->actingAs($master)->delete(route('portal.team.destroy', $pat))->assertSessionHasNoErrors();
    expect($company->users()->whereKey($pat->id)->exists())->toBeFalse();
});

test('managers manage viewers but cannot create managers or touch the master', function () {
    Notification::fake();
    $company = portalCompany();
    portalProject('First', $company);
    $master = portalMember($company, 'master');
    $manager = portalMember($company, 'manager');
    $viewer = portalMember($company, 'viewer');

    $this->actingAs($manager)->post(route('portal.team.store'), [
        'name' => 'Sneaky', 'email' => 'sneaky@example.com', 'role' => 'manager',
    ])->assertSessionHasNoErrors();
    expect(User::where('email', 'sneaky@example.com')->first()->level->name)->toBe(UserLevel::CLIENT);

    $this->actingAs($manager)->delete(route('portal.team.destroy', $master))->assertForbidden();
    $this->actingAs($manager)->delete(route('portal.team.destroy', $manager))->assertForbidden();
    $this->actingAs($manager)->delete(route('portal.team.destroy', $viewer))->assertSessionHasNoErrors();

    $otherManager = portalMember($company, 'manager');
    $this->actingAs($manager)->delete(route('portal.team.destroy', $otherManager))->assertForbidden();
    $this->actingAs($master)->delete(route('portal.team.destroy', $otherManager))->assertSessionHasNoErrors();
});

test('viewers and other companies cannot manage a team', function () {
    $company = portalCompany();
    $viewer = portalMember($company, 'viewer');
    $stranger = portalMember(portalCompany('Other'), 'master');
    $target = portalMember($company, 'viewer');

    $this->actingAs($viewer)->get(route('portal.team.index'))->assertForbidden();
    $this->actingAs($viewer)->post(route('portal.team.store'), [
        'name' => 'X', 'email' => 'x@example.com', 'role' => 'viewer',
    ])->assertForbidden();
    $this->actingAs($stranger)->delete(route('portal.team.destroy', $target))->assertForbidden();
    expect($company->users()->whereKey($target->id)->exists())->toBeTrue();
});

test('team emails and people from another company are refused', function () {
    $company = portalCompany();
    $master = portalMember($company, 'master');
    $team = User::factory()->create(['level_id' => portalLevel(UserLevel::EMPLOYEE)->id]);
    $foreign = portalMember(portalCompany('Other'), 'viewer');

    foreach ([$team->email, $foreign->email] as $email) {
        $this->actingAs($master)->post(route('portal.team.store'), [
            'name' => 'N', 'email' => $email, 'role' => 'viewer',
        ])->assertSessionHasErrors('email');
    }
});

test('project uuids from other companies cannot be delegated', function () {
    $master = portalMember(portalCompany(), 'master');
    $foreign = portalProject('Foreign', portalCompany('Other'));

    $this->actingAs($master)->post(route('portal.team.store'), [
        'name' => 'N', 'email' => 'n@example.com', 'role' => 'viewer',
        'all_projects' => false, 'project_uuids' => [$foreign->uuid],
    ])->assertSessionHasErrors('project_uuids.0');
});

test('administrators create a company with its master and unlink it', function () {
    Notification::fake();
    $admin = User::factory()->create(['level_id' => portalLevel(UserLevel::SUPER_ADMIN)->id]);
    $project = portalProject();

    $this->actingAs($admin)->post(route('admin.projects.client-company.store', $project), [
        'company_name' => 'Acme Builders', 'name' => 'Owner Person', 'email' => 'owner@example.com',
    ])->assertSessionHasNoErrors();

    $project->refresh();
    $owner = User::where('email', 'owner@example.com')->firstOrFail();
    expect($project->clientCompany->name)->toBe('Acme Builders')
        ->and($owner->level->name)->toBe(UserLevel::CLIENT_MANAGER)
        ->and(ClientPortalAccess::isMaster($owner))->toBeTrue()
        ->and($owner->email_verified_at)->not->toBeNull();

    $this->actingAs($owner)->get(route('portal.projects.show', $project))
        ->assertInertia(fn (Assert $page) => $page->where('canManageTeam', true));

    $this->actingAs($admin)->post(route('admin.projects.client-users.store', $project), [
        'name' => 'New Master', 'email' => 'master2@example.com', 'role' => 'master',
    ])->assertSessionHasNoErrors();
    expect(ClientPortalAccess::isMaster($owner->fresh()))->toBeFalse();

    $this->actingAs($admin)->delete(route('admin.projects.client-users.destroy', [$project, $owner]))
        ->assertSessionHasNoErrors();
    expect($project->clientCompany->users()->whereKey($owner->id)->exists())->toBeFalse();

    $this->actingAs($admin)->delete(route('admin.projects.client-company.destroy', $project))
        ->assertSessionHasNoErrors();
    expect($project->fresh()->client_company_id)->toBeNull();
});

test('administrators can link an existing company to another project', function () {
    $admin = User::factory()->create(['level_id' => portalLevel(UserLevel::SUPER_ADMIN)->id]);
    $company = portalCompany();
    $project = portalProject('Second job');

    $this->actingAs($admin)->post(route('admin.projects.client-company.store', $project), [
        'client_company_uuid' => $company->uuid,
    ])->assertSessionHasNoErrors();

    expect($project->fresh()->client_company_id)->toBe($company->id);
});

test('non administrators cannot manage client access from the project', function () {
    $project = portalProject();
    $user = User::factory()->create(['level_id' => portalLevel(UserLevel::EMPLOYEE)->id]);

    $this->actingAs($user)
        ->post(route('admin.projects.client-users.store', $project), [
            'name' => 'A', 'email' => 'a@example.com', 'role' => 'viewer',
        ])
        ->assertForbidden();
});

test('clients land on the portal after signing in', function () {
    $client = portalMember(portalCompany());

    $this->post('/login', ['email' => $client->email, 'password' => 'password'])
        ->assertRedirect(route('portal.index'));
});

test('administrators set the company when creating and updating a client user', function () {
    Notification::fake();
    $admin = User::factory()->create(['level_id' => portalLevel(UserLevel::SUPER_ADMIN)->id]);
    $company = portalCompany();
    $base = ['password' => 'Str0ng!Passw0rd#', 'password_confirmation' => 'Str0ng!Passw0rd#'];
    $client = portalLevel(UserLevel::CLIENT);
    $manager = portalLevel(UserLevel::CLIENT_MANAGER);

    $this->actingAs($admin)->post(route('admin.users.store'), [
        ...$base, 'name' => 'No Company', 'email' => 'nocompany@example.com', 'level_id' => $client->id,
    ])->assertSessionHasErrors('client_company_uuid');

    $this->actingAs($admin)->post(route('admin.users.store'), [
        ...$base, 'name' => 'Viewer', 'email' => 'viewer@example.com', 'level_id' => $client->id,
        'client_company_uuid' => $company->uuid,
    ])->assertSessionHasNoErrors();
    $viewer = User::where('email', 'viewer@example.com')->firstOrFail();
    expect(ClientPortalAccess::company($viewer)->id)->toBe($company->id);

    $this->actingAs($admin)->post(route('admin.users.store'), [
        ...$base, 'name' => 'Boss', 'email' => 'boss@example.com', 'level_id' => $manager->id,
        'client_company_name' => 'Brand New Co', 'client_company_master' => true,
    ])->assertSessionHasNoErrors();
    $boss = User::where('email', 'boss@example.com')->firstOrFail();
    expect(ClientPortalAccess::company($boss)->name)->toBe('Brand New Co')
        ->and(ClientPortalAccess::isMaster($boss))->toBeTrue();

    $this->actingAs($admin)->patch(route('admin.users.update', $viewer), [
        'name' => 'Viewer', 'email' => 'viewer@example.com', 'level_id' => $client->id,
        'client_company_uuid' => ClientPortalAccess::company($boss)->uuid,
    ])->assertSessionHasNoErrors();
    expect(ClientPortalAccess::company($viewer->fresh())->name)->toBe('Brand New Co');

    $this->actingAs($admin)->patch(route('admin.users.update', $viewer), [
        'name' => 'Viewer', 'email' => 'viewer@example.com', 'level_id' => portalLevel(UserLevel::EMPLOYEE)->id,
    ])->assertSessionHasNoErrors();
    expect(ClientPortalAccess::company($viewer->fresh()))->toBeNull();
});

test('administrators add and remove users under a company from the user screen', function () {
    Notification::fake();
    $admin = User::factory()->create(['level_id' => portalLevel(UserLevel::SUPER_ADMIN)->id]);
    $company = portalCompany();
    $master = portalMember($company, 'master');

    $this->actingAs($admin)->get(route('admin.users.edit', $master))
        ->assertInertia(fn (Assert $page) => $page
            ->where('clientCompany.uuid', $company->uuid)
            ->where('clientCompany.is_master', true)
            ->has('clientCompanies', 1));

    $this->actingAs($admin)->post(route('admin.client-companies.members.store', $company), [
        'name' => 'Sub User', 'email' => 'sub@example.com', 'role' => 'viewer',
    ])->assertSessionHasNoErrors();
    $sub = User::where('email', 'sub@example.com')->firstOrFail();
    expect($company->users()->whereKey($sub->id)->exists())->toBeTrue();

    $this->actingAs($admin)->delete(route('admin.client-companies.members.destroy', [$company, $sub]))
        ->assertSessionHasNoErrors();
    expect($company->users()->whereKey($sub->id)->exists())->toBeFalse();
});

test('directory companies are offered for client users and become client companies when chosen', function () {
    Notification::fake();
    $admin = User::factory()->create(['level_id' => portalLevel(UserLevel::SUPER_ADMIN)->id]);
    $directory = \App\Models\ContactDirectory\ContactCompany::create(['name' => 'Directory Co']);
    $client = portalLevel(UserLevel::CLIENT);

    $this->actingAs($admin)->get(route('admin.users.create'))
        ->assertInertia(fn (Assert $page) => $page->where('clientCompanies.0.name', 'Directory Co')
            ->where('clientCompanies.0.uuid', 'directory:'.$directory->uuid));

    $this->actingAs($admin)->post(route('admin.users.store'), [
        'name' => 'Dir Client', 'email' => 'dir@example.com', 'level_id' => $client->id,
        'password' => 'Str0ng!Passw0rd#', 'password_confirmation' => 'Str0ng!Passw0rd#',
        'client_company_uuid' => 'directory:'.$directory->uuid,
    ])->assertSessionHasNoErrors();

    $user = User::where('email', 'dir@example.com')->firstOrFail();
    expect(ClientPortalAccess::company($user)->contact_company_id)->toBe($directory->id);

    $this->actingAs($admin)->get(route('admin.users.create'))
        ->assertInertia(fn (Assert $page) => $page->has('clientCompanies', 1)
            ->where('clientCompanies.0.uuid', ClientPortalAccess::company($user)->uuid));
});

test('the users list groups client company users under the company instead of separate rows', function () {
    $admin = User::factory()->create(['level_id' => portalLevel(UserLevel::SUPER_ADMIN)->id]);
    $company = portalCompany();
    $master = portalMember($company, 'master');
    $viewer = portalMember($company, 'viewer');
    $plain = User::factory()->create();

    $this->actingAs($admin)->get(route('admin.users.index'))
        ->assertInertia(function (Assert $page) use ($company, $master, $viewer, $plain) {
            $page->has('clientGroups', 1)
                ->where('clientGroups.0.uuid', $company->uuid)
                ->where('clientGroups.0.members.0.uuid', $master->uuid)
                ->where('clientGroups.0.members.0.client_role', 'master')
                ->has('clientGroups.0.members', 2);
            $ids = collect($page->toArray()['props']['users']['data'])->pluck('uuid');
            expect($ids)->toContain($plain->uuid)->not->toContain($master->uuid)->not->toContain($viewer->uuid);
        });
});
