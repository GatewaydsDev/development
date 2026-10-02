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
        ->assertRedirect(route('admin.users.index', absolute: false));

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
        ->assertRedirect(route('admin.users.index', absolute: false));

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
        ->assertRedirect(route('admin.users.index', absolute: false));

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
