<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Admin\EmployeeController as AdminEmployeeController;
use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\Language;
use App\Models\Profession;
use App\Models\Skill;
use App\Models\User;
use App\Support\EmployeeAccess;
use App\Support\EmployeeListVersion;
use App\Support\SkillListVersion;
use App\Support\UserPrivileges;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class EmployeeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $this->authorizeEmployee($request, 'view-employees');
        $search = (string) $request->query('search', '');
        $perPage = min(100, max(1, $request->integer('per_page', 15)));

        $employees = EmployeeAccess::scopeVisibleEmployees(Employee::query(), $user)
            ->with($this->admin()->employeeRelations())
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($query) use ($search): void {
                    $query
                        ->where('first_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('phone_number', 'like', "%{$search}%")
                        ->orWhere('job_title', 'like', "%{$search}%")
                        ->orWhereHas('professions', fn ($query) => $query->where('name', 'like', "%{$search}%"))
                        ->orWhereHas('skills', fn ($query) => $query->where('name', 'like', "%{$search}%"))
                        ->orWhereHas('languagePreference.language', fn ($query) => $query->where('name', 'like', "%{$search}%"))
                        ->orWhereHas('projectAssignments.project', fn ($query) => $query->where('name', 'like', "%{$search}%"))
                        ->orWhereHas('foreman', fn ($query) => $query->where('name', 'like', "%{$search}%"));
                });
            })
            ->latest()
            ->paginate($perPage)
            ->withQueryString()
            ->through(fn (Employee $employee): array => $this->admin()->employeePayload($employee));

        return response()->json([
            'data' => $employees->items(),
            'meta' => [
                'version' => EmployeeListVersion::current(),
                'current_page' => $employees->currentPage(),
                'from' => $employees->firstItem(),
                'last_page' => $employees->lastPage(),
                'per_page' => $employees->perPage(),
                'to' => $employees->lastItem(),
                'total' => $employees->total(),
            ],
            'can' => $this->capabilities($user),
        ]);
    }

    public function version(Request $request): JsonResponse
    {
        $this->authorizeEmployee($request, 'view-employees');

        return response()->json([
            'version' => EmployeeListVersion::current(),
        ]);
    }

    public function options(Request $request): JsonResponse
    {
        $user = $this->authorizeEmployee($request, 'view-employees');

        return response()->json([
            'options' => $this->admin()->formOptions(),
            'can' => $this->capabilities($user),
        ]);
    }

    public function storeLanguage(Request $request): JsonResponse
    {
        $this->authorizeCatalog($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique(Language::class, 'name')],
        ]);

        $language = Language::createFromName($validated['name']);

        return response()->json([
            'language' => [
                'id' => $language->id,
                'name' => $language->name,
            ],
        ], 201);
    }

    public function skillsVersion(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless(
            $user instanceof User && (
                UserPrivileges::allows($user, 'view-employees')
                || UserPrivileges::allows($user, 'create-employees')
                || UserPrivileges::allows($user, 'update-employees')
            ),
            403,
        );

        return response()->json([
            'version' => SkillListVersion::current(),
        ]);
    }

    public function storeSkill(Request $request): JsonResponse
    {
        $this->authorizeCatalog($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique(Skill::class, 'name')],
        ]);

        $skill = Skill::create([
            'name' => trim($validated['name']),
        ]);

        return response()->json([
            'skill' => [
                'id' => $skill->id,
                'name' => $skill->name,
            ],
        ], 201);
    }

    public function storeProfession(Request $request): JsonResponse
    {
        $this->authorizeCatalog($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique(Profession::class, 'name')],
        ]);

        $profession = Profession::create([
            'name' => trim($validated['name']),
        ]);

        return response()->json([
            'profession' => [
                'id' => $profession->id,
                'name' => $profession->name,
            ],
        ], 201);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $this->authorizeEmployee($request, 'create-employees');
        $employee = $this->admin()->saveEmployee($request);

        return response()->json([
            'employee' => $this->admin()->employeePayload($employee),
            'can' => $this->capabilities($user),
        ], 201);
    }

    public function show(Request $request, Employee $employee): JsonResponse
    {
        $user = $this->authorizeEmployee($request, 'view-employees');
        EmployeeAccess::ensureCanViewEmployee($user, $employee);

        return response()->json([
            'employee' => $this->admin()->employeePayload($employee),
            'can' => $this->capabilities($user),
        ]);
    }

    public function update(Request $request, Employee $employee): JsonResponse
    {
        $user = $this->authorizeEmployee($request, 'update-employees');
        EmployeeAccess::ensureCanViewEmployee($user, $employee);
        $employee = $this->admin()->saveEmployee($request, $employee);

        return response()->json([
            'employee' => $this->admin()->employeePayload($employee),
            'can' => $this->capabilities($user),
        ]);
    }

    public function destroy(Request $request, Employee $employee): JsonResponse
    {
        $user = $this->authorizeEmployee($request, 'delete-employees');
        EmployeeAccess::ensureCanViewEmployee($user, $employee);

        $employee->delete();

        return response()->json([
            'message' => 'Employee removed.',
        ]);
    }

    private function authorizeCatalog(Request $request): User
    {
        $user = $request->user();

        abort_unless(
            $user instanceof User && (
                UserPrivileges::allows($user, 'create-employees')
                || UserPrivileges::allows($user, 'update-employees')
            ),
            403,
        );

        return $user;
    }

    private function authorizeEmployee(Request $request, string $permission): User
    {
        $user = $request->user();

        abort_unless($user instanceof User && UserPrivileges::allows($user, $permission), 403);

        return $user;
    }

    /**
     * @return array<string, bool>
     */
    private function capabilities(User $user): array
    {
        return [
            'view' => UserPrivileges::allows($user, 'view-employees'),
            'create' => UserPrivileges::allows($user, 'create-employees'),
            'update' => UserPrivileges::allows($user, 'update-employees'),
            'delete' => UserPrivileges::allows($user, 'delete-employees'),
        ];
    }

    private function admin(): AdminEmployeeController
    {
        return app(AdminEmployeeController::class);
    }
}
