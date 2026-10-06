<?php

use App\Models\Employee;
use App\Models\EmployeePayRate;
use App\Models\EmployeeSkillShift;
use App\Models\Language;
use App\Models\Profession;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\Skill;
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

test('an employee form stores language projects skills and union shift pay', function () {
    $admin = employeeAdmin();
    $language = Language::query()->where('name', 'Spanish')->firstOrFail();
    $profession = Profession::create(['name' => 'Carpenter']);
    $skill = Skill::create(['name' => 'Finish carpentry']);
    $morning = Project::create([
        'name' => 'Morning Site',
        'project_status_id' => ProjectStatus::idFor('quoted'),
        'priority' => 'normal',
        'created_by' => $admin->id,
    ]);
    $afternoon = Project::create([
        'name' => 'Afternoon Site',
        'project_status_id' => ProjectStatus::idFor('quoted'),
        'priority' => 'normal',
        'created_by' => $admin->id,
    ]);

    $response = $this
        ->actingAs($admin)
        ->post(route('admin.employees.store'), [
            'first_name' => 'Sam',
            'last_name' => 'Cole',
            'email' => 'sam.cole@example.com',
            'phone_number' => '(555) 222-3333',
            'job_title' => 'Carpenter',
            'department' => 'Field',
            'employment_status' => Employee::STATUS_ACTIVE,
            'hire_date' => '2026-05-01',
            'date_of_birth' => '1988-02-02',
            'language_id' => $language->id,
            'notes' => '',
            'profession_ids' => [$profession->id],
            'skill_ids' => [$skill->id],
            'project_assignments' => [
                [
                    'project_id' => $morning->id,
                    'work_date' => '2026-10-02',
                    'notes' => 'Morning',
                ],
                [
                    'project_id' => $afternoon->id,
                    'work_date' => '2026-10-02',
                    'notes' => 'Afternoon',
                ],
            ],
            'skill_shifts' => [
                [
                    'skill_id' => $skill->id,
                    'shift_type' => EmployeeSkillShift::SHIFT_COUPLE_HOURS,
                    'pay_basis' => EmployeeSkillShift::PAY_HOURLY,
                    'amount' => '48.00',
                    'is_union_member' => true,
                    'union_rate' => '61.25',
                    'notes' => '',
                ],
            ],
            'pay_rates' => [],
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('admin.employees.index'));

    $employee = Employee::query()->where('email', 'sam.cole@example.com')->firstOrFail();

    expect($employee->date_of_birth?->toDateString())->toBe('1988-02-02');
    expect($employee->languagePreference?->language?->name)->toBe('Spanish');
    expect($employee->professions)->toHaveCount(1);
    expect($employee->skills)->toHaveCount(1);
    expect($employee->projectAssignments)->toHaveCount(2);
    expect($employee->skillShifts)->toHaveCount(1);
    expect($employee->skillShifts->first()?->is_union_member)->toBeTrue();
    expect($employee->skillShifts->first()?->union_rate)->toBe('61.25');
});

test('the same profession cannot store two rates of the same type', function () {
    $admin = employeeAdmin();
    $profession = Profession::create(['name' => 'Foreman']);

    $response = $this
        ->actingAs($admin)
        ->from(route('admin.employees.create'))
        ->post(route('admin.employees.store'), [
            'first_name' => 'Jordan',
            'last_name' => 'Rivera',
            'email' => 'jordan.rates@example.com',
            'phone_number' => '',
            'job_title' => '',
            'department' => '',
            'employment_status' => Employee::STATUS_ACTIVE,
            'hire_date' => '',
            'notes' => '',
            'profession_ids' => [$profession->id],
            'pay_rates' => [
                [
                    'profession_id' => (string) $profession->id,
                    'rate_type' => EmployeePayRate::RATE_HOURLY,
                    'custom_rate_type' => '',
                    'amount' => '45.00',
                    'notes' => '',
                ],
                [
                    'profession_id' => (string) $profession->id,
                    'rate_type' => EmployeePayRate::RATE_DAILY,
                    'custom_rate_type' => '',
                    'amount' => '360.00',
                    'notes' => '',
                ],
                [
                    'profession_id' => (string) $profession->id,
                    'rate_type' => EmployeePayRate::RATE_HOURLY,
                    'custom_rate_type' => '',
                    'amount' => '50.00',
                    'notes' => '',
                ],
            ],
        ]);

    $response
        ->assertRedirect(route('admin.employees.create'))
        ->assertSessionHasErrors('pay_rates.2.rate_type');

    expect(Employee::query()->where('email', 'jordan.rates@example.com')->exists())->toBeFalse();
});

test('skill rates can be stored for an employee', function () {
    $admin = employeeAdmin();
    $painter = Skill::create(['name' => 'Painter']);

    $this->actingAs($admin)
        ->post(route('admin.employees.store'), [
            'first_name' => 'Riley',
            'last_name' => 'Painter',
            'email' => 'riley.painter@example.com',
            'employment_status' => Employee::STATUS_ACTIVE,
            'skill_ids' => [$painter->id],
            'pay_rates' => [
                [
                    'skill_id' => $painter->id,
                    'rate_type' => EmployeePayRate::RATE_HOURLY,
                    'amount' => '42.00',
                ],
                [
                    'skill_id' => $painter->id,
                    'rate_type' => EmployeePayRate::RATE_HALF_DAY,
                    'amount' => '160.00',
                ],
                [
                    'skill_id' => $painter->id,
                    'rate_type' => EmployeePayRate::RATE_DAILY,
                    'amount' => '300.00',
                ],
                [
                    'skill_id' => $painter->id,
                    'rate_type' => EmployeePayRate::RATE_DAY_OFF,
                    'amount' => '150.00',
                ],
                [
                    'skill_id' => $painter->id,
                    'rate_type' => EmployeePayRate::RATE_UNION,
                    'amount' => '55.00',
                ],
            ],
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('admin.employees.index'));

    $employee = Employee::query()->where('email', 'riley.painter@example.com')->firstOrFail();

    expect($employee->skills)->toHaveCount(1)
        ->and($employee->payRates)->toHaveCount(5)
        ->and($employee->payRates->pluck('rate_type')->all())->toEqualCanonicalizing([
            EmployeePayRate::RATE_HOURLY,
            EmployeePayRate::RATE_HALF_DAY,
            EmployeePayRate::RATE_DAILY,
            EmployeePayRate::RATE_DAY_OFF,
            EmployeePayRate::RATE_UNION,
        ])
        ->and($employee->payRates->every(fn (EmployeePayRate $rate): bool => $rate->skill_id === $painter->id))->toBeTrue();
});
