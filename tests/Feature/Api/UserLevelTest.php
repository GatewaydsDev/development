<?php

use App\Models\Employee;
use App\Models\User;
use App\Models\UserLevel;

function userLevelApiUser(string $levelName): User
{
    $level = UserLevel::firstOrCreate(['name' => $levelName]);
    $level->forceFill([
        'permissions' => $level->defaultPermissions(),
    ])->save();

    return User::factory()->create([
        'level_id' => $level->id,
    ]);
}

test('user level api routes require a token', function () {
    $this->getJson('/api/user-levels')->assertUnauthorized();
    $this->postJson('/api/user-levels')->assertUnauthorized();
});

test('super admins can create and update a user level from the api', function () {
    $superAdmin = userLevelApiUser(UserLevel::SUPER_ADMIN);

    $created = $this->actingAs($superAdmin, 'sanctum')
        ->postJson('/api/user-levels', [
            'name' => 'Employee',
            'permissions' => [
                'view-dashboard' => true,
                'manage-profile' => true,
                'view-employees' => false,
            ],
            'mobile_permissions' => [
                'view-dashboard' => true,
                'manage-profile' => false,
            ],
        ])
        ->assertCreated()
        ->assertJsonPath('data.name', 'Employee')
        ->assertJsonPath('data.permissions.view-dashboard', true)
        ->assertJsonPath('data.permissions.view-employees', false)
        ->assertJsonPath('data.mobile_permissions.view-dashboard', true)
        ->assertJsonPath('data.mobile_permissions.manage-profile', false);

    $levelId = $created->json('data.id');

    $this->actingAs($superAdmin, 'sanctum')
        ->getJson('/api/user-levels')
        ->assertOk()
        ->assertJsonFragment(['name' => 'Employee']);

    $this->actingAs($superAdmin, 'sanctum')
        ->patchJson("/api/user-levels/{$levelId}", [
            'permissions' => [
                'view-dashboard' => true,
                'view-employees' => true,
            ],
        ])
        ->assertOk()
        ->assertJsonPath('data.permissions.view-employees', true)
        ->assertJsonPath('data.mobile_permissions.view-dashboard', true)
        ->assertJsonPath('data.mobile_permissions.view-employees', false);

    $this->actingAs($superAdmin, 'sanctum')
        ->postJson('/api/user-levels', [
            'name' => 'Super Admin',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('name');
});

test('non super admins cannot manage user levels from the api', function () {
    $admin = userLevelApiUser(UserLevel::ADMIN);

    $this->actingAs($admin, 'sanctum')
        ->getJson('/api/user-levels')
        ->assertForbidden();

    $this->actingAs($admin, 'sanctum')
        ->postJson('/api/user-levels', [
            'name' => 'Employee',
        ])
        ->assertForbidden();
});

test('the employee api creates an employee or foreman login', function () {
    $admin = userLevelApiUser(UserLevel::ADMIN);

    $this->actingAs($admin, 'sanctum')
        ->postJson('/api/employees', [
            'first_name' => 'Jordan',
            'last_name' => 'Rivera',
            'email' => 'jordan.api@example.com',
            'employment_status' => Employee::STATUS_ACTIVE,
            'account' => [
                'role' => 'employee',
                'password' => 'password',
                'password_confirmation' => 'password',
            ],
        ])
        ->assertCreated()
        ->assertJsonPath('employee.user.level.name', 'Employee')
        ->assertJsonPath('employee.user.email', 'jordan.api@example.com');

    $employee = Employee::query()->where('email', 'jordan.api@example.com')->firstOrFail();
    $user = User::query()->findOrFail($employee->user_id);

    expect($user->hasPermission('view-employees'))->toBeFalse();

    $this->actingAs($admin, 'sanctum')
        ->patchJson("/api/employees/{$employee->uuid}", [
            'first_name' => 'Jordan',
            'last_name' => 'Rivera',
            'email' => 'jordan.api@example.com',
            'employment_status' => Employee::STATUS_ACTIVE,
            'account' => [
                'role' => 'foreman',
            ],
        ])
        ->assertOk()
        ->assertJsonPath('employee.user.level.name', 'Foreman');

    expect($user->refresh()->level?->name)->toBe(UserLevel::FOREMAN)
        ->and($user->hasPermission('view-employees'))->toBeTrue();
});
