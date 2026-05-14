<?php

use App\Models\User;
use App\Models\UserActivity;
use App\Models\UserLevel;
use Inertia\Testing\AssertableInertia as Assert;

test('successful logins update last login time and create an activity record', function () {
    $user = User::factory()->create();

    $this->post('/login', [
        'email' => $user->email,
        'password' => 'password',
    ])->assertRedirect(route('dashboard', absolute: false));

    $user->refresh();

    expect($user->last_login_at)->not->toBeNull();

    $this->assertDatabaseHas('user_activities', [
        'user_id' => $user->id,
        'event_type' => UserActivity::TYPE_LOGIN,
        'action' => 'logged in',
        'page_name' => 'Login',
    ]);
});

test('authenticated page access is logged', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertOk();

    $this->assertDatabaseHas('user_activities', [
        'user_id' => $user->id,
        'event_type' => UserActivity::TYPE_PAGE_VIEW,
        'action' => 'viewed page',
        'page_name' => 'Dashboard',
        'route_name' => 'dashboard',
        'method' => 'GET',
    ]);
});

test('record creation actions are logged', function () {
    $superAdminLevel = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $adminLevel = UserLevel::firstOrCreate(['name' => UserLevel::ADMIN]);
    $superAdmin = User::factory()->create(['level_id' => $superAdminLevel->id]);

    $this->actingAs($superAdmin)
        ->post(route('admin.users.store'), [
            'name' => 'Audited User',
            'email' => 'audited-user@example.com',
            'level_id' => $adminLevel->id,
            'password' => 'password',
            'password_confirmation' => 'password',
        ])
        ->assertRedirect(route('admin.users.index', absolute: false));

    $createdUser = User::query()
        ->where('email', 'audited-user@example.com')
        ->firstOrFail();

    $this->assertDatabaseHas('user_activities', [
        'user_id' => $superAdmin->id,
        'event_type' => UserActivity::TYPE_RECORD_CREATED,
        'action' => 'created user',
        'subject_type' => User::class,
        'subject_id' => $createdUser->id,
    ]);
});

test('only super admins can view the user activity audit page', function () {
    $superAdminLevel = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $adminLevel = UserLevel::firstOrCreate(['name' => UserLevel::ADMIN]);
    $superAdmin = User::factory()->create(['level_id' => $superAdminLevel->id]);
    $admin = User::factory()->create(['level_id' => $adminLevel->id]);

    UserActivity::create([
        'user_id' => $admin->id,
        'event_type' => UserActivity::TYPE_PAGE_VIEW,
        'action' => 'viewed page',
        'page_name' => 'Dashboard',
        'description' => 'Admin viewed Dashboard.',
        'route_name' => 'dashboard',
        'method' => 'GET',
        'path' => 'dashboard',
        'occurred_at' => now(),
    ]);

    $this->actingAs($admin)
        ->get(route('admin.user-activities.index'))
        ->assertForbidden();

    $this->actingAs($superAdmin)
        ->get(route('admin.user-activities.index', ['search' => 'Dashboard']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/UserActivities/Index')
            ->where('activities.data.0.page_name', 'Dashboard')
        );
});
