<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Admin\EmployeeAttendanceController as AdminEmployeeAttendanceController;
use App\Http\Controllers\Controller;
use App\Models\EmployeeAttendanceListing;
use App\Models\EmployeeAttendanceWeek;
use App\Models\User;
use App\Support\EmployeeAccess;
use App\Support\UserPrivileges;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmployeeAttendanceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $this->authorizeAttendance($request, 'view-employees');
        $search = trim((string) $request->query('search', ''));
        $week = $this->admin()->weekQuery($request->query('week'));
        [$from, $to] = $this->admin()->dateRange($request->query('from'), $request->query('to'));
        $perPage = min(100, max(1, $request->integer('per_page', 15)));

        $weeks = EmployeeAccess::scopeVisibleListings(EmployeeAttendanceListing::query(), $user)
            ->with('week:id,uuid')
            ->tap(fn ($query) => $this->admin()->applyListFilters($query, $search, $week, $from, $to))
            ->when($request->filled('employee_id'), fn ($query) => $query->where(
                'employee_id',
                $request->integer('employee_id'),
            ))
            ->orderByDesc('week_start')
            ->orderByDesc('id')
            ->paginate($perPage)
            ->withQueryString()
            ->through(fn (EmployeeAttendanceListing $listing): array => $this->admin()->listingPayload($listing));

        return response()->json([
            'data' => $weeks->items(),
            'meta' => [
                'current_page' => $weeks->currentPage(),
                'from' => $weeks->firstItem(),
                'last_page' => $weeks->lastPage(),
                'per_page' => $weeks->perPage(),
                'to' => $weeks->lastItem(),
                'total' => $weeks->total(),
            ],
            'can' => $this->capabilities($user),
        ]);
    }

    public function options(Request $request): JsonResponse
    {
        $user = $this->authorizeAttendance($request, 'view-employees');

        return response()->json([
            'employees' => $this->admin()->employeeOptions(),
            'weekdays' => EmployeeAttendanceWeek::WEEKDAYS,
            'default_week_start' => now()->startOfWeek(Carbon::MONDAY)->toDateString(),
            'can' => $this->capabilities($user),
        ]);
    }

    public function existing(Request $request): JsonResponse
    {
        $this->authorizeAttendance($request, 'create-employees');

        return $this->admin()->existing($request);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $this->authorizeAttendance($request, 'create-employees');
        $week = $this->admin()->saveWeek($request);

        return response()->json([
            'attendance_week' => $this->admin()->weekPayload($week),
            'can' => $this->capabilities($user),
        ], 201);
    }

    public function bulkStore(Request $request): JsonResponse
    {
        $user = $this->authorizeAttendance($request, 'create-employees');
        $weeks = $this->admin()->saveBulk($request);

        return response()->json([
            'attendance_weeks' => array_map(
                fn (EmployeeAttendanceWeek $week): array => $this->admin()->weekPayload($week),
                $weeks,
            ),
            'can' => $this->capabilities($user),
        ], 201);
    }

    public function show(Request $request, EmployeeAttendanceWeek $attendanceWeek): JsonResponse
    {
        $user = $this->authorizeAttendance($request, 'view-employees');
        EmployeeAccess::ensureCanViewWeek($user, $attendanceWeek);

        return response()->json([
            'attendance_week' => $this->admin()->weekPayload($attendanceWeek),
            'can' => $this->capabilities($user),
        ]);
    }

    public function update(Request $request, EmployeeAttendanceWeek $attendanceWeek): JsonResponse
    {
        $user = $this->authorizeAttendance($request, 'update-employees');
        EmployeeAccess::ensureCanViewWeek($user, $attendanceWeek);
        $week = $this->admin()->saveWeek($request, $attendanceWeek);

        return response()->json([
            'attendance_week' => $this->admin()->weekPayload($week),
            'can' => $this->capabilities($user),
        ]);
    }

    public function destroy(Request $request, EmployeeAttendanceWeek $attendanceWeek): JsonResponse
    {
        $user = $this->authorizeAttendance($request, 'delete-employees');
        EmployeeAccess::ensureCanViewWeek($user, $attendanceWeek);

        $attendanceWeek->delete();

        return response()->json([
            'message' => 'Attendance week removed.',
        ]);
    }

    private function authorizeAttendance(Request $request, string $permission): User
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

    private function admin(): AdminEmployeeAttendanceController
    {
        return app(AdminEmployeeAttendanceController::class);
    }
}
