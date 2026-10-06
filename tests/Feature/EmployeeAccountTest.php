<?php

use App\Models\Employee;
use App\Models\User;
use App\Models\UserLevel;
use App\Support\EmployeeAccess;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;

function accountSuperAdmin(): User
{
    $level = UserLevel::firstOrCreate([
        'name' => UserLevel::SUPER_ADMIN,
    ]);

    return User::factory()->create([
        'level_id' => $level->id,
    ]);
}

test('super admins can create a user level and choose its access', function () {
    $superAdmin = accountSuperAdmin();

    $this->actingAs($superAdmin)
        ->post(route('admin.access-control.levels.store'), [
            'name' => 'Employee',
            'grant_mobile' => true,
            'permissions' => [
                'view-dashboard' => true,
                'manage-profile' => true,
                'view-employees' => false,
            ],
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    $level = UserLevel::query()->where('name', 'Employee')->firstOrFail();

    expect($level->hasPermission('view-dashboard'))->toBeTrue()
        ->and($level->hasPermission('manage-profile'))->toBeTrue()
        ->and($level->hasPermission('view-employees'))->toBeFalse()
        ->and($level->hasMobilePermission('view-dashboard'))->toBeTrue()
        ->and($level->hasMobilePermission('view-employees'))->toBeFalse();
});

test('a new level can keep mobile access off', function () {
    $superAdmin = accountSuperAdmin();

    $this->actingAs($superAdmin)
        ->post(route('admin.access-control.levels.store'), [
            'name' => 'Crew Lead',
            'grant_mobile' => false,
            'permissions' => [
                'view-dashboard' => true,
            ],
        ])
        ->assertSessionHasNoErrors();

    $level = UserLevel::query()->where('name', 'Crew Lead')->firstOrFail();

    expect($level->hasPermission('view-dashboard'))->toBeTrue()
        ->and($level->hasMobilePermission('view-dashboard'))->toBeFalse();
});

test('user levels cannot duplicate super admin or an existing name', function () {
    $superAdmin = accountSuperAdmin();
    UserLevel::firstOrCreate(['name' => UserLevel::ADMIN]);

    $this->actingAs($superAdmin)
        ->from(route('admin.access-control.edit'))
        ->post(route('admin.access-control.levels.store'), [
            'name' => 'Super Admin',
            'permissions' => [],
        ])
        ->assertRedirect(route('admin.access-control.edit'))
        ->assertSessionHasErrors('name');

    $this->actingAs($superAdmin)
        ->from(route('admin.access-control.edit'))
        ->post(route('admin.access-control.levels.store'), [
            'name' => 'Admin',
            'permissions' => [],
        ])
        ->assertSessionHasErrors('name');
});

test('a super admin can add a user level from the user form dropdown', function () {
    $superAdmin = accountSuperAdmin();

    $this->actingAs($superAdmin)
        ->get(route('admin.users.create'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('canCreateUserLevel', true)
            ->has('accessPermissions')
        );

    $this->actingAs($superAdmin)
        ->from(route('admin.users.create'))
        ->post(route('admin.access-control.levels.store'), [
            'name' => 'Employee',
            'grant_mobile' => true,
            'permissions' => [
                'view-dashboard' => true,
                'manage-profile' => true,
            ],
        ])
        ->assertRedirect(route('admin.users.create'));

    $level = UserLevel::query()->where('name', 'Employee')->firstOrFail();

    expect($level->hasPermission('view-dashboard'))->toBeTrue()
        ->and($level->hasPermission('view-employees'))->toBeFalse();
});

test('an employee login can use a user level chosen from the dropdown', function () {
    $admin = accountSuperAdmin();
    $level = UserLevel::query()->create([
        'name' => 'Employee',
        'permissions' => [
            'view-dashboard' => true,
            'manage-profile' => true,
            'view-employees' => false,
        ],
    ]);

    $this->actingAs($admin)
        ->post(route('admin.employees.store'), [
            'first_name' => 'Riley',
            'last_name' => 'Crew',
            'email' => 'riley@example.com',
            'employment_status' => Employee::STATUS_ACTIVE,
            'account_level_id' => $level->id,
            'account_password' => 'password',
            'account_password_confirmation' => 'password',
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('admin.employees.index'));

    $employee = Employee::query()->where('email', 'riley@example.com')->firstOrFail();

    expect($employee->user?->level_id)->toBe($level->id)
        ->and($employee->user?->hasPermission('view-employees'))->toBeFalse();
});

test('non super admins cannot create a user level', function () {
    $admin = User::factory()->create([
        'level_id' => UserLevel::firstOrCreate(['name' => UserLevel::ADMIN])->id,
    ]);

    $this->actingAs($admin)
        ->post(route('admin.access-control.levels.store'), [
            'name' => 'Employee',
        ])
        ->assertForbidden();
});

test('creating an employee creates an employee login', function () {
    $admin = accountSuperAdmin();

    $this->actingAs($admin)
        ->post(route('admin.employees.store'), [
            'first_name' => 'Jordan',
            'last_name' => 'Rivera',
            'email' => 'jordan@example.com',
            'employment_status' => Employee::STATUS_ACTIVE,
            'account_role' => 'employee',
            'account_password' => 'password',
            'account_password_confirmation' => 'password',
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('admin.employees.index'));

    $employee = Employee::query()->where('email', 'jordan@example.com')->firstOrFail();
    $user = $employee->user()->firstOrFail();

    expect($employee->uuid)->toMatch(
        '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/',
    )->and(route('admin.employees.edit', $employee))->toContain($employee->uuid)
        ->and($user->level?->name)->toBe(UserLevel::EMPLOYEE)
        ->and(Hash::check('password', $user->password))->toBeTrue()
        ->and($user->hasPermission('view-dashboard'))->toBeTrue()
        ->and($user->hasPermission('view-employees'))->toBeFalse()
        ->and(EmployeeAccess::canView($user))->toBeFalse();

    $this->actingAs($user)
        ->get(route('admin.employees.index'))
        ->assertForbidden();
});

test('a foreman employee login can see only the crew designated to them', function () {
    $admin = accountSuperAdmin();

    $this->actingAs($admin)
        ->post(route('admin.employees.store'), [
            'first_name' => 'Alex',
            'last_name' => 'Foreman',
            'email' => 'alex.foreman@example.com',
            'employment_status' => Employee::STATUS_ACTIVE,
            'account_role' => 'foreman',
            'account_password' => 'password',
            'account_password_confirmation' => 'password',
        ])
        ->assertSessionHasNoErrors();

    $foremanEmployee = Employee::query()->where('email', 'alex.foreman@example.com')->firstOrFail();
    $foreman = $foremanEmployee->user()->firstOrFail();

    expect($foreman->level?->name)->toBe(UserLevel::FOREMAN)
        ->and(EmployeeAccess::canView($foreman))->toBeTrue()
        ->and(EmployeeAccess::canCreate($foreman))->toBeFalse();

    $crew = Employee::query()->create([
        'first_name' => 'Sam',
        'last_name' => 'Crew',
        'email' => 'sam.crew@example.com',
        'employment_status' => Employee::STATUS_ACTIVE,
        'foreman_user_id' => $foreman->id,
    ]);
    $other = Employee::query()->create([
        'first_name' => 'Pat',
        'last_name' => 'Other',
        'email' => 'pat.other@example.com',
        'employment_status' => Employee::STATUS_ACTIVE,
    ]);

    expect(EmployeeAccess::canViewEmployee($foreman, $crew))->toBeTrue()
        ->and(EmployeeAccess::canViewEmployee($foreman, $other))->toBeFalse()
        ->and(EmployeeAccess::canViewEmployee($foreman, $foremanEmployee))->toBeFalse();
});

test('updating an employee keeps the current email when a login already uses it', function () {
    $admin = accountSuperAdmin();
    $level = UserLevel::query()->create([
        'name' => 'Employee',
        'permissions' => [
            'view-dashboard' => true,
            'manage-profile' => true,
        ],
    ]);
    $login = User::factory()->create([
        'name' => 'Jose Nunes',
        'email' => 'jose@email.com',
        'level_id' => $level->id,
    ]);
    $employee = Employee::query()->create([
        'first_name' => 'Jose',
        'last_name' => 'Marcos',
        'email' => 'jose@email.com',
        'employment_status' => Employee::STATUS_ACTIVE,
    ]);

    $this->actingAs($admin)
        ->patch(route('admin.employees.update', $employee), [
            'first_name' => 'Jose',
            'last_name' => 'Marcos',
            'email' => 'jose@email.com',
            'employment_status' => Employee::STATUS_ACTIVE,
            'account_level_id' => $level->id,
            'job_title' => 'Painter',
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('admin.employees.index'));

    $employee->refresh();

    expect($employee->job_title)->toBe('Painter')
        ->and($employee->user_id)->toBe($login->id)
        ->and($login->fresh()->email)->toBe('jose@email.com');
});

test('updating an employee rejects an email changed to one already in use', function () {
    $admin = accountSuperAdmin();
    $level = UserLevel::query()->create([
        'name' => 'Employee',
        'permissions' => [
            'view-dashboard' => true,
            'manage-profile' => true,
        ],
    ]);
    User::factory()->create([
        'email' => 'taken@email.com',
        'level_id' => $level->id,
    ]);
    $employee = Employee::query()->create([
        'first_name' => 'Jose',
        'last_name' => 'Marcos',
        'email' => 'jose@email.com',
        'employment_status' => Employee::STATUS_ACTIVE,
    ]);

    $this->actingAs($admin)
        ->from(route('admin.employees.edit', $employee))
        ->patch(route('admin.employees.update', $employee), [
            'first_name' => 'Jose',
            'last_name' => 'Marcos',
            'email' => 'taken@email.com',
            'employment_status' => Employee::STATUS_ACTIVE,
            'account_level_id' => $level->id,
            'account_password' => 'password',
            'account_password_confirmation' => 'password',
        ])
        ->assertRedirect(route('admin.employees.edit', $employee))
        ->assertSessionHasErrors('email');

    expect($employee->fresh()->email)->toBe('jose@email.com');
});

test('employee email availability is reported when the field is checked', function () {
    $admin = accountSuperAdmin();
    $current = Employee::query()->create([
        'first_name' => 'Maria',
        'last_name' => 'Dias',
        'email' => 'maria@email.com',
        'employment_status' => Employee::STATUS_ACTIVE,
    ]);
    Employee::query()->create([
        'first_name' => 'Jose',
        'last_name' => 'Marcos',
        'email' => 'jose@email.com',
        'employment_status' => Employee::STATUS_ACTIVE,
    ]);
    User::factory()->create([
        'email' => 'login@email.com',
    ]);

    $this->actingAs($admin)
        ->getJson(route('admin.employees.email-availability', [
            'email' => 'jose@email.com',
        ]))
        ->assertOk()
        ->assertJsonPath('available', false);

    $this->actingAs($admin)
        ->getJson(route('admin.employees.email-availability', [
            'email' => 'login@email.com',
        ]))
        ->assertOk()
        ->assertJsonPath('available', false);

    $this->actingAs($admin)
        ->getJson(route('admin.employees.email-availability', [
            'email' => 'maria@email.com',
            'employee' => $current->uuid,
        ]))
        ->assertOk()
        ->assertJsonPath('available', true);

    $this->actingAs($admin)
        ->getJson(route('admin.employees.email-availability', [
            'email' => 'new.person@email.com',
        ]))
        ->assertOk()
        ->assertJsonPath('available', true);
});
