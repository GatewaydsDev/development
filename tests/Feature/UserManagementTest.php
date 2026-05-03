<?php

use App\Models\User;
use App\Models\UserLevel;
use Inertia\Testing\AssertableInertia as Assert;

function userWithLevel(string $levelName): User
{
    $level = UserLevel::firstOrCreate(['name' => $levelName]);

    return User::factory()->create(['level_id' => $level->id]);
}

test('administrators can view the users list', function () {
    $administrator = userWithLevel(UserLevel::ADMINISTRATOR);

    User::factory()->create([
        'name' => 'Gateway Manager',
        'email' => 'manager@example.com',
    ]);

    $this->actingAs($administrator)
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

test('administrators can create users', function () {
    $administrator = userWithLevel(UserLevel::ADMINISTRATOR);
    $adminLevel = UserLevel::firstOrCreate(['name' => UserLevel::ADMIN]);

    $this->actingAs($administrator)
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

test('administrators can update users', function () {
    $administrator = userWithLevel(UserLevel::ADMINISTRATOR);
    $managedUser = userWithLevel(UserLevel::USER);
    $projectManagerLevel = UserLevel::firstOrCreate([
        'name' => UserLevel::PROJECT_MANAGER,
    ]);

    $this->actingAs($administrator)
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

test('user list access does not grant create or update access', function () {
    $level = UserLevel::firstOrCreate(['name' => 'List Only']);
    $level->forceFill([
        'permissions' => [
            'view-dashboard' => true,
            'manage-profile' => true,
            'view-users' => true,
            'create-users' => false,
            'update-users' => false,
            'manage-access' => false,
            'manage-projects' => false,
        ],
    ])->save();

    $user = User::factory()->create(['level_id' => $level->id]);
    $managedUser = userWithLevel(UserLevel::USER);

    $this->actingAs($user)
        ->get(route('admin.users.index'))
        ->assertOk();

    $this->actingAs($user)
        ->get(route('admin.users.create'))
        ->assertForbidden();

    $this->actingAs($user)
        ->get(route('admin.users.edit', $managedUser))
        ->assertForbidden();
});

test('create user access does not grant update access', function () {
    $level = UserLevel::firstOrCreate(['name' => 'Create Only']);
    $level->forceFill([
        'permissions' => [
            'view-dashboard' => true,
            'manage-profile' => true,
            'view-users' => true,
            'create-users' => true,
            'update-users' => false,
            'manage-access' => false,
            'manage-projects' => false,
        ],
    ])->save();

    $user = User::factory()->create(['level_id' => $level->id]);
    $managedUser = userWithLevel(UserLevel::USER);

    $this->actingAs($user)
        ->get(route('admin.users.create'))
        ->assertOk();

    $this->actingAs($user)
        ->patch(route('admin.users.update', $managedUser), [
            'name' => 'Should Not Update',
            'email' => 'blocked-update@example.com',
            'level_id' => $managedUser->level_id,
            'password' => '',
            'password_confirmation' => '',
        ])
        ->assertForbidden();
});
