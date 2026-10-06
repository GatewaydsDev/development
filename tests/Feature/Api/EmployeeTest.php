<?php

use App\Models\Employee;
use App\Models\EmployeeSkillShift;
use App\Models\Language;
use App\Models\Profession;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\Skill;
use App\Models\User;
use App\Models\UserLevel;
use App\Support\EmployeeListVersion;
use App\Support\SkillListVersion;
use Inertia\Testing\AssertableInertia as Assert;

function apiEmployeeUser(string $levelName): User
{
    $level = UserLevel::firstOrCreate(['name' => $levelName]);
    $level->forceFill([
        'permissions' => $level->defaultPermissions(),
    ])->save();

    return User::factory()->create([
        'level_id' => $level->id,
    ]);
}

/**
 * @return array<string, mixed>
 */
function apiEmployeePayload(Project $project, Skill $skill, Profession $profession): array
{
    $language = Language::query()->where('name', 'English')->firstOrFail();

    return [
        'first_name' => 'Jordan',
        'last_name' => 'Rivera',
        'email' => 'jordan.rivera@example.com',
        'phone_number' => '(555) 111-2222',
        'job_title' => 'Carpenter',
        'department' => 'Field',
        'employment_status' => Employee::STATUS_ACTIVE,
        'hire_date' => '2026-05-01',
        'date_of_birth' => '1990-04-12',
        'language_id' => $language->id,
        'notes' => 'Bilingual crew lead',
        'profession_ids' => [$profession->id],
        'skill_ids' => [$skill->id],
        'project_assignments' => [
            [
                'project_id' => $project->id,
                'work_date' => '2026-10-02',
                'notes' => 'Morning site',
            ],
        ],
        'skill_shifts' => [
            [
                'skill_id' => $skill->id,
                'shift_type' => EmployeeSkillShift::SHIFT_FULL_DAY,
                'pay_basis' => EmployeeSkillShift::PAY_HOURLY,
                'amount' => '42.50',
                'is_union_member' => true,
                'union_rate' => '55.00',
                'notes' => '8 hour carpenter shift',
            ],
        ],
        'pay_rates' => [],
    ];
}

test('employee api routes require a token', function () {
    $this->getJson('/api/employees')->assertUnauthorized();
    $this->getJson('/api/employees/options')->assertUnauthorized();
    $this->postJson('/api/employees')->assertUnauthorized();
});

test('users without the mobile employee right cannot list employees', function () {
    $user = apiEmployeeUser(UserLevel::USER);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/employees')
        ->assertForbidden();
});

test('mobile users can list show create and update employees', function () {
    $user = apiEmployeeUser(UserLevel::ADMINISTRATOR);
    $profession = Profession::create(['name' => 'Carpenter']);
    $skill = Skill::create(['name' => 'Carpentry']);
    $project = Project::create([
        'name' => 'Harbor Employee Project',
        'project_status_id' => ProjectStatus::idFor('quoted'),
        'priority' => 'normal',
        'created_by' => $user->id,
    ]);
    $secondProject = Project::create([
        'name' => 'North Employee Project',
        'project_status_id' => ProjectStatus::idFor('quoted'),
        'priority' => 'normal',
        'created_by' => $user->id,
    ]);

    $created = $this->actingAs($user, 'sanctum')
        ->postJson('/api/employees', apiEmployeePayload($project, $skill, $profession))
        ->assertCreated()
        ->assertJsonPath('employee.full_name', 'Jordan Rivera')
        ->assertJsonPath('employee.language.name', 'English')
        ->assertJsonPath('employee.date_of_birth', '1990-04-12')
        ->assertJsonPath('employee.professions.0.name', 'Carpenter')
        ->assertJsonPath('employee.skills.0.name', 'Carpentry')
        ->assertJsonPath('employee.skill_shifts.0.shift_type', 'full_day')
        ->assertJsonPath('employee.skill_shifts.0.is_union_member', true)
        ->assertJsonPath('employee.skill_shifts.0.union_rate', '55.00')
        ->assertJsonPath('can.create', true);

    $employeeUuid = $created->json('employee.uuid');

    expect($employeeUuid)->toMatch(
        '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i',
    );

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/employees?search=Jordan')
        ->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.email', 'jordan.rivera@example.com');

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/employees/'.$employeeUuid)
        ->assertOk()
        ->assertJsonPath('employee.project_assignments.0.project.name', 'Harbor Employee Project');

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/employees/options')
        ->assertOk()
        ->assertJsonStructure([
            'options' => [
                'languages',
                'skills',
                'professions',
                'shiftTypeOptions',
                'payBasisOptions',
            ],
            'can',
        ]);

    $payload = apiEmployeePayload($project, $skill, $profession);
    $payload['project_assignments'][] = [
        'project_id' => $secondProject->id,
        'work_date' => '2026-10-02',
        'notes' => 'Afternoon site',
    ];
    $payload['skill_shifts'][] = [
        'skill_id' => $skill->id,
        'shift_type' => EmployeeSkillShift::SHIFT_HALF_DAY,
        'pay_basis' => EmployeeSkillShift::PAY_DAILY,
        'amount' => '180.00',
        'is_union_member' => false,
        'union_rate' => null,
    ];

    $this->actingAs($user, 'sanctum')
        ->patchJson('/api/employees/'.$employeeUuid, $payload)
        ->assertOk()
        ->assertJsonPath('employee.project_assignments.0.work_date', '2026-10-02')
        ->assertJsonCount(2, 'employee.project_assignments')
        ->assertJsonCount(2, 'employee.skill_shifts');

    $employee = Employee::query()->where('uuid', $employeeUuid)->firstOrFail();

    expect($employee->languagePreference)->not->toBeNull();
    expect($employee->projectAssignments)->toHaveCount(2);
    expect($employee->projectAssignments->pluck('work_date')->map->toDateString()->unique())->toHaveCount(1);

    $this->actingAs($user, 'sanctum')
        ->deleteJson('/api/employees/'.$employeeUuid)
        ->assertOk();

    $this->assertDatabaseMissing('employees', [
        'id' => $employee->id,
    ]);
});

test('a union skill shift requires a union rate', function () {
    $user = apiEmployeeUser(UserLevel::ADMINISTRATOR);
    $profession = Profession::create(['name' => 'Laborer']);
    $skill = Skill::create(['name' => 'Labor']);
    $project = Project::create([
        'name' => 'Union Check Project',
        'project_status_id' => ProjectStatus::idFor('quoted'),
        'priority' => 'normal',
        'created_by' => $user->id,
    ]);
    $payload = apiEmployeePayload($project, $skill, $profession);
    $payload['email'] = 'union.check@example.com';
    $payload['skill_shifts'][0]['union_rate'] = null;

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/employees', $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors('skill_shifts.0.union_rate');
});

test('the mobile app can add and remove pay rates on a profession', function () {
    $user = apiEmployeeUser(UserLevel::ADMINISTRATOR);
    $profession = Profession::create(['name' => 'Foreman']);
    $skill = Skill::create(['name' => 'Supervision']);
    $project = Project::create([
        'name' => 'Foreman Rate Project',
        'project_status_id' => ProjectStatus::idFor('quoted'),
        'priority' => 'normal',
        'created_by' => $user->id,
    ]);

    $payload = apiEmployeePayload($project, $skill, $profession);
    unset($payload['profession_ids'], $payload['pay_rates']);
    $payload['email'] = 'foreman.rates@example.com';
    $payload['professions'] = [
        [
            'profession_id' => $profession->id,
            'rates' => [
                [
                    'rate_type' => 'hourly',
                    'amount' => '45.00',
                    'notes' => 'Weekday',
                ],
                [
                    'rate_type' => 'daily',
                    'amount' => '320.00',
                ],
            ],
        ],
    ];

    $created = $this->actingAs($user, 'sanctum')
        ->postJson('/api/employees', $payload)
        ->assertCreated()
        ->assertJsonPath('employee.professions.0.name', 'Foreman')
        ->assertJsonPath('employee.professions.0.rates.0.rate_type', 'hourly')
        ->assertJsonPath('employee.professions.0.rates.0.amount', '45.00')
        ->assertJsonPath('employee.professions.0.rates.0.notes', 'Weekday')
        ->assertJsonPath('employee.professions.0.rates.1.rate_type', 'daily')
        ->assertJsonPath('employee.professions.0.rates.1.amount', '320.00')
        ->assertJsonCount(2, 'employee.professions.0.rates')
        ->assertJsonCount(2, 'employee.pay_rates');

    $employeeUuid = $created->json('employee.uuid');

    $payload['professions'][0]['rates'] = [
        [
            'rate_type' => 'hourly',
            'amount' => '48.00',
        ],
        [
            'rate_type' => 'overtime',
            'amount' => '67.50',
        ],
    ];

    $this->actingAs($user, 'sanctum')
        ->patchJson('/api/employees/'.$employeeUuid, $payload)
        ->assertOk()
        ->assertJsonCount(2, 'employee.professions.0.rates')
        ->assertJsonPath('employee.professions.0.rates.0.amount', '48.00')
        ->assertJsonPath('employee.professions.0.rates.1.rate_type', 'overtime');

    $employee = Employee::query()->where('uuid', $employeeUuid)->firstOrFail();

    expect($employee->payRates)->toHaveCount(2);
    expect($employee->payRates()->where('rate_type', 'daily')->exists())->toBeFalse();

    $payload['professions'] = [
        [
            'profession_id' => $profession->id,
            'rates' => [],
        ],
    ];

    $this->actingAs($user, 'sanctum')
        ->patchJson('/api/employees/'.$employeeUuid, $payload)
        ->assertOk()
        ->assertJsonCount(0, 'employee.professions.0.rates')
        ->assertJsonCount(0, 'employee.pay_rates')
        ->assertJsonPath('employee.professions.0.name', 'Foreman');

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/employees/options')
        ->assertOk()
        ->assertJsonPath('options.rateTypeOptions.hourly', 'Hourly')
        ->assertJsonPath('options.rateTypeOptions.daily', 'Daily');
});

test('the mobile app cannot add the same rate twice for one profession', function () {
    $user = apiEmployeeUser(UserLevel::ADMINISTRATOR);
    $profession = Profession::create(['name' => 'Foreman']);
    $skill = Skill::create(['name' => 'Supervision']);
    $project = Project::create([
        'name' => 'Duplicate Rate Project',
        'project_status_id' => ProjectStatus::idFor('quoted'),
        'priority' => 'normal',
        'created_by' => $user->id,
    ]);
    $payload = apiEmployeePayload($project, $skill, $profession);
    unset($payload['profession_ids'], $payload['pay_rates']);
    $payload['email'] = 'duplicate.rate@example.com';
    $payload['professions'] = [
        [
            'profession_id' => $profession->id,
            'rates' => [
                ['rate_type' => 'hourly', 'amount' => '45.00'],
                ['rate_type' => 'daily', 'amount' => '320.00'],
                ['rate_type' => 'hourly', 'amount' => '50.00'],
            ],
        ],
    ];

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/employees', $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors('professions.0.rates.2.rate_type');

    $this->assertDatabaseMissing('employees', [
        'email' => 'duplicate.rate@example.com',
    ]);
});

test('the mobile app can add a language skill and profession', function () {
    $user = apiEmployeeUser(UserLevel::ADMINISTRATOR);

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/employees/languages', ['name' => 'Haitian Creole'])
        ->assertCreated()
        ->assertJsonPath('language.name', 'Haitian Creole');

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/employees/skills', ['name' => 'Welding'])
        ->assertCreated()
        ->assertJsonPath('skill.name', 'Welding');

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/employees/professions', ['name' => 'Welder'])
        ->assertCreated()
        ->assertJsonPath('profession.name', 'Welder');
});

test('a skill added on mobile shows up on the employee form', function () {
    $user = apiEmployeeUser(UserLevel::ADMINISTRATOR);
    $before = SkillListVersion::current();

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/employees/skills', ['name' => 'Welding Live'])
        ->assertCreated()
        ->assertJsonPath('skill.name', 'Welding Live');

    $version = SkillListVersion::current();

    expect($version)->not->toBe($before);

    $this->actingAs($user)
        ->get(route('admin.employees.create'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Employees/Create')
            ->where('skillsVersion', $version)
            ->where('skills', fn ($skills) => collect($skills)->contains(
                fn (array $skill): bool => $skill['name'] === 'Welding Live',
            ))
        );

    $this->actingAs($user)
        ->getJson(route('admin.skills.version'))
        ->assertOk()
        ->assertJsonPath('version', $version);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/employees/skills/version')
        ->assertOk()
        ->assertJsonPath('version', $version);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/employees/options')
        ->assertOk()
        ->assertJsonPath('options.skillsVersion', $version)
        ->assertJsonFragment(['name' => 'Welding Live']);
});

test('adding or updating an employee refreshes skills and professions on the list', function () {
    $user = apiEmployeeUser(UserLevel::ADMINISTRATOR);
    $profession = Profession::create(['name' => 'Carpenter']);
    $nextProfession = Profession::create(['name' => 'Foreman']);
    $skill = Skill::create(['name' => 'Carpentry']);
    $nextSkill = Skill::create(['name' => 'Welding']);
    $project = Project::create([
        'name' => 'Live Employee Project',
        'project_status_id' => ProjectStatus::idFor('quoted'),
        'priority' => 'normal',
        'created_by' => $user->id,
    ]);
    $before = EmployeeListVersion::current();

    $created = $this->actingAs($user, 'sanctum')
        ->postJson('/api/employees', apiEmployeePayload($project, $skill, $profession))
        ->assertCreated();

    $createdVersion = EmployeeListVersion::current();

    expect($createdVersion)->not->toBe($before);

    $payload = apiEmployeePayload($project, $nextSkill, $nextProfession);

    $this->actingAs($user, 'sanctum')
        ->patchJson('/api/employees/'.$created->json('employee.uuid'), $payload)
        ->assertOk()
        ->assertJsonPath('employee.professions.0.name', 'Foreman')
        ->assertJsonPath('employee.skills.0.name', 'Welding');

    $updatedVersion = EmployeeListVersion::current();

    expect($updatedVersion)->not->toBe($createdVersion);

    $this->actingAs($user)
        ->get(route('admin.employees.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Employees/Index')
            ->where('employeesVersion', $updatedVersion)
            ->where('employees.data', fn ($rows) => collect($rows)->contains(
                fn (array $row): bool => ($row['professions'][0]['name'] ?? null) === 'Foreman'
                    && ($row['skills'][0]['name'] ?? null) === 'Welding',
            ))
        );

    $this->actingAs($user)
        ->getJson(route('admin.employees.version'))
        ->assertOk()
        ->assertJsonPath('version', $updatedVersion);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/employees/version')
        ->assertOk()
        ->assertJsonPath('version', $updatedVersion);
});
