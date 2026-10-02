<?php

use App\Models\User;
use App\Models\UserActivity;
use App\Models\UserLevel;
use App\Notifications\ResetPasswordNotification;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;

test('mobile users can log in and receive a bearer token', function () {
    $user = User::factory()->create();

    $response = $this->postJson('/api/auth/login', [
        'email' => $user->email,
        'password' => 'password',
        'device_name' => 'iPhone',
    ]);

    $response->assertOk()
        ->assertJsonPath('token_type', 'Bearer')
        ->assertJsonPath('user.email', $user->email)
        ->assertJsonPath('user.name', $user->name);

    expect($response->json('token'))->toBeString()->not->toBeEmpty();

    $user->refresh();
    expect($user->last_login_at)->not->toBeNull();

    $this->assertDatabaseHas('user_activities', [
        'user_id' => $user->id,
        'event_type' => UserActivity::TYPE_LOGIN,
    ]);

    $this->withToken($response->json('token'))
        ->getJson('/api/auth/user')
        ->assertOk()
        ->assertJsonPath('user.id', $user->id);
});

test('mobile login rejects a wrong password', function () {
    $user = User::factory()->create();

    $this->postJson('/api/auth/login', [
        'email' => $user->email,
        'password' => 'wrong-password',
    ])->assertUnprocessable()
        ->assertJsonValidationErrors('email');

    $this->assertGuest();
});

test('mobile users can register with an access code and receive a token', function () {
    $response = $this->postJson('/api/auth/register', [
        'access_code' => 'FCKGWRHQQ5',
        'name' => 'Mobile User',
        'email' => 'mobile@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
        'device_name' => 'Android',
    ]);

    $response->assertCreated()
        ->assertJsonPath('user.email', 'mobile@example.com')
        ->assertJsonPath('user.role', 'user')
        ->assertJsonPath('user.level', 'User');

    $this->assertDatabaseHas('users', [
        'email' => 'mobile@example.com',
        'role' => 'user',
    ]);

    $this->withToken($response->json('token'))
        ->getJson('/api/user')
        ->assertOk()
        ->assertJsonPath('user.email', 'mobile@example.com');
});

test('mobile registration requires a valid access code', function () {
    $this->postJson('/api/auth/register', [
        'access_code' => 'FCKGWRHQQ9',
        'name' => 'Mobile User',
        'email' => 'mobile@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ])->assertUnprocessable()
        ->assertJsonValidationErrors('access_code');

    $this->assertDatabaseMissing('users', [
        'email' => 'mobile@example.com',
    ]);
});

test('the current user route requires a token', function () {
    $this->getJson('/api/auth/user')->assertUnauthorized();
});

test('the privileges route requires a token', function () {
    $this->getJson('/api/auth/privileges')->assertUnauthorized();
});

test('login returns the privileges that decide which routes the user can open', function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::PROJECT_MANAGER]);
    $level->forceFill([
        'permissions' => $level->defaultPermissions(),
    ])->save();

    $user = User::factory()->create([
        'role' => 'project_manager',
        'level_id' => $level->id,
    ]);

    $response = $this->postJson('/api/auth/login', [
        'email' => $user->email,
        'password' => 'password',
    ]);

    $response->assertOk()
        ->assertJsonPath('privileges.level', UserLevel::PROJECT_MANAGER)
        ->assertJsonPath('privileges.role', 'project_manager')
        ->assertJsonPath('privileges.is_super_admin', false)
        ->assertJsonPath('privileges.can.viewProjects', true)
        ->assertJsonPath('privileges.can.updateProjects', true)
        ->assertJsonPath('privileges.can.createProjects', false)
        ->assertJsonPath('privileges.can.deleteProjects', false)
        ->assertJsonPath('privileges.can.viewEmployees', false)
        ->assertJsonPath('privileges.can.manageAccess', false);

    expect(collect($response->json('privileges.permissions'))->pluck('key')->all())
        ->toBe(array_keys(config('access.permissions')));
});

test('a signed-in user can load every privilege and the level gates still apply', function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::USER]);
    $level->forceFill([
        'permissions' => array_merge($level->defaultPermissions(), [
            'view-employees' => true,
            'create-projects' => true,
        ]),
    ])->save();

    $user = User::factory()->create([
        'level_id' => $level->id,
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/auth/privileges');

    $response->assertOk()
        ->assertJsonPath('level', UserLevel::USER)
        ->assertJsonPath('is_super_admin', false)
        ->assertJsonPath('can.viewDashboard', true)
        ->assertJsonPath('can.manageProfile', true)
        ->assertJsonPath('can.viewProjects', false)
        ->assertJsonPath('can.createProjects', false)
        ->assertJsonPath('can.viewEmployees', false)
        ->assertJsonPath('can.manageUsers', false);

    $granted = collect($response->json('permissions'))->pluck('granted', 'key');

    expect($granted->get('view-dashboard'))->toBeTrue()
        ->and($granted->get('manage-profile'))->toBeTrue()
        ->and($granted->get('view-employees'))->toBeFalse()
        ->and($granted->get('create-projects'))->toBeFalse()
        ->and($granted->get('view-users'))->toBeFalse()
        ->and($granted->get('manage-access'))->toBeFalse();
});

test('mobile privileges omit rights that were not delegated', function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::PROJECT_MANAGER]);
    $permissions = $level->defaultPermissions();
    $mobile = $permissions;
    $mobile['view-projects'] = false;
    $mobile['update-projects'] = false;

    $level->forceFill([
        'permissions' => $permissions,
        'mobile_permissions' => $mobile,
    ])->save();

    $user = User::factory()->create([
        'level_id' => $level->id,
    ]);

    expect($user->hasPermission('view-projects'))->toBeTrue()
        ->and($user->hasPermission('view-bids'))->toBeTrue();

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/auth/privileges')
        ->assertOk()
        ->assertJsonPath('can.viewProjects', false)
        ->assertJsonPath('can.updateProjects', false)
        ->assertJsonPath('can.viewBids', true)
        ->assertJsonPath('can.updateBids', true);
});

test('super admins receive every privilege', function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $user = User::factory()->create([
        'role' => 'super_admin',
        'level_id' => $level->id,
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/auth/privileges');

    $response->assertOk()
        ->assertJsonPath('is_super_admin', true)
        ->assertJsonPath('can.manageAccess', true)
        ->assertJsonPath('can.viewUserActivity', true)
        ->assertJsonPath('can.manageDocumentColors', true)
        ->assertJsonPath('can.manageOwnAccount', false)
        ->assertJsonPath('can.deleteEmployees', true)
        ->assertJsonPath('can.viewSensitiveProjectFields', true);

    expect(collect($response->json('permissions'))->every(fn (array $permission): bool => $permission['granted']))
        ->toBeTrue();
});

test('mobile users can log out and the token stops working', function () {
    $user = User::factory()->create();

    $token = $this->postJson('/api/auth/login', [
        'email' => $user->email,
        'password' => 'password',
    ])->json('token');

    $this->withToken($token)
        ->postJson('/api/auth/logout')
        ->assertOk()
        ->assertJsonPath('message', 'Logged out.');

    $this->app['auth']->forgetGuards();

    $this->withToken($token)
        ->getJson('/api/auth/user')
        ->assertUnauthorized();
});

test('mobile users can request a password reset email', function () {
    Notification::fake();
    $user = User::factory()->create();

    $this->postJson('/api/auth/forgot-password', [
        'email' => $user->email,
    ])->assertOk()
        ->assertJsonPath('message', 'The password reset email has been sent. Please check your inbox and spam folder.');

    Notification::assertSentTo($user, ResetPasswordNotification::class);
});

test('mobile users can reset a password with the emailed token', function () {
    $user = User::factory()->create();
    $token = Password::createToken($user);
    $user->createToken('old-phone');

    $this->postJson('/api/auth/reset-password', [
        'email' => $user->email,
        'token' => $token,
        'password' => 'new-password',
        'password_confirmation' => 'new-password',
    ])->assertOk();

    expect(Hash::check('new-password', $user->refresh()->password))->toBeTrue()
        ->and($user->tokens()->count())->toBe(0);

    $this->postJson('/api/auth/login', [
        'email' => $user->email,
        'password' => 'new-password',
    ])->assertOk();
});

test('mobile users can change their password while signed in', function () {
    $user = User::factory()->create();
    $token = $user->createToken('phone')->plainTextToken;
    $user->createToken('tablet');

    $this->withToken($token)
        ->putJson('/api/auth/password', [
            'current_password' => 'password',
            'password' => 'changed-password',
            'password_confirmation' => 'changed-password',
        ])->assertOk();

    expect(Hash::check('changed-password', $user->refresh()->password))->toBeTrue()
        ->and($user->tokens()->count())->toBe(1);

    $this->withToken($token)
        ->getJson('/api/auth/user')
        ->assertOk();
});
