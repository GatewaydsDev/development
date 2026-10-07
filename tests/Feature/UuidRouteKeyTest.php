<?php

use App\Models\Employee;
use App\Models\EmployeeAttendanceWeek;
use App\Models\User;

it('creates UUID route keys and retains numeric route binding compatibility', function (): void {
    $user = User::factory()->create();

    expect($user->uuid)->toMatch('/^[0-9a-f-]{36}$/')
        ->and($user->getRouteKeyName())->toBe('uuid')
        ->and(route('admin.users.edit', $user))->toContain($user->uuid)
        ->and((new User)->resolveRouteBinding($user->uuid)?->is($user))->toBeTrue()
        ->and((new User)->resolveRouteBinding((string) $user->id)?->is($user))->toBeTrue();
});

it('automatically assigns a UUID to attendance weeks', function (): void {
    $employee = Employee::create([
        'first_name' => 'UUID',
        'last_name' => 'Test',
        'email' => 'uuid.attendance@example.com',
        'employment_status' => Employee::STATUS_ACTIVE,
    ]);

    $week = EmployeeAttendanceWeek::create([
        'employee_id' => $employee->id,
        'week_start' => '2026-10-05',
    ]);

    expect($week->uuid)->toMatch('/^[0-9a-f-]{36}$/')
        ->and($week->getRouteKeyName())->toBe('uuid')
        ->and(route('admin.employee-attendance.edit', $week))->toContain($week->uuid);
});
