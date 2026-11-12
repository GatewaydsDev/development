<?php

use App\Models\User;
use App\Models\UserActivity;
use App\Models\UserLevel;
use App\Models\UserLoginLog;
use App\Models\UserPresenceDevice;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Testing\AssertableInertia as Assert;

test('super admins can view the access control page', function () {
    $superAdminLevel = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $superAdmin = User::factory()->create(['level_id' => $superAdminLevel->id]);

    $this->actingAs($superAdmin)
        ->get(route('admin.access-control.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/AccessControl/Edit')
            ->has('permissions')
            ->where('permissions', function ($permissions): bool {
                $permissions = collect($permissions);

                return $permissions->contains(
                    fn (array $permission): bool => $permission['key'] === 'delete-schedule-tasks'
                        && $permission['group'] === 'Field operations'
                        && $permission['name'] === 'Remove tasks from own schedules'
                        && $permission['parent_key'] === 'view-daily-tasks',
                ) && $permissions->contains(
                    fn (array $permission): bool => $permission['key'] === 'view-takeoff-pricing'
                        && $permission['parent_key'] === 'view-takeoffs',
                );
            })
            ->has('levels')
        );
});

test('super admins can override permissions for one user without changing their level', function () {
    $superAdminLevel = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $foremanLevel = UserLevel::firstOrCreate(['name' => UserLevel::FOREMAN]);
    $superAdmin = User::factory()->create(['level_id' => $superAdminLevel->id]);
    $john = User::factory()->create(['name' => 'John Foreman', 'level_id' => $foremanLevel->id]);
    $maria = User::factory()->create(['name' => 'Maria Foreman', 'level_id' => $foremanLevel->id]);

    expect($john->hasPermission('delete-schedule-tasks'))->toBeTrue()
        ->and($maria->hasPermission('delete-schedule-tasks'))->toBeTrue();

    $websiteOverrides = collect(config('access.permissions'))
        ->keys()
        ->mapWithKeys(fn (string $permission): array => [$permission => null])
        ->merge([
            'view-users' => true,
            'create-schedule-tasks' => false,
            'delete-schedule-tasks' => false,
        ])
        ->all();
    $mobileOverrides = collect(config('access.permissions'))
        ->keys()
        ->mapWithKeys(fn (string $permission): array => [$permission => null])
        ->merge([
            'view-users' => true,
            'create-schedule-tasks' => false,
            'delete-schedule-tasks' => false,
        ])
        ->all();

    $this->actingAs($superAdmin)
        ->patch(route('admin.users.permissions.update', $john), [
            'permission_overrides' => $websiteOverrides,
            'mobile_permission_overrides' => $mobileOverrides,
        ])
        ->assertSessionHasNoErrors();

    $stored = DB::table('users')->where('id', $john->id)->firstOrFail();
    expect(json_decode($stored->permission_overrides, true))->toBe([
        'view-users' => true,
        'create-schedule-tasks' => false,
        'delete-schedule-tasks' => false,
    ])->and(json_decode($stored->mobile_permission_overrides, true))->toBe([
        'view-users' => true,
        'create-schedule-tasks' => false,
        'delete-schedule-tasks' => false,
    ]);
    $this->assertDatabaseHas('user_activities', [
        'user_id' => $superAdmin->id,
        'event_type' => UserActivity::TYPE_RECORD_UPDATED,
        'subject_type' => User::class,
        'subject_id' => $john->id,
    ]);

    expect($john->fresh()->hasPermission('create-schedule-tasks'))->toBeFalse()
        ->and($john->fresh()->hasPermission('delete-schedule-tasks'))->toBeFalse()
        ->and($john->fresh()->hasMobilePermission('delete-schedule-tasks'))->toBeFalse()
        ->and($john->fresh()->hasPermission('view-users'))->toBeTrue()
        ->and($john->fresh()->hasMobilePermission('view-users'))->toBeTrue()
        ->and(Gate::forUser($john->fresh())->allows('view-users'))->toBeTrue()
        ->and($maria->fresh()->hasPermission('create-schedule-tasks'))->toBeTrue()
        ->and($maria->fresh()->hasPermission('delete-schedule-tasks'))->toBeTrue()
        ->and($maria->fresh()->hasPermission('view-users'))->toBeFalse();

    $this->actingAs($superAdmin)
        ->get(route('admin.users.edit', $john))
        ->assertInertia(fn (Assert $page) => $page
            ->where('canManageIndividualPermissions', true)
            ->where('accessPermissions', function ($permissions): bool {
                $parents = collect($permissions)->pluck('parent_key', 'key');

                return collect([
                    'create-employees' => 'view-employees',
                    'create-contractors' => 'view-contractors',
                    'create-services' => 'view-services',
                    'create-products' => 'view-products',
                    'create-quotations' => 'view-quotations',
                ])->every(
                    fn (string $parent, string $permission): bool => $parents->get($permission) === $parent,
                );
            })
            ->where('managedUser.permission_overrides.view-users', true)
            ->where('managedUser.mobile_permission_overrides.view-users', true)
            ->where('managedUser.permission_overrides.create-schedule-tasks', false)
            ->where('managedUser.level_permissions.create-schedule-tasks', true));
});

test('non super admins cannot view access control', function () {
    foreach ([UserLevel::ADMINISTRATOR, UserLevel::ADMIN, UserLevel::PROJECT_MANAGER, UserLevel::USER] as $levelName) {
        $level = UserLevel::firstOrCreate(['name' => $levelName]);
        $user = User::factory()->create(['level_id' => $level->id]);

        $this->actingAs($user)
            ->get(route('admin.access-control.edit'))
            ->assertForbidden();
    }
});

test('administrators have configured administrator gate permissions by default', function () {
    $administratorLevel = UserLevel::firstOrCreate(['name' => UserLevel::ADMINISTRATOR]);
    $administratorLevel->forceFill([
        'permissions' => $administratorLevel->defaultPermissions(),
    ])->save();

    $administrator = User::factory()->create(['level_id' => $administratorLevel->id]);

    foreach (config('access.defaults.'.UserLevel::ADMINISTRATOR, []) as $permission) {
        expect(Gate::forUser($administrator)->allows($permission))->toBeTrue();
    }

    expect(Gate::forUser($administrator)->allows('manage-access'))->toBeFalse();
    expect(Gate::forUser($administrator)->allows('manage-notifications'))->toBeFalse();
});

test('permission changes are enforced by laravel gates', function () {
    $superAdminLevel = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $adminLevel = UserLevel::firstOrCreate(['name' => UserLevel::ADMIN]);
    $superAdmin = User::factory()->create(['level_id' => $superAdminLevel->id]);
    $admin = User::factory()->create(['level_id' => $adminLevel->id]);

    $this->actingAs($admin)
        ->get(route('admin.users.index'))
        ->assertForbidden();

    $this->actingAs($superAdmin)
        ->patch(route('admin.access-control.update'), [
            'levels' => [
                $adminLevel->id => [
                    'view-dashboard' => true,
                    'manage-profile' => true,
                    'manage-users' => false,
                    'manage-access' => false,
                    'manage-projects' => false,
                ],
            ],
        ])
        ->assertRedirect(route('admin.access-control.index', absolute: false));

    $admin->refresh();

    $this->actingAs($admin)
        ->get(route('admin.users.index'))
        ->assertForbidden();
});

test('mobile rights follow website permissions until they are delegated', function () {
    $superAdminLevel = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $projectManagerLevel = UserLevel::firstOrCreate(['name' => UserLevel::PROJECT_MANAGER]);
    $projectManagerLevel->forceFill([
        'permissions' => $projectManagerLevel->defaultPermissions(),
        'mobile_permissions' => null,
    ])->save();

    $superAdmin = User::factory()->create(['level_id' => $superAdminLevel->id]);

    $this->actingAs($superAdmin)
        ->get(route('admin.access-control.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/AccessControl/Edit')
            ->where('levels', function ($levels) use ($projectManagerLevel): bool {
                $level = collect($levels)->firstWhere('id', $projectManagerLevel->id);

                return $level !== null
                    && $level['permissions']['view-projects'] === true
                    && $level['mobile_permissions']['view-projects'] === true
                    && $level['permissions']['create-projects'] === false
                    && $level['mobile_permissions']['create-projects'] === false;
            })
        );
});

test('mobile rights can be removed without changing the website permission', function () {
    $superAdminLevel = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $projectManagerLevel = UserLevel::firstOrCreate(['name' => UserLevel::PROJECT_MANAGER]);
    $projectManagerLevel->forceFill([
        'permissions' => $projectManagerLevel->defaultPermissions(),
    ])->save();

    $superAdmin = User::factory()->create(['level_id' => $superAdminLevel->id]);
    $projectManager = User::factory()->create(['level_id' => $projectManagerLevel->id]);

    $website = $projectManagerLevel->defaultPermissions();
    $mobile = $website;
    $mobile['view-projects'] = false;

    $this->actingAs($superAdmin)
        ->patch(route('admin.access-control.update'), [
            'levels' => [
                $projectManagerLevel->id => $website,
            ],
            'mobile_levels' => [
                $projectManagerLevel->id => $mobile,
            ],
        ])
        ->assertRedirect(route('admin.access-control.index', absolute: false));

    $projectManagerLevel->refresh();

    expect($projectManagerLevel->hasPermission('view-projects'))->toBeTrue()
        ->and($projectManagerLevel->hasMobilePermission('view-projects'))->toBeFalse()
        ->and($projectManager->fresh()->hasPermission('view-projects'))->toBeTrue()
        ->and($projectManager->fresh()->hasMobilePermission('view-projects'))->toBeFalse();
});

test('mobile rights cannot exceed the website permission', function () {
    $superAdminLevel = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $userLevel = UserLevel::firstOrCreate(['name' => UserLevel::USER]);
    $userLevel->forceFill([
        'permissions' => $userLevel->defaultPermissions(),
    ])->save();

    $superAdmin = User::factory()->create(['level_id' => $superAdminLevel->id]);

    $website = $userLevel->defaultPermissions();
    $mobile = $website;
    $mobile['view-projects'] = true;

    $this->actingAs($superAdmin)
        ->patch(route('admin.access-control.update'), [
            'levels' => [
                $userLevel->id => $website,
            ],
            'mobile_levels' => [
                $userLevel->id => $mobile,
            ],
        ])
        ->assertRedirect(route('admin.access-control.index', absolute: false));

    $userLevel->refresh();

    expect($userLevel->hasPermission('view-projects'))->toBeFalse()
        ->and($userLevel->hasMobilePermission('view-projects'))->toBeFalse();
});

test('custom permissions cannot grant access control without super admin level', function () {
    $level = UserLevel::firstOrCreate(['name' => 'Access Control Only']);
    $level->forceFill([
        'permissions' => [
            'view-dashboard' => true,
            'manage-profile' => true,
            'manage-access' => true,
        ],
    ])->save();
    $user = User::factory()->create(['level_id' => $level->id]);

    $this->actingAs($user)
        ->get(route('admin.access-control.edit'))
        ->assertForbidden();
});

test('super admins can list, rename and delete user levels', function () {
    $superAdminLevel = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $superAdmin = User::factory()->create(['level_id' => $superAdminLevel->id]);
    $level = UserLevel::create(['name' => 'Estimator', 'permissions' => [], 'mobile_permissions' => []]);

    $this->actingAs($superAdmin)
        ->get(route('admin.access-control.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/AccessControl/Index')
            ->has('levels')
        );

    $this->actingAs($superAdmin)
        ->patch(route('admin.access-control.levels.rename', $level), ['name' => 'Senior Estimator'])
        ->assertSessionHasNoErrors();
    expect($level->fresh()->name)->toBe('Senior Estimator');

    $this->actingAs($superAdmin)
        ->delete(route('admin.access-control.levels.destroy', $level));
    expect(UserLevel::find($level->id))->toBeNull();
});

test('levels with users and the super admin level cannot be deleted', function () {
    $superAdminLevel = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $superAdmin = User::factory()->create(['level_id' => $superAdminLevel->id]);
    $level = UserLevel::create(['name' => 'Estimator', 'permissions' => [], 'mobile_permissions' => []]);
    User::factory()->create(['level_id' => $level->id]);

    $this->actingAs($superAdmin)->delete(route('admin.access-control.levels.destroy', $level));
    $this->actingAs($superAdmin)->delete(route('admin.access-control.levels.destroy', $superAdminLevel));

    expect(UserLevel::find($level->id))->not->toBeNull()
        ->and(UserLevel::find($superAdminLevel->id))->not->toBeNull();
});

test('super admins can save user defaults and see them when creating a user', function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $admin = User::factory()->create(['level_id' => $level->id]);

    $this->actingAs($admin)
        ->patch(route('admin.user-defaults.update'), [
            'password' => 'Welcome@2026!',
            'level_id' => $level->id,
        ])
        ->assertSessionHasNoErrors();

    $this->actingAs($admin)
        ->get(route('admin.users.create'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('userDefaults.password', 'Welcome@2026!')
            ->where('userDefaults.level_id', $level->id)
        );
});

test('only super admins can read live presence', function () {
    $superLevel = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $admin = User::factory()->create(['level_id' => $superLevel->id]);
    $other = User::factory()->create(['level_id' => UserLevel::firstOrCreate(['name' => UserLevel::USER])->id]);

    $this->actingAs($other)->getJson(route('presence.index'))->assertForbidden();

    $admin->forceFill([
        'last_login_at' => now()->subMinutes(5),
        'last_seen_at' => now(),
        'last_seen_device' => 'mobile',
    ])->save();

    $this->actingAs($admin)->getJson(route('presence.index'))
        ->assertOk()
        ->assertJsonFragment([
            'id' => $admin->id,
            'logged_in_at' => $admin->last_login_at->toIso8601String(),
        ])
        ->assertJsonPath('devices.mobile', 1)
        ->assertJson(fn ($json) => $json->has('counts.online')->etc());

    $admin->forceFill(['last_logout_at' => now()->addSecond()])->save();

    $this->actingAs($admin)->getJson(route('presence.index'))
        ->assertJsonPath('devices.mobile', 0);
});

test('live presence activity defaults to four days and supports filters', function () {
    $superLevel = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $admin = User::factory()->create(['level_id' => $superLevel->id]);
    $worker = User::factory()->create();
    UserActivity::create([
        'user_id' => $worker->id,
        'event_type' => UserActivity::TYPE_LOGIN,
        'action' => 'logged in',
        'description' => 'Recent login',
        'user_agent' => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
        'occurred_at' => now()->subDays(3),
    ]);
    UserActivity::create([
        'user_id' => $worker->id,
        'event_type' => UserActivity::TYPE_PAGE_VIEW,
        'action' => 'viewed dashboard',
        'description' => 'Older page view',
        'occurred_at' => now()->subDays(20),
    ]);

    $this->actingAs($worker)
        ->getJson(route('presence.activities', $worker))
        ->assertForbidden();

    $this->actingAs($admin)
        ->getJson(route('presence.activities', $worker))
        ->assertOk()
        ->assertJsonCount(1, 'activities')
        ->assertJsonPath('activities.0.description', 'Recent login')
        ->assertJsonPath('activities.0.device_type', 'mobile')
        ->assertJsonPath('days', 4);

    $this->actingAs($admin)
        ->getJson(route('presence.activities', [
            'user' => $worker,
            'days' => 30,
            'event_type' => UserActivity::TYPE_PAGE_VIEW,
        ]))
        ->assertOk()
        ->assertJsonCount(1, 'activities')
        ->assertJsonPath('activities.0.description', 'Older page view')
        ->assertJsonPath('days', 30);
});

test('logins and logouts are stored with device and location', function () {
    $user = User::factory()->create();

    $this->withHeaders([
        'User-Agent' => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17) Mobile/15E148',
        'CF-IPCountry' => 'US',
        'CF-IPCity' => 'Newark',
    ])->post(route('login'), ['email' => $user->email, 'password' => 'password']);

    $this->post(route('logout'));

    $logs = UserLoginLog::query()->where('user_id', $user->id)->orderBy('id')->get();

    expect($logs->pluck('event')->all())->toBe(['login', 'logout'])
        ->and($logs->first()->device_type)->toBe('mobile')
        ->and($logs->first()->country)->toBe('US')
        ->and($logs->first()->city)->toBe('Newark');
});

test('users can save a dashboard gradient and invalid ones are rejected', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->patch(route('appearance.update'), ['gradient' => 'voice-orb'])->assertSessionHasNoErrors();
    expect($user->fresh()->dashboard_gradient)->toBe('voice-orb');

    $this->actingAs($user)->patch(route('appearance.update'), ['gradient' => 'nope'])->assertSessionHasErrors('gradient');
    $this->actingAs($user)->patch(route('appearance.update'), ['theme' => 'ocean'])->assertSessionHasNoErrors();
    expect($user->fresh()->dashboard_theme)->toBe('ocean')->and($user->fresh()->dashboard_gradient)->toBe('voice-orb');
});

test('choosing a dark surface also sets its accent and can be cleared', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->patch(route('appearance.update'), ['surface' => 'midnight'])->assertSessionHasNoErrors();
    expect($user->fresh()->dashboard_surface)->toBe('midnight')->and($user->fresh()->dashboard_theme)->toBe('indigo');

    $this->actingAs($user)->patch(route('appearance.update'), ['surface' => 'bogus'])->assertSessionHasErrors('surface');
    $this->actingAs($user)->patch(route('appearance.update'), ['surface' => 'default'])->assertSessionHasNoErrors();
    expect($user->fresh()->dashboard_surface)->toBe('default');
});

test('light surfaces can be chosen and set their accent', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->patch(route('appearance.update'), ['surface' => 'ivory'])->assertSessionHasNoErrors();
    expect($user->fresh()->dashboard_surface)->toBe('ivory')->and($user->fresh()->dashboard_theme)->toBe('amber');
});

test('live presence shows a user on every device they are signed in on', function () {
    $superLevel = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $admin = User::factory()->create(['level_id' => $superLevel->id]);
    $worker = User::factory()->create();

    foreach (['mobile', 'tablet', 'website'] as $device) {
        UserPresenceDevice::create(['user_id' => $worker->id, 'device' => $device, 'last_seen_at' => now()]);
    }

    $response = $this->actingAs($admin)->getJson(route('presence.index'))->assertOk();

    $row = collect($response->json('users'))->firstWhere('id', $worker->id);
    expect(collect($row['devices'])->pluck('device')->sort()->values()->all())->toBe(['mobile', 'tablet', 'website'])
        ->and($response->json('devices.mobile'))->toBe(1)
        ->and($response->json('devices.tablet'))->toBe(1)
        ->and($response->json('devices.website'))->toBe(1);

    UserPresenceDevice::markLoggedOut($worker, 'tablet');
    UserPresenceDevice::query()->where('device', 'tablet')->update(['logged_out_at' => now()->addSecond()]);

    $response = $this->actingAs($admin)->getJson(route('presence.index'));
    expect($response->json('devices.tablet'))->toBe(0)
        ->and($response->json('devices.mobile'))->toBe(1);
});

test('the presence middleware records each device separately', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->withHeaders(['X-Device-Type' => 'mobile'])->post(route('presence.ping'));
    $this->actingAs($user)->withHeaders(['X-Device-Type' => 'tablet'])->post(route('presence.ping'));

    expect(UserPresenceDevice::query()->where('user_id', $user->id)->pluck('device')->sort()->values()->all())->toBe(['mobile', 'tablet']);
});
