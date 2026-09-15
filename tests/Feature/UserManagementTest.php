<?php

use App\Models\User;
use App\Models\UserLevel;
use Inertia\Testing\AssertableInertia as Assert;

function userWithLevel(string $levelName): User
{
    $level = UserLevel::firstOrCreate(['name' => $levelName]);

    return User::factory()->create(['level_id' => $level->id]);
}

test('super admins can view the users list', function () {
    $superAdmin = userWithLevel(UserLevel::SUPER_ADMIN);

    User::factory()->create([
        'name' => 'Gateway Manager',
        'email' => 'manager@example.com',
    ]);

    $this->actingAs($superAdmin)
        ->get(route('admin.users.index', ['search' => 'manager@example.com']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Users/Index')
            ->where('users.data.0.email', 'manager@example.com')
        );
});

test('users without management access cannot view the users list', function () {
    $user = userWithLevel(UserLevel::USER);

    $this->actingAs($user)
        ->get(route('admin.users.index'))
        ->assertForbidden();
});

test('super admins can create users', function () {
    $superAdmin = userWithLevel(UserLevel::SUPER_ADMIN);
    $adminLevel = UserLevel::firstOrCreate(['name' => UserLevel::ADMIN]);

    $this->actingAs($superAdmin)
        ->post(route('admin.users.store'), [
            'name' => 'New Gateway Admin',
            'email' => 'new-admin@example.com',
            'level_id' => $adminLevel->id,
            'password' => 'password',
            'password_confirmation' => 'password',
        ])
        ->assertRedirect(route('admin.users.index', absolute: false));

    $this->assertDatabaseHas('users', [
        'email' => 'new-admin@example.com',
        'level_id' => $adminLevel->id,
        'role' => 'admin',
    ]);
});

test('super admins can update users', function () {
    $superAdmin = userWithLevel(UserLevel::SUPER_ADMIN);
    $managedUser = userWithLevel(UserLevel::USER);
    $projectManagerLevel = UserLevel::firstOrCreate([
        'name' => UserLevel::PROJECT_MANAGER,
    ]);

    $this->actingAs($superAdmin)
        ->patch(route('admin.users.update', $managedUser), [
            'name' => 'Updated Manager',
            'email' => 'updated-manager@example.com',
            'level_id' => $projectManagerLevel->id,
            'password' => '',
            'password_confirmation' => '',
        ])
        ->assertRedirect(route('admin.users.index', absolute: false));

    $this->assertDatabaseHas('users', [
        'id' => $managedUser->id,
        'email' => 'updated-manager@example.com',
        'level_id' => $projectManagerLevel->id,
        'role' => 'project_manager',
    ]);
});

test('super administrator level name can view the users list', function () {
    $level = UserLevel::firstOrCreate(['name' => 'Super Administrator']);
    $user = User::factory()->create([
        'level_id' => $level->id,
        'role' => 'administrator',
    ]);

    $this->actingAs($user)
        ->get(route('admin.users.index'))
        ->assertOk();
});

test('super_admin role can view the users list', function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::ADMINISTRATOR]);
    $user = User::factory()->create([
        'level_id' => $level->id,
        'role' => 'super_admin',
    ]);

    $this->actingAs($user)
        ->get(route('admin.users.index'))
        ->assertOk();
});

test('custom user permissions cannot grant user crud access without super admin level', function () {
    $level = UserLevel::firstOrCreate(['name' => 'List Only']);
    $level->forceFill([
        'permissions' => [
            'view-dashboard' => true,
            'manage-profile' => true,
            'view-users' => true,
            'create-users' => true,
            'update-users' => true,
            'manage-access' => false,
            'manage-projects' => false,
        ],
    ])->save();

    $user = User::factory()->create(['level_id' => $level->id]);
    $managedUser = userWithLevel(UserLevel::USER);

    $this->actingAs($user)
        ->get(route('admin.users.index'))
        ->assertForbidden();

    $this->actingAs($user)
        ->get(route('admin.users.create'))
        ->assertForbidden();

    $this->actingAs($user)
        ->get(route('admin.users.edit', $managedUser))
        ->assertForbidden();
});

