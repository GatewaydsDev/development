<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DailyTaskPhoto;
use App\Models\EmployeeAttendanceDay;
use App\Models\EmployeeWorkSchedule;
use App\Models\Project;
use App\Models\QualityControlReport;
use App\Models\User;
use App\Support\ClientPortalAccess;
use App\Support\ProjectProgress;
use App\Support\QualityControlAssignments;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Read-only, client-safe project data for the mobile app.
 */
class ClientPortalController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $this->client($request);

        $projects = ClientPortalAccess::projects($user)
            ->with('status:id,name,slug')
            ->orderBy('name')
            ->get()
            ->map(function (Project $project): array {
                $progress = ProjectProgress::for($project);

                return [
                    ...$this->summary($project),
                    'overall_progress' => $progress['overall_progress'],
                    'is_working_today' => $progress['is_working_today'],
                ];
            })
            ->values();

        $company = ClientPortalAccess::company($user);

        return response()->json([
            'company' => $company ? ['uuid' => $company->uuid, 'name' => $company->name] : null,
            'data' => $projects,
            'quality_reports' => QualityControlAssignments::assignedTo($user)
                ->map(fn (QualityControlReport $report): array => QualityControlAssignments::reportPayload($report))
                ->values(),
        ]);
    }

    public function show(Request $request, Project $project): JsonResponse
    {
        $user = $this->client($request);
        abort_unless(ClientPortalAccess::canViewProject($user, $project), 404);

        $project->load('status:id,name,slug');
        $progress = ProjectProgress::for($project);
        $progress['schedules'] = $this->withToday($progress['schedules']);

        $progress['attendance_summary'] = $this->attendanceSummary($progress['schedules']);

        return response()->json([
            'project' => [
                ...$this->summary($project),
                'estimated_start_date' => $project->estimated_start_date?->toDateString(),
                'estimated_end_date' => $project->estimated_end_date?->toDateString(),
                'public_notes' => $project->public_notes,
            ],
            'progress' => $progress,
        ]);
    }

    /**
     * Adds today's attendance and the work history to each crew member (matched by name within a schedule).
     * Pay rates are intentionally left out: clients must not see them.
     *
     * @param  list<array<string, mixed>>  $schedules
     * @return list<array<string, mixed>>
     */
    private function withToday(array $schedules): array
    {
        $today = now()->toDateString();

        return array_map(function (array $schedule) use ($today): array {
            $model = EmployeeWorkSchedule::query()->where('uuid', $schedule['uuid'])->first();
            $byName = $model
                ? EmployeeAttendanceDay::query()
                    ->where('employee_work_schedule_id', $model->id)
                    ->with('week.employee')
                    ->orderByDesc('work_date')
                    ->get()
                    ->groupBy(fn ($day) => $day->week?->employee?->fullName())
                : collect();

            $schedule['crew'] = array_map(function (array $member) use ($byName, $today): array {
                $days = $byName->get($member['name'], collect());
                $day = $days->first(fn ($d) => $d->work_date->toDateString() === $today);

                $member['worked_today'] = $day?->worked;
                $member['history'] = $days->map(fn ($d): array => [
                    'date' => $d->work_date->toDateString(),
                    'hours' => $d->hours !== null ? (float) $d->hours : null,
                    'worked' => (bool) $d->worked,
                ])->values()->all();

                return $member;
            }, $schedule['crew']);

            return $schedule;
        }, $schedules);
    }

    /**
     * Counts the distinct days with work on the project, plus recorded hours, across the crew history. Never includes pay rates or costs.
     *
     * @param  list<array<string, mixed>>  $schedules
     * @return array<string, mixed>
     */
    private function attendanceSummary(array $schedules): array
    {
        $people = [];
        $dates = [];

        foreach ($schedules as $schedule) {
            $seen = [];

            foreach ($schedule['crew'] as $member) {
                if (isset($seen[$member['name']])) {
                    continue;
                }
                $seen[$member['name']] = true;

                foreach ($member['history'] as $day) {
                    if (! $day['worked']) {
                        continue;
                    }

                    $dates[$day['date']]['people'][$member['name']] = true;
                    $dates[$day['date']]['hours'] = ($dates[$day['date']]['hours'] ?? 0) + ($day['hours'] ?? 0);
                    $entry = &$people[$member['name']];
                    $entry ??= ['name' => $member['name'], 'days' => 0, 'hours' => 0.0];
                    $entry['days']++;
                    $entry['hours'] += $day['hours'] ?? 0;
                    unset($entry);
                }
            }
        }

        $people = array_values($people);

        return [
            'total_days' => count($dates),
            'total_hours' => array_sum(array_column($people, 'hours')),
            'people' => $people,
            'days' => collect($dates)
                ->map(fn (array $d, string $date): array => [
                    'date' => $date,
                    'people' => array_keys($d['people']),
                    'hours' => $d['hours'],
                ])
                ->sortByDesc('date')
                ->values()
                ->all(),
        ];
    }

    public function photo(Request $request, DailyTaskPhoto $photo): StreamedResponse
    {
        $user = $this->client($request);
        $project = $photo->completion?->schedule?->project;

        abort_unless($project && ClientPortalAccess::canViewProject($user, $project), 404);
        abort_unless(Storage::disk('local')->exists($photo->path), 404);

        return Storage::disk('local')->response($photo->path, $photo->original_name, [
            'Cache-Control' => 'private, max-age=86400',
        ]);
    }

    public function qualityReport(Request $request, QualityControlReport $report): JsonResponse
    {
        $user = $this->client($request);
        abort_unless((int) $report->assigned_to_user_id === (int) $user->id, 404);

        return response()->json([
            'report' => QualityControlAssignments::reportPayload($report),
        ]);
    }

    private function client(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User && ClientPortalAccess::canOpen($user), 403);

        return $user;
    }

    /**
     * @return array<string, mixed>
     */
    private function summary(Project $project): array
    {
        return [
            'uuid' => $project->uuid,
            'project_number' => $project->project_number,
            'name' => $project->name,
            'status' => $project->status?->name,
            'address' => collect([
                $project->site_address_line_1,
                $project->site_city,
                $project->site_state,
            ])->filter()->implode(', ') ?: null,
        ];
    }
}
