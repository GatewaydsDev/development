<?php

namespace App\Support;

use App\Models\EmployeeWorkSchedule;
use App\Models\QualityControlReport;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Validation\ValidationException;

class QualityControlAssignments
{
    public const PERMISSION = 'send-quality-control-reports';

    public static function canSend(User $user, bool $mobile = false): bool
    {
        return $mobile
            ? $user->hasMobilePermission(self::PERMISSION)
            : $user->hasPermission(self::PERMISSION);
    }

    /**
     * @return Collection<int, User>
     */
    public static function recipients(EmployeeWorkSchedule $schedule): Collection
    {
        $company = $schedule->project?->clientCompany;

        if ($company === null) {
            return new Collection;
        }

        return $company->users()
            ->with('level')
            ->orderBy('name')
            ->get()
            ->filter(fn (User $user): bool => ClientPortalAccess::canOpen($user));
    }

    /**
     * @return list<array{uuid: string, name: string, email: string}>
     */
    public static function recipientPayload(EmployeeWorkSchedule $schedule): array
    {
        return self::recipients($schedule)
            ->map(fn (User $user): array => [
                'uuid' => $user->uuid,
                'name' => $user->name,
                'email' => $user->email,
            ])
            ->all();
    }

    public static function resolveRecipient(EmployeeWorkSchedule $schedule, ?string $uuid): ?User
    {
        if (! filled($uuid)) {
            return null;
        }

        $recipient = self::recipients($schedule)->firstWhere('uuid', $uuid);

        if (! $recipient instanceof User) {
            throw ValidationException::withMessages([
                'assigned_to_user_uuid' => 'Choose a person from this project’s client company.',
            ]);
        }

        return $recipient;
    }

    /**
     * @return array<string, mixed>
     */
    public static function reportPayload(QualityControlReport $report): array
    {
        $report->loadMissing([
            'schedule.project:id,uuid,name,project_number',
            'task:id,uuid,title',
            'inspector:id,name',
            'assignedTo:id,uuid,name,email',
        ]);

        return [
            'uuid' => $report->uuid,
            'project' => $report->schedule?->project ? [
                'uuid' => $report->schedule->project->uuid,
                'name' => $report->schedule->project->name,
                'project_number' => $report->schedule->project->project_number,
            ] : null,
            'task' => $report->task?->title,
            'inspected_on' => $report->inspected_on?->toDateString(),
            'result' => $report->result,
            'result_label' => QualityControlReport::RESULTS[$report->result] ?? $report->result,
            'inspector' => $report->inspector?->name,
            'assigned_to' => $report->assignedTo ? [
                'uuid' => $report->assignedTo->uuid,
                'name' => $report->assignedTo->name,
                'email' => $report->assignedTo->email,
            ] : null,
            'assigned_at' => $report->assigned_at?->toIso8601String(),
            'notes' => $report->notes,
            'corrective_action' => $report->corrective_action,
            'checklist' => collect(QualityControlReport::CHECKLIST)
                ->map(fn (string $label, string $key): array => [
                    'key' => $key,
                    'label' => $label,
                    'answer' => $report->checklist[$key] ?? QualityControlReport::ANSWER_NA,
                    'reason' => $report->fail_reasons[$key] ?? null,
                ])->values()->all(),
        ];
    }

    /**
     * @return Collection<int, QualityControlReport>
     */
    public static function assignedTo(User $user): Collection
    {
        return QualityControlReport::query()
            ->where('assigned_to_user_id', $user->id)
            ->with([
                'schedule.project:id,uuid,name,project_number',
                'task:id,uuid,title',
                'inspector:id,name',
                'assignedTo:id,uuid,name,email',
            ])
            ->latest('assigned_at')
            ->latest('id')
            ->get();
    }
}
