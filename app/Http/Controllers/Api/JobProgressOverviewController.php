<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EmployeeWorkSchedule;
use App\Models\JobProgressOverview;
use App\Models\User;
use App\Support\JobProgressAccess;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Work schedule, job progress and attendance in one payload, read from the job_progress_overview view.
 */
class JobProgressOverviewController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($unavailable = $this->unavailable()) {
            return $unavailable;
        }

        $user = $this->actor($request);
        $data = $request->validate([
            'status' => ['nullable', 'string', 'max:30'],
            'date' => ['nullable', 'date_format:Y-m-d'],
            'project_uuid' => ['nullable', 'string', 'max:50'],
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $rows = $this->visible($user)
            ->when($data['status'] ?? null, fn ($query, $status) => $status === 'all' ? $query : $query->where('status', $status))
            ->when($data['date'] ?? null, fn ($query, $date) => $query->whereDate('starts_on', '<=', $date)->whereDate('ends_on', '>=', $date))
            ->when($data['project_uuid'] ?? null, fn ($query, $uuid) => $query->where('project_uuid', $uuid))
            ->when($data['search'] ?? null, fn ($query, $term) => $query->where(fn ($inner) => $inner
                ->where('project_name', 'like', "%{$term}%")
                ->orWhere('project_number', 'like', "%{$term}%")
                ->orWhere('foreman_name', 'like', "%{$term}%")))
            ->orderByDesc('starts_on')
            ->orderByDesc('id')
            ->paginate($data['per_page'] ?? 15)
            ->withQueryString();

        return response()->json([
            'data' => $rows->getCollection()->map(fn (JobProgressOverview $row): array => $this->payload($row, $user))->values(),
            'meta' => [
                'current_page' => $rows->currentPage(),
                'last_page' => $rows->lastPage(),
                'per_page' => $rows->perPage(),
                'total' => $rows->total(),
            ],
        ]);
    }

    public function show(Request $request, string $schedule): JsonResponse
    {
        if ($unavailable = $this->unavailable()) {
            return $unavailable;
        }

        $user = $this->actor($request);
        $row = $this->visible($user)->where('uuid', $schedule)->firstOrFail();

        return response()->json(['data' => $this->payload($row, $user)]);
    }

    private function actor(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User && JobProgressAccess::canOpen($user), 403);

        return $user;
    }

    /** @return Builder<JobProgressOverview> */
    private function visible(User $user)
    {
        $ids = JobProgressAccess::visibleTo($user, EmployeeWorkSchedule::query())->select('id');

        return JobProgressOverview::query()->whereIn('id', $ids);
    }

    /** @return array<string, mixed> */
    private function payload(JobProgressOverview $row, User $user): array
    {
        $showPay = JobProgressAccess::canViewAll($user);
        $attendance = collect($row->attendance ?? [])
            ->sortBy([['work_date', 'desc'], ['employee_name', 'asc']])
            ->map(fn (array $day): array => $showPay ? $day : collect($day)->except(['amount', 'pay'])->all())
            ->values();

        $weeks = collect($row->attendance ?? [])
            ->groupBy('week_start')
            ->sortKeysDesc()
            ->map(fn ($days, $start): array => [
                'week_start' => $start,
                'days' => $days->count(),
                'hours' => round((float) $days->sum('hours'), 2),
                'pay' => $showPay ? round((float) $days->sum('pay'), 2) : null,
                'employees' => $days->groupBy('employee_uuid')->map(fn ($items): array => [
                    'uuid' => $items->first()['employee_uuid'],
                    'name' => $items->first()['employee_name'],
                    'days' => $items->count(),
                    'hours' => round((float) $items->sum('hours'), 2),
                    'pay' => $showPay ? round((float) $items->sum('pay'), 2) : null,
                ])->sortBy('name')->values(),
            ])->values();

        $crew = collect($row->crew ?? [])->map(fn (array $member): array => $showPay ? $member : collect($member)->except(['amount'])->all())->values();

        return [
            'uuid' => $row->uuid,
            'status' => $row->status,
            'starts_on' => $row->starts_on?->toDateString(),
            'ends_on' => $row->ends_on?->toDateString(),
            'notes' => $row->notes,
            'project' => ['uuid' => $row->project_uuid, 'project_number' => $row->project_number, 'name' => $row->project_name],
            'foreman' => ['id' => $row->foreman_user_id, 'name' => $row->foreman_name],
            'quality_control' => ['uuid' => $row->quality_control_uuid, 'name' => $row->quality_control_name],
            'competent_person' => ['uuid' => $row->competent_person_uuid, 'name' => $row->competent_person_name],
            'progress' => [
                'overall' => $row->overall_progress,
                'tasks_total' => $row->tasks_total,
                'tasks_done' => $row->tasks_done,
                'tasks' => $row->tasks ?? [],
            ],
            'crew' => $crew,
            'attendance' => [
                'days_count' => $row->attendance_days_count,
                'total_hours' => $row->total_hours,
                'total_pay' => $showPay ? $row->total_pay : null,
                'weeks' => $weeks,
                'days' => $attendance,
            ],
            'quality_reports' => ['count' => $row->quality_reports_count, 'items' => $row->quality_reports ?? []],
            'can' => [
                'update' => $showPay || (int) $row->foreman_user_id === (int) $user->id,
                'view_pay' => $showPay,
            ],
        ];
    }

    private function unavailable(): ?JsonResponse
    {
        return DB::getDriverName() === 'mysql'
            ? null
            : response()->json(['message' => 'Job progress overview requires MySQL.'], 501);
    }
}
