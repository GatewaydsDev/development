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

test('admins cannot view access control unless granted permission', function () {
    $adminLevel = UserLevel::firstOrCreate(['name' => UserLevel::ADMIN]);
    $admin = User::factory()->create(['level_id' => $adminLevel->id]);

    $this->actingAs($admin)
        ->get(route('admin.access-control.edit'))
        ->assertForbidden();
});

test('administrators have every configured gate permission by default', function () {
    $administratorLevel = UserLevel::firstOrCreate(['name' => UserLevel::ADMINISTRATOR]);
    $administratorLevel->forceFill([
        'permissions' => $administratorLevel->defaultPermissions(),
    ])->save();

    $administrator = User::factory()->create(['level_id' => $administratorLevel->id]);

    foreach (array_keys(config('access.permissions', [])) as $permission) {
        expect(Gate::forUser($administrator)->allows($permission))->toBeTrue();
    }
});

test('permission changes are enforced by laravel gates', function () {
    $superAdminLevel = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $adminLevel = UserLevel::firstOrCreate(['name' => UserLevel::ADMIN]);
    $superAdmin = User::factory()->create(['level_id' => $superAdminLevel->id]);
    $admin = User::factory()->create(['level_id' => $adminLevel->id]);

    $this->actingAs($admin)
        ->get(route('admin.users.index'))
        ->assertOk();

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
