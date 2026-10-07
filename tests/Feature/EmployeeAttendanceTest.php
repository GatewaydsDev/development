<?php

use App\Models\Employee;
use App\Models\EmployeeAttendanceWeek;
use App\Models\EmployeePayRate;
use App\Models\Profession;
use App\Models\User;
use App\Models\UserLevel;
use Inertia\Testing\AssertableInertia as Assert;

function attendanceAdmin(): User
{
    $level = UserLevel::firstOrCreate([
        'name' => UserLevel::SUPER_ADMIN,
    ]);

    return User::factory()->create([
        'level_id' => $level->id,
    ]);
}

/**
 * @return array{employee: Employee, hourly: EmployeePayRate, daily: EmployeePayRate}
 */
function attendanceEmployee(string $email = 'jordan.attendance@example.com'): array
{
    $employee = Employee::create([
        'first_name' => 'Jordan',
        'last_name' => 'Rivera',
        'email' => $email,
        'employment_status' => Employee::STATUS_ACTIVE,
    ]);
    $profession = Profession::create(['name' => 'Foreman '.$email]);
    $employee->professions()->sync([$profession->id]);
    $hourly = $employee->payRates()->create([
        'profession_id' => $profession->id,
        'rate_type' => EmployeePayRate::RATE_HOURLY,
        'amount' => '45.50',
    ]);
    $daily = $employee->payRates()->create([
        'profession_id' => $profession->id,
        'rate_type' => EmployeePayRate::RATE_DAILY,
        'amount' => '320.00',
    ]);

    return compact('employee', 'hourly', 'daily');
}

/**
 * @return array<string, mixed>
 */
function attendancePayload(Employee $employee, EmployeePayRate $hourly, EmployeePayRate $daily): array
{
    return [
        'employee_id' => $employee->id,
        'week_start' => '2026-10-07',
        'notes' => 'Harbor week',
        'days' => [
            [
                'work_date' => '2026-10-05',
                'profession_id' => $hourly->profession_id,
                'pay_rate_id' => $hourly->id,
                'hours' => '8',
                'scheduled' => true,
                'worked' => true,
                'notes' => 'Morning crew',
            ],
            [
                'work_date' => '2026-10-07',
                'profession_id' => $daily->profession_id,
                'pay_rate_id' => $daily->id,
                'scheduled' => false,
                'worked' => true,
                'notes' => '',
            ],
        ],
    ];
}

test('an attendance week can be added and listed for monday through saturday', function () {
    $admin = attendanceAdmin();
    ['employee' => $employee, 'hourly' => $hourly, 'daily' => $daily] = attendanceEmployee();

    $this->actingAs($admin)
        ->post(route('admin.employee-attendance.store'), attendancePayload($employee, $hourly, $daily))
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('admin.employee-attendance.index'));

    $week = EmployeeAttendanceWeek::query()->firstOrFail();

    $monday = $week->days->first(fn ($day) => $day->work_date->toDateString() === '2026-10-05');
    $wednesday = $week->days->first(fn ($day) => $day->work_date->toDateString() === '2026-10-07');

    expect($week->week_start->toDateString())->toBe('2026-10-05');
    expect($week->saturday()->toDateString())->toBe('2026-10-10');
    expect($week->days)->toHaveCount(2);
    expect($monday->rate_type)->toBe(EmployeePayRate::RATE_HOURLY);
    expect($monday->hours)->toBe('8.00');
    expect($wednesday->hours)->toBeNull();
    expect($wednesday->scheduled)->toBeFalse();
    expect($wednesday->worked)->toBeTrue();

    $this->actingAs($admin)
        ->get(route('admin.employee-attendance.create'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/EmployeeAttendance/Create')
            ->where('employees.0.full_name', 'Jordan Rivera')
            ->where('employees.0.professions.0.rates.0.label', 'Hourly · $45.50')
        );

    $this->actingAs($admin)
        ->get(route('admin.employee-attendance.edit', $week))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/EmployeeAttendance/Edit')
            ->where('attendance.week_start', '2026-10-05')
            ->where('attendance.days.0.weekday', 'monday')
        );

    $this->actingAs($admin)
        ->get(route('admin.employee-attendance.index', ['search' => 'Jordan', 'week' => '2026-10-10']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/EmployeeAttendance/Index')
            ->where('weeks.data.0.employee.full_name', 'Jordan Rivera')
            ->where('weeks.data.0.week_start', '2026-10-05')
            ->where('weeks.data.0.week_end', '2026-10-10')
            ->where('weeks.data.0.scheduled_count', 1)
            ->where('weeks.data.0.worked_count', 2)
            ->where('weeks.data.0.days.0.rate_label', 'Hourly · $45.50')
            ->where('weeks.data.0.pay_total', '684.00')
        );
});

test('attendance days must stay inside monday through saturday and use the employee rate', function () {
    $admin = attendanceAdmin();
    ['employee' => $employee, 'hourly' => $hourly, 'daily' => $daily] = attendanceEmployee();
    $other = attendanceEmployee('other.attendance@example.com');

    $sunday = attendancePayload($employee, $hourly, $daily);
    $sunday['days'][0]['work_date'] = '2026-10-11';

    $this->actingAs($admin)
        ->post(route('admin.employee-attendance.store'), $sunday)
        ->assertSessionHasErrors('days.0.work_date');

    $wrongRate = attendancePayload($employee, $hourly, $daily);
    $wrongRate['days'][0]['pay_rate_id'] = $other['hourly']->id;
    $wrongRate['days'][0]['profession_id'] = $other['hourly']->profession_id;

    $this->actingAs($admin)
        ->post(route('admin.employee-attendance.store'), $wrongRate)
        ->assertSessionHasErrors('days.0.pay_rate_id');

    $this->assertDatabaseCount('employee_attendance_weeks', 0);
});

test('an open day can be added when the employee already has attendance that week', function () {
    $admin = attendanceAdmin();
    ['employee' => $employee, 'hourly' => $hourly, 'daily' => $daily] = attendanceEmployee();
    $payload = attendancePayload($employee, $hourly, $daily);

    $this->actingAs($admin)
        ->post(route('admin.employee-attendance.store'), $payload)
        ->assertRedirect(route('admin.employee-attendance.index'));

    $week = EmployeeAttendanceWeek::query()->firstOrFail();

    $this->actingAs($admin)
        ->getJson(route('admin.employee-attendance.existing', [
            'employee_id' => $employee->id,
            'week_start' => '2026-10-07',
        ]))
        ->assertOk()
        ->assertJsonPath('attendance.week_start', '2026-10-05')
        ->assertJsonPath('attendance.week_label', 'Monday, Oct 5 – Saturday, Oct 10, 2026')
        ->assertJsonCount(2, 'attendance.days');

    $this->actingAs($admin)
        ->post(route('admin.employee-attendance.store'), $payload)
        ->assertSessionHasErrors('days.0.work_date');

    $this->actingAs($admin)
        ->post(route('admin.employee-attendance.store'), [
            'employee_id' => $employee->id,
            'week_start' => '2026-10-07',
            'notes' => 'Saturday crew',
            'days' => [
                [
                    'work_date' => '2026-10-10',
                    'profession_id' => $daily->profession_id,
                    'pay_rate_id' => $daily->id,
                    'scheduled' => true,
                    'worked' => false,
                    'notes' => 'Saturday only',
                ],
            ],
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('admin.employee-attendance.index'));

    $week->refresh();

    expect(EmployeeAttendanceWeek::query()->count())->toBe(1);
    expect($week->days)->toHaveCount(3);
    expect($week->notes)->toBe("Harbor week\nSaturday crew");
    expect($week->days->first(fn ($day) => $day->work_date->toDateString() === '2026-10-05')->rate_type)
        ->toBe(EmployeePayRate::RATE_HOURLY);
    expect($week->days->first(fn ($day) => $day->work_date->toDateString() === '2026-10-10')->notes)
        ->toBe('Saturday only');

    $payload['days'] = [
        [
            'work_date' => '2026-10-10',
            'profession_id' => $daily->profession_id,
            'pay_rate_id' => $daily->id,
            'scheduled' => true,
            'worked' => false,
            'notes' => 'Saturday only',
        ],
    ];

    $this->actingAs($admin)
        ->patch(route('admin.employee-attendance.update', $week), $payload)
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('admin.employee-attendance.index'));

    $week->refresh();

    expect($week->days)->toHaveCount(1);
    expect($week->days->first()->work_date->toDateString())->toBe('2026-10-10');
    expect($week->days->first()->scheduled)->toBeTrue();
    expect($week->days->first()->worked)->toBeFalse();
    expect($week->days->first()->rate_type)->toBe(EmployeePayRate::RATE_DAILY);

    $this->actingAs($admin)
        ->delete(route('admin.employee-attendance.destroy', $week))
        ->assertRedirect(route('admin.employee-attendance.index'));

    $this->assertDatabaseCount('employee_attendance_weeks', 0);
});

test('attendance can be added for several employees on one date', function () {
    $admin = attendanceAdmin();
    $first = attendanceEmployee('bulk.one@example.com');
    $second = attendanceEmployee('bulk.two@example.com');

    $this->actingAs($admin)
        ->post(route('admin.employee-attendance.store'), attendancePayload(
            $first['employee'],
            $first['hourly'],
            $first['daily'],
        ))
        ->assertRedirect(route('admin.employee-attendance.index'));

    $this->actingAs($admin)
        ->get(route('admin.employee-attendance.bulk'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/EmployeeAttendance/Bulk')
            ->has('employees', 2)
        );

    $this->actingAs($admin)
        ->post(route('admin.employee-attendance.bulk.store'), [
            'work_date' => '2026-10-06',
            'scheduled' => true,
            'worked' => false,
            'notes' => 'Crew day',
            'employees' => [
                [
                    'employee_id' => $first['employee']->id,
                    'profession_id' => $first['daily']->profession_id,
                    'pay_rate_id' => $first['daily']->id,
                ],
                [
                    'employee_id' => $second['employee']->id,
                    'profession_id' => $second['hourly']->profession_id,
                    'pay_rate_id' => $second['hourly']->id,
                    'hours' => '5',
                ],
            ],
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('admin.employee-attendance.index'));

    $firstWeek = EmployeeAttendanceWeek::query()
        ->where('employee_id', $first['employee']->id)
        ->firstOrFail()
        ->fresh('days');
    $secondWeek = EmployeeAttendanceWeek::query()
        ->where('employee_id', $second['employee']->id)
        ->firstOrFail()
        ->fresh('days');
    $tuesday = $firstWeek->days->first(
        fn ($day) => $day->work_date->toDateString() === '2026-10-06',
    );

    expect($firstWeek->days)->toHaveCount(3);
    expect($firstWeek->days->first(fn ($day) => $day->work_date->toDateString() === '2026-10-05')->rate_type)
        ->toBe(EmployeePayRate::RATE_HOURLY);
    expect($tuesday->rate_type)->toBe(EmployeePayRate::RATE_DAILY);
    expect($tuesday->scheduled)->toBeTrue();
    expect($tuesday->worked)->toBeFalse();
    expect($tuesday->notes)->toBe('Crew day');
    expect($secondWeek->week_start->toDateString())->toBe('2026-10-05');
    expect($secondWeek->days)->toHaveCount(1);
    expect($secondWeek->days->first()->rate_type)->toBe(EmployeePayRate::RATE_HOURLY);
    expect($secondWeek->days->first()->hours)->toBe('5.00');
    expect($secondWeek->days->first()->amount)->toBe('45.50');

    $this->actingAs($admin)
        ->post(route('admin.employee-attendance.bulk.store'), [
            'work_date' => '2026-10-06',
            'scheduled' => true,
            'worked' => true,
            'employees' => [
                [
                    'employee_id' => $first['employee']->id,
                    'profession_id' => $first['hourly']->profession_id,
                    'pay_rate_id' => $first['hourly']->id,
                    'hours' => '4',
                ],
            ],
        ])
        ->assertSessionHasNoErrors();

    $firstWeek = $firstWeek->fresh('days');
    $updatedTuesday = $firstWeek->days->first(
        fn ($day) => $day->work_date->toDateString() === '2026-10-06',
    );

    expect($firstWeek->days)->toHaveCount(3);
    expect($updatedTuesday->rate_type)->toBe(EmployeePayRate::RATE_HOURLY);
    expect($updatedTuesday->hours)->toBe('4.00');
    expect($updatedTuesday->worked)->toBeTrue();

    $this->actingAs($admin)
        ->post(route('admin.employee-attendance.bulk.store'), [
            'work_date' => '2026-10-11',
            'scheduled' => true,
            'worked' => true,
            'employees' => [
                [
                    'employee_id' => $first['employee']->id,
                    'profession_id' => $first['hourly']->profession_id,
                    'pay_rate_id' => $first['hourly']->id,
                ],
            ],
        ])
        ->assertSessionHasErrors('work_date');

    $this->actingAs($admin)
        ->post(route('admin.employee-attendance.bulk.store'), [
            'work_date' => '2026-10-06',
            'scheduled' => true,
            'worked' => true,
            'employees' => [
                [
                    'employee_id' => $first['employee']->id,
                    'profession_id' => $second['hourly']->profession_id,
                    'pay_rate_id' => $second['hourly']->id,
                ],
            ],
        ])
        ->assertSessionHasErrors('employees.0.pay_rate_id');
});

test('attendance search matches the employee and a start and end date', function () {
    $admin = attendanceAdmin();
    ['employee' => $jordan] = attendanceEmployee();
    $alex = Employee::create([
        'first_name' => 'Alex',
        'last_name' => 'Cole',
        'email' => 'alex.attendance.filter@example.com',
        'employment_status' => Employee::STATUS_ACTIVE,
    ]);

    $profession = Profession::create(['name' => 'Filter crew']);
    $recordDay = function (EmployeeAttendanceWeek $week, string $workDate) use ($profession): void {
        $week->days()->create([
            'work_date' => $workDate,
            'profession_id' => $profession->id,
            'rate_type' => EmployeePayRate::RATE_HOURLY,
            'amount' => '25.00',
            'scheduled' => true,
            'worked' => true,
        ]);
    };
    $recordDay(EmployeeAttendanceWeek::create([
        'employee_id' => $jordan->id,
        'week_start' => '2026-10-05',
    ]), '2026-10-07');
    $recordDay(EmployeeAttendanceWeek::create([
        'employee_id' => $alex->id,
        'week_start' => '2026-10-05',
    ]), '2026-10-07');
    $recordDay(EmployeeAttendanceWeek::create([
        'employee_id' => $jordan->id,
        'week_start' => '2026-10-12',
    ]), '2026-10-12');

    $this->actingAs($admin)
        ->get(route('admin.employee-attendance.index', ['search' => 'Jordan Rivera']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('weeks.data', 2)
            ->where('weeks.data.0.employee.email', 'jordan.attendance@example.com')
            ->where('weeks.data.1.employee.email', 'jordan.attendance@example.com')
        );

    $this->actingAs($admin)
        ->get(route('admin.employee-attendance.index', ['search' => 'alex.attendance']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('weeks.data', 1)
            ->where('weeks.data.0.employee.full_name', 'Alex Cole')
        );

    $this->actingAs($admin)
        ->get(route('admin.employee-attendance.index', [
            'from' => '2026-10-07',
            'to' => '2026-10-08',
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('weeks.data', 2)
            ->where('weeks.data.0.week_start', '2026-10-05')
            ->where('filters.from', '2026-10-07')
            ->where('filters.to', '2026-10-08')
        );

    $this->actingAs($admin)
        ->get(route('admin.employee-attendance.index', [
            'search' => 'Jordan',
            'from' => '2026-10-18',
            'to' => '2026-10-12',
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('weeks.data', 1)
            ->where('weeks.data.0.week_start', '2026-10-12')
            ->where('filters.from', '2026-10-12')
            ->where('filters.to', '2026-10-18')
        );

    $this->actingAs($admin)
        ->get(route('admin.employee-attendance.index', [
            'from' => '2026-10-19',
            'to' => '2026-10-24',
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('weeks.data', 0));

    $this->actingAs($admin)
        ->get(route('admin.employee-attendance.index', [
            'from' => '2026-10-07',
            'to' => '2026-10-07',
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('weeks.data', 2)
            ->where('filters.from', '2026-10-07')
            ->where('filters.to', '2026-10-07')
            ->where('weeks.data.0.week_start', '2026-10-05')
            ->where('weeks.data.1.week_start', '2026-10-05')
        );

    $this->actingAs($admin)
        ->get(route('admin.employee-attendance.index', [
            'from' => '2026-10-07',
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('weeks.data', 2)
            ->where('filters.from', '2026-10-07')
            ->where('filters.to', '2026-10-07')
            ->where('weeks.data.0.week_start', '2026-10-05')
        );
});
