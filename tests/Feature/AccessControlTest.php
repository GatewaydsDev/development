<?php

use App\Models\User;
use App\Models\UserLevel;
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
            ->has('levels')
        );
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

    $admin->forceFill(['last_seen_at' => now(), 'last_seen_device' => 'mobile'])->save();

    $this->actingAs($admin)->getJson(route('presence.index'))
        ->assertOk()
        ->assertJsonPath('devices.mobile', 1)
        ->assertJson(fn ($json) => $json->has('counts.online')->etc());

    $admin->forceFill(['last_logout_at' => now()->addSecond()])->save();

    $this->actingAs($admin)->getJson(route('presence.index'))
        ->assertJsonPath('devices.mobile', 0);
});

test('logins and logouts are stored with device and location', function () {
    $user = User::factory()->create();

    $this->withHeaders([
        'User-Agent' => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17) Mobile/15E148',
        'CF-IPCountry' => 'US',
        'CF-IPCity' => 'Newark',
    ])->post(route('login'), ['email' => $user->email, 'password' => 'password']);

    $this->post(route('logout'));

    $logs = \App\Models\UserLoginLog::query()->where('user_id', $user->id)->orderBy('id')->get();

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
