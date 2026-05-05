<?php

use App\Models\User;
use App\Models\UserLevel;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;

test('non super admins cannot access user management pages', function () {
    $managedUser = User::factory()->create();

    foreach ([UserLevel::ADMINISTRATOR, UserLevel::ADMIN, UserLevel::PROJECT_MANAGER, UserLevel::USER] as $levelName) {
        $level = UserLevel::firstOrCreate(['name' => $levelName]);
        $user = User::factory()->create(['level_id' => $level->id]);

        $this->actingAs($user)
            ->get(route('admin.users.index'))
            ->assertForbidden();

        $this->actingAs($user)
            ->get(route('admin.users.create'))
            ->assertForbidden();

        $this->actingAs($user)
            ->get(route('admin.users.edit', $managedUser))
            ->assertForbidden();
    }
});

test('non super admins can open their dedicated account page', function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::ADMINISTRATOR]);
    $administrator = User::factory()->create([
        'level_id' => $level->id,
        'name' => 'Gateway Administrator',
    ]);

    $this->actingAs($administrator)
        ->get(route('admin.account.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Account/Edit')
            ->where('account.name', 'Gateway Administrator')
            ->where('account.email', $administrator->email)
        );
});

test('account name must be unique', function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::ADMINISTRATOR]);
    $administrator = User::factory()->create(['level_id' => $level->id]);
    User::factory()->create(['name' => 'Taken Name']);

    $this->actingAs($administrator)
        ->patch(route('admin.account.update'), [
            'name' => 'Taken Name',
            'password' => '',
            'password_confirmation' => '',
        ])
        ->assertSessionHasErrors('name');
});

test('non super admin can update own name and password', function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::ADMIN]);
    $user = User::factory()->create([
        'level_id' => $level->id,
        'name' => 'Original Admin',
    ]);

    $this->actingAs($user)
        ->patch(route('admin.account.update'), [
            'name' => 'Updated Admin',
            'password' => 'updated-password',
            'password_confirmation' => 'updated-password',
        ])
        ->assertRedirect(route('dashboard', absolute: false));

    $user->refresh();

    expect($user->name)->toBe('Updated Admin');
    expect(Hash::check('updated-password', $user->password))->toBeTrue();
});

test('super admins cannot open non super admin account page', function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $superAdmin = User::factory()->create(['level_id' => $level->id]);

    $this->actingAs($superAdmin)
        ->get(route('admin.account.edit'))
        ->assertForbidden();
});

