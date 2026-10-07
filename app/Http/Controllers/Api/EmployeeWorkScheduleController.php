<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Admin\EmployeeWorkScheduleController as AdminEmployeeWorkScheduleController;
use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EmployeeWorkSchedule;
use App\Models\Project;
use App\Models\WorkScheduleListing;
use App\Models\User;
use App\Support\EmployeeAccess;
use App\Support\UserPrivileges;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmployeeWorkScheduleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $this->authorizeSchedule($request, 'view-employees');
        $date = $this->admin()->dateQuery($request->query('date'));
        $search = trim((string) $request->query('search', ''));
        $perPage = min(100, max(1, $request->integer('per_page', 15)));

        $schedules = EmployeeAccess::scopeVisibleScheduleListings(WorkScheduleListing::query(), $user)
            ->when($date, fn ($query) => $query->covering($date))
            ->when($this->admin()->statusQuery($request->query('status')), fn ($query, $status) => $query->where(
                'status',
                $status,
            ))
            ->when($request->filled('project_id') || $request->filled('project_uuid'), function ($query) use ($request) {
                $projectId = $this->admin()->recordId(
                    Project::class,
                    $request->query('project_uuid') ?: $request->query('project_id'),
                );

                if ($projectId !== null) {
                    $query->where('project_id', $projectId);
                }
            })
            ->when($request->filled('foreman_user_id') && ! EmployeeAccess::isForeman($user), fn ($query) => $query->where(
                'foreman_user_id',
                $request->integer('foreman_user_id'),
            ))
            ->when($request->filled('employee_id') || $request->filled('employee_uuid'), function ($query) use ($request) {
                $employeeId = $this->admin()->recordId(
                    Employee::class,
                    $request->query('employee_uuid') ?: $request->query('employee_id'),
                );

                if ($employeeId !== null) {
                    $query->where('crew_employee_ids', 'like', "%|{$employeeId}|%");
                }
            })
            ->tap(fn ($query) => $this->admin()->applyListingSearch($query, $search))
            ->orderByDesc('starts_on')
            ->orderByDesc('id')
            ->paginate($perPage)
            ->withQueryString()
            ->through(fn (WorkScheduleListing $listing): array => $this->admin()->listingPayload($listing));

        return response()->json([
            'data' => $schedules->items(),
            'meta' => [
                'current_page' => $schedules->currentPage(),
                'from' => $schedules->firstItem(),
                'last_page' => $schedules->lastPage(),
                'per_page' => $schedules->perPage(),
                'to' => $schedules->lastItem(),
                'total' => $schedules->total(),
            ],
            'can' => $this->capabilities($user),
        ]);
    }

    public function options(Request $request): JsonResponse
    {
        $user = $this->authorizeSchedule($request, 'view-employees');

        return response()->json([
            ...$this->admin()->formOptions(),
            'can' => $this->capabilities($user),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $this->authorizeSchedule($request, 'create-employees');
        $schedule = $this->admin()->saveSchedule($request);

        return response()->json([
            'schedule' => $this->admin()->payload($schedule),
            'can' => $this->capabilities($user),
        ], 201);
    }

    public function show(Request $request, EmployeeWorkSchedule $schedule): JsonResponse
    {
        $user = $this->authorizeSchedule($request, 'view-employees');
        EmployeeAccess::ensureCanViewSchedule($user, $schedule);

        return response()->json([
            'schedule' => $this->admin()->payload($schedule),
            'can' => $this->capabilities($user),
        ]);
    }

    public function update(Request $request, EmployeeWorkSchedule $schedule): JsonResponse
    {
        $user = $this->authorizeSchedule($request, 'update-employees');
        EmployeeAccess::ensureCanViewSchedule($user, $schedule);
        $schedule = $this->admin()->saveSchedule($request, $schedule);

        return response()->json([
            'schedule' => $this->admin()->payload($schedule),
            'can' => $this->capabilities($user),
        ]);
    }

    public function destroy(Request $request, EmployeeWorkSchedule $schedule): JsonResponse
    {
        $user = $this->authorizeSchedule($request, 'delete-employees');
        EmployeeAccess::ensureCanViewSchedule($user, $schedule);
        $schedule->delete();

        return response()->json([
            'message' => 'Work schedule removed.',
        ]);
    }

    private function authorizeSchedule(Request $request, string $permission): User
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

    private function admin(): AdminEmployeeWorkScheduleController
    {
        return app(AdminEmployeeWorkScheduleController::class);
    }
}
