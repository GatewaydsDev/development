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
