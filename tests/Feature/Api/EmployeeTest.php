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

    $employeeId = $created->json('employee.id');

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/employees?search=Jordan')
        ->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.email', 'jordan.rivera@example.com');

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/employees/'.$employeeId)
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
                'projects',
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
        ->patchJson('/api/employees/'.$employeeId, $payload)
        ->assertOk()
        ->assertJsonPath('employee.project_assignments.0.work_date', '2026-10-02')
        ->assertJsonCount(2, 'employee.project_assignments')
        ->assertJsonCount(2, 'employee.skill_shifts');

    $employee = Employee::query()->findOrFail($employeeId);

    expect($employee->languagePreference)->not->toBeNull();
    expect($employee->projectAssignments)->toHaveCount(2);
    expect($employee->projectAssignments->pluck('work_date')->map->toDateString()->unique())->toHaveCount(1);

    $this->actingAs($user, 'sanctum')
        ->deleteJson('/api/employees/'.$employeeId)
        ->assertOk();

    $this->assertDatabaseMissing('employees', [
        'id' => $employeeId,
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
