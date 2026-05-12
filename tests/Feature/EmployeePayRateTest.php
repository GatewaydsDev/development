<?php

use App\Models\Employee;
use App\Models\EmployeePayRate;
use App\Models\Profession;
use App\Models\User;
use App\Models\UserLevel;

function employeeAdmin(): User
{
    $level = UserLevel::firstOrCreate([
        'name' => UserLevel::SUPER_ADMIN,
    ]);

    return User::factory()->create([
        'level_id' => $level->id,
    ]);
}

test('a profession can be created from the employee form flow', function () {
    $admin = employeeAdmin();

    $response = $this
        ->actingAs($admin)
        ->post(route('admin.professions.store'), [
            'name' => 'Foreman',
        ]);

    $response->assertSessionHasNoErrors();

    $this->assertDatabaseHas('professions', [
        'name' => 'Foreman',
    ]);
});

test('an employee can be created with multiple pay rates for one profession', function () {
    $admin = employeeAdmin();
    $profession = Profession::create(['name' => 'Foreman']);

    $response = $this
        ->actingAs($admin)
        ->post(route('admin.employees.store'), [
            'first_name' => 'Jordan',
            'last_name' => 'Rivera',
            'email' => 'jordan@example.com',
            'phone_number' => '555-111-2222',
            'job_title' => 'Crew lead',
            'department' => 'Field',
            'employment_status' => Employee::STATUS_ACTIVE,
            'hire_date' => '2026-05-01',
            'notes' => '',
            'pay_rates' => [
                [
                    'profession_id' => (string) $profession->id,
                    'rate_type' => EmployeePayRate::RATE_HOURLY,
                    'custom_rate_type' => '',
                    'amount' => '45.50',
                    'notes' => 'Standard field hourly rate',
                ],
                [
                    'profession_id' => (string) $profession->id,
                    'rate_type' => EmployeePayRate::RATE_OVERTIME,
                    'custom_rate_type' => '',
                    'amount' => '68.25',
                    'notes' => '',
                ],
            ],
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('admin.employees.index'));

    $employee = Employee::query()
        ->where('email', 'jordan@example.com')
        ->firstOrFail();

    expect($employee->payRates)->toHaveCount(2);
    expect($employee->payRates->pluck('rate_type')->all())
        ->toEqualCanonicalizing([
            EmployeePayRate::RATE_HOURLY,
            EmployeePayRate::RATE_OVERTIME,
        ]);
});

test('employee pay rates can be replaced on update', function () {
    $admin = employeeAdmin();
    $foreman = Profession::create(['name' => 'Foreman']);
    $installer = Profession::create(['name' => 'Installer']);
    $employee = Employee::create([
        'first_name' => 'Alex',
        'last_name' => 'Morgan',
        'email' => 'alex@example.com',
        'employment_status' => Employee::STATUS_ACTIVE,
    ]);
    $employee->payRates()->create([
        'profession_id' => $foreman->id,
        'rate_type' => EmployeePayRate::RATE_HOURLY,
        'amount' => 40,
    ]);

    $response = $this
        ->actingAs($admin)
        ->patch(route('admin.employees.update', $employee), [
            'first_name' => 'Alex',
            'last_name' => 'Morgan',
            'email' => 'alex@example.com',
            'phone_number' => '',
            'job_title' => '',
            'department' => '',
            'employment_status' => Employee::STATUS_ACTIVE,
            'hire_date' => '',
            'notes' => '',
            'pay_rates' => [
                [
                    'profession_id' => (string) $installer->id,
                    'rate_type' => EmployeePayRate::RATE_CUSTOM,
                    'custom_rate_type' => 'Weekend emergency',
                    'amount' => '125.00',
                    'notes' => 'Emergency call-out rate',
                ],
                [
                    'profession_id' => (string) $installer->id,
                    'rate_type' => EmployeePayRate::RATE_DAILY,
                    'custom_rate_type' => '',
                    'amount' => '400.00',
                    'notes' => '',
                ],
            ],
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('admin.employees.index'));

    $employee->refresh();

    expect($employee->payRates)->toHaveCount(2);
    expect($employee->payRates()->where('profession_id', $foreman->id)->exists())
        ->toBeFalse();
    expect($employee->payRates()->where('profession_id', $installer->id)->count())
        ->toBe(2);
    expect($employee->payRates()->where('custom_rate_type', 'Weekend emergency')->exists())
        ->toBeTrue();
});
