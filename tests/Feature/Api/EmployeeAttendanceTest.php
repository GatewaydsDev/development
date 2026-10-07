<?php

use App\Models\Employee;
use App\Models\EmployeeAttendanceWeek;
use App\Models\EmployeePayRate;
use App\Models\Profession;
use App\Models\User;
use App\Models\UserLevel;

function attendanceApiUser(string $levelName): User
{
    $level = UserLevel::firstOrCreate(['name' => $levelName]);
    $level->forceFill([
        'permissions' => $level->defaultPermissions(),
    ])->save();

    return User::factory()->create([
        'level_id' => $level->id,
    ]);
}

test('the mobile app can read days already set and add an open day', function () {
    $user = attendanceApiUser(UserLevel::ADMINISTRATOR);
    $employee = Employee::create([
        'first_name' => 'Alex',
        'last_name' => 'Costa',
        'email' => 'alex.mobile.attendance@example.com',
        'employment_status' => Employee::STATUS_ACTIVE,
    ]);
    $profession = Profession::create(['name' => 'Painter']);
    $employee->professions()->sync([$profession->id]);
    $hourly = $employee->payRates()->create([
        'profession_id' => $profession->id,
        'rate_type' => EmployeePayRate::RATE_HOURLY,
        'amount' => '40.00',
    ]);

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/employees/attendance', [
            'employee_id' => $employee->id,
            'week_start' => '2026-10-05',
            'days' => [
                [
                    'work_date' => '2026-10-05',
                    'profession_id' => $profession->id,
                    'pay_rate_id' => $hourly->id,
                    'hours' => 8,
                    'scheduled' => true,
                    'worked' => true,
                ],
            ],
        ])
        ->assertCreated();

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/employees/attendance/existing?employee_id='.$employee->id.'&week_start=2026-10-07')
        ->assertOk()
        ->assertJsonPath('attendance.days.0.work_date', '2026-10-05')
        ->assertJsonCount(1, 'attendance.days');

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/employees/attendance', [
            'employee_id' => $employee->id,
            'week_start' => '2026-10-05',
            'days' => [
                [
                    'work_date' => '2026-10-07',
                    'profession_id' => $profession->id,
                    'pay_rate_id' => $hourly->id,
                    'hours' => 8,
                    'scheduled' => true,
                    'worked' => false,
                ],
            ],
        ])
        ->assertCreated();

    $week = EmployeeAttendanceWeek::query()->where('employee_id', $employee->id)->firstOrFail();

    expect($week->days)->toHaveCount(2);
});

test('attendance api routes require a token', function () {
    $this->getJson('/api/employees/attendance')->assertUnauthorized();
    $this->postJson('/api/employees/attendance')->assertUnauthorized();
});

test('the mobile app can list add and update an attendance week', function () {
    $user = attendanceApiUser(UserLevel::ADMINISTRATOR);
    $employee = Employee::create([
        'first_name' => 'Jordan',
        'last_name' => 'Rivera',
        'email' => 'jordan.mobile.attendance@example.com',
        'employment_status' => Employee::STATUS_ACTIVE,
    ]);
    $profession = Profession::create(['name' => 'Foreman']);
    $employee->professions()->sync([$profession->id]);
    $hourly = $employee->payRates()->create([
        'profession_id' => $profession->id,
        'rate_type' => EmployeePayRate::RATE_HOURLY,
        'amount' => '45.00',
    ]);
    $daily = $employee->payRates()->create([
        'profession_id' => $profession->id,
        'rate_type' => EmployeePayRate::RATE_DAILY,
        'amount' => '320.00',
    ]);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/employees/attendance/options')
        ->assertOk()
        ->assertJsonPath('employees.0.full_name', 'Jordan Rivera')
        ->assertJsonPath('employees.0.professions.0.name', 'Foreman')
        ->assertJsonPath('employees.0.professions.0.rates.0.rate_type', 'hourly')
        ->assertJsonPath('weekdays.0.key', 'monday')
        ->assertJsonPath('weekdays.5.key', 'saturday');

    $created = $this->actingAs($user, 'sanctum')
        ->postJson('/api/employees/attendance', [
            'employee_id' => $employee->id,
            'week_start' => '2026-10-05',
            'notes' => 'Field week',
            'days' => [
                [
                    'work_date' => '2026-10-05',
                    'profession_id' => $profession->id,
                    'pay_rate_id' => $hourly->id,
                    'hours' => 8,
                    'scheduled' => true,
                    'worked' => false,
                ],
                [
                    'work_date' => '2026-10-06',
                    'profession_id' => $profession->id,
                    'pay_rate_id' => $daily->id,
                    'scheduled' => true,
                    'worked' => true,
                ],
            ],
        ])
        ->assertCreated()
        ->assertJsonPath('attendance_week.week_start', '2026-10-05')
        ->assertJsonPath('attendance_week.week_end', '2026-10-10')
        ->assertJsonPath('attendance_week.days.0.weekday', 'monday')
        ->assertJsonPath('attendance_week.days.0.scheduled', true)
        ->assertJsonPath('attendance_week.days.0.worked', false)
        ->assertJsonPath('attendance_week.days.1.rate_type', 'daily')
        ->assertJsonPath('attendance_week.scheduled_count', 2)
        ->assertJsonPath('attendance_week.worked_count', 1);

    $weekId = $created->json('attendance_week.id');

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/employees/attendance?employee_id='.$employee->id)
        ->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.id', $weekId);

    $this->actingAs($user, 'sanctum')
        ->patchJson('/api/employees/attendance/'.$weekId, [
            'employee_id' => $employee->id,
            'week_start' => '2026-10-05',
            'days' => [
                [
                    'work_date' => '2026-10-06',
                    'profession_id' => $profession->id,
                    'pay_rate_id' => $daily->id,
                    'scheduled' => true,
                    'worked' => true,
                ],
            ],
        ])
        ->assertOk()
        ->assertJsonCount(1, 'attendance_week.days')
        ->assertJsonPath('attendance_week.days.0.work_date', '2026-10-06')
        ->assertJsonPath('attendance_week.worked_count', 1);

    $week = EmployeeAttendanceWeek::query()->findOrFail($weekId);

    expect($week->days)->toHaveCount(1);
    expect($week->days->first()->amount)->toBe('320.00');
});

test('the mobile app can add one date for several employees', function () {
    $user = attendanceApiUser(UserLevel::ADMINISTRATOR);
    $foreman = Profession::create(['name' => 'Foreman']);
    $installer = Profession::create(['name' => 'Installer']);
    $lead = Employee::create([
        'first_name' => 'Avery',
        'last_name' => 'Cole',
        'email' => 'avery.bulk@example.com',
        'employment_status' => Employee::STATUS_ACTIVE,
    ]);
    $helper = Employee::create([
        'first_name' => 'Sam',
        'last_name' => 'Lee',
        'email' => 'sam.bulk@example.com',
        'employment_status' => Employee::STATUS_ACTIVE,
    ]);
    $lead->professions()->sync([$foreman->id]);
    $helper->professions()->sync([$installer->id]);
    $leadRate = $lead->payRates()->create([
        'profession_id' => $foreman->id,
        'rate_type' => EmployeePayRate::RATE_HOURLY,
        'amount' => '45.00',
    ]);
    $helperRate = $helper->payRates()->create([
        'profession_id' => $installer->id,
        'rate_type' => EmployeePayRate::RATE_DAILY,
        'amount' => '280.00',
    ]);

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/employees/attendance/bulk', [
            'work_date' => '2026-10-06',
            'scheduled' => true,
            'worked' => true,
            'employees' => [
                [
                    'employee_id' => $lead->id,
                    'profession_id' => $foreman->id,
                    'pay_rate_id' => $leadRate->id,
                    'hours' => 6,
                ],
                [
                    'employee_id' => $helper->id,
                    'profession_id' => $installer->id,
                    'pay_rate_id' => $helperRate->id,
                ],
            ],
        ])
        ->assertCreated()
        ->assertJsonCount(2, 'attendance_weeks')
        ->assertJsonPath('attendance_weeks.0.employee.full_name', 'Avery Cole')
        ->assertJsonPath('attendance_weeks.0.days.0.rate_type', 'hourly')
        ->assertJsonPath('attendance_weeks.1.employee.full_name', 'Sam Lee')
        ->assertJsonPath('attendance_weeks.1.days.0.rate_type', 'daily')
        ->assertJsonPath('attendance_weeks.1.days.0.amount', '280.00');

    expect(EmployeeAttendanceWeek::query()->count())->toBe(2);
});

test('the mobile app can filter attendance by employee and date period', function () {
    $user = attendanceApiUser(UserLevel::ADMINISTRATOR);
    $jordan = Employee::create([
        'first_name' => 'Jordan',
        'last_name' => 'Rivera',
        'email' => 'jordan.api.filter@example.com',
        'employment_status' => Employee::STATUS_ACTIVE,
    ]);
    $alex = Employee::create([
        'first_name' => 'Alex',
        'last_name' => 'Cole',
        'email' => 'alex.api.filter@example.com',
        'employment_status' => Employee::STATUS_ACTIVE,
    ]);

    $profession = Profession::create(['name' => 'Filter crew']);
    $jordanWeek = EmployeeAttendanceWeek::create([
        'employee_id' => $jordan->id,
        'week_start' => '2026-10-05',
    ]);
    $alexWeek = EmployeeAttendanceWeek::create([
        'employee_id' => $alex->id,
        'week_start' => '2026-10-12',
    ]);
    $jordanWeek->days()->create([
        'work_date' => '2026-10-05',
        'profession_id' => $profession->id,
        'rate_type' => EmployeePayRate::RATE_HOURLY,
        'amount' => '25.00',
        'scheduled' => true,
        'worked' => true,
    ]);
    $alexWeek->days()->create([
        'work_date' => '2026-10-12',
        'profession_id' => $profession->id,
        'rate_type' => EmployeePayRate::RATE_HOURLY,
        'amount' => '25.00',
        'scheduled' => true,
        'worked' => true,
    ]);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/employees/attendance?search=Rivera&from=2026-10-01&to=2026-10-10')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.employee.email', 'jordan.api.filter@example.com')
        ->assertJsonPath('data.0.week_start', '2026-10-05');
});
