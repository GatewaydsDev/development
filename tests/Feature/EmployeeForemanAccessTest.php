<?php

use App\Models\Employee;
use App\Models\EmployeeAttendanceWeek;
use App\Models\User;
use App\Models\UserLevel;
use Inertia\Testing\AssertableInertia as Assert;

function employeeAccessUser(string $levelName): User
{
    $level = UserLevel::firstOrCreate(['name' => $levelName]);
    $level->forceFill([
        'permissions' => $level->defaultPermissions(),
    ])->save();

    return User::factory()->create([
        'level_id' => $level->id,
    ]);
}

test('admins can open employees and attendance while other roles cannot', function () {
    $admin = employeeAccessUser(UserLevel::ADMIN);
    $projectManager = employeeAccessUser(UserLevel::PROJECT_MANAGER);
    $user = employeeAccessUser(UserLevel::USER);

    $this->actingAs($admin)
        ->get(route('admin.employees.index'))
        ->assertOk();

    $this->actingAs($admin)
        ->get(route('admin.employee-attendance.index'))
        ->assertOk();

    $this->actingAs($projectManager)
        ->get(route('admin.employees.index'))
        ->assertForbidden();

    $this->actingAs($user)
        ->get(route('admin.employee-attendance.index'))
        ->assertForbidden();
});

test('a foreman is stored on the employee and limits employees and attendance', function () {
    $admin = employeeAccessUser(UserLevel::ADMIN);
    $foreman = employeeAccessUser(UserLevel::FOREMAN);
    $otherForeman = employeeAccessUser(UserLevel::FOREMAN);

    $this->actingAs($admin)
        ->post(route('admin.employees.store'), [
            'first_name' => 'Jordan',
            'last_name' => 'Rivera',
            'email' => 'jordan.designated@example.com',
            'employment_status' => Employee::STATUS_ACTIVE,
            'foreman_user_id' => $foreman->id,
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('admin.employees.index'));

    $designated = Employee::query()->where('email', 'jordan.designated@example.com')->firstOrFail();
    $other = Employee::create([
        'first_name' => 'Alex',
        'last_name' => 'Cole',
        'email' => 'alex.other@example.com',
        'employment_status' => Employee::STATUS_ACTIVE,
        'foreman_user_id' => $otherForeman->id,
    ]);

    expect($designated->foreman_user_id)->toBe($foreman->id);

    $designatedWeek = EmployeeAttendanceWeek::create([
        'employee_id' => $designated->id,
        'week_start' => '2026-10-05',
    ]);
    $otherWeek = EmployeeAttendanceWeek::create([
        'employee_id' => $other->id,
        'week_start' => '2026-10-05',
    ]);

    $this->actingAs($foreman)
        ->get(route('admin.employees.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Employees/Index')
            ->has('employees.data', 1)
            ->where('employees.data.0.email', 'jordan.designated@example.com')
            ->where('employees.data.0.foreman.name', $foreman->name)
        );

    $this->actingAs($foreman)
        ->get(route('admin.employee-attendance.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/EmployeeAttendance/Index')
            ->has('weeks.data', 1)
            ->where('weeks.data.0.employee.email', 'jordan.designated@example.com')
        );

    $this->actingAs($foreman)
        ->get(route('admin.employees.edit', $other))
        ->assertForbidden();

    $this->actingAs($foreman)
        ->get(route('admin.employee-attendance.edit', $otherWeek))
        ->assertForbidden();

    $this->actingAs($admin)
        ->get(route('admin.employees.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('employees.data', 2));

    $this->actingAs($foreman, 'sanctum')
        ->getJson('/api/employees/'.$other->uuid)
        ->assertForbidden();

    $this->actingAs($foreman, 'sanctum')
        ->getJson('/api/employees/attendance/'.$otherWeek->id)
        ->assertForbidden();

    $this->actingAs($foreman, 'sanctum')
        ->getJson('/api/employees/'.$designated->uuid)
        ->assertOk()
        ->assertJsonPath('employee.foreman.email', $foreman->email);

    $this->actingAs($foreman, 'sanctum')
        ->getJson('/api/employees/attendance/'.$designatedWeek->id)
        ->assertOk()
        ->assertJsonPath('attendance_week.employee.email', $designated->email);

    $this->actingAs($foreman)
        ->get(route('admin.employees.create'))
        ->assertForbidden();
});
