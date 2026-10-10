<?php

namespace App\Support;

use App\Events\QuotationRevisionAssigned;
use App\Events\QuotationRevisionResponded;
use App\Models\QuotationRevision;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class QuotationRevisionAssignments
{
    public const ACCEPTED = 'accepted';

    public const DECLINED = 'declined';

    public const RESPONSE_STATUSES = [
        self::ACCEPTED => 'Accepted',
        self::DECLINED => 'Declined',
    ];

    /**
     * Assignment columns to merge into a revision's attributes when its responsible user is set or changes.
     *
     * @return array<string, mixed>
     */
    public static function assignmentAttributes(?int $responsibleUserId, ?User $assignedBy): array
    {
        return [
            'responsible_assigned_by_id' => $responsibleUserId ? $assignedBy?->id : null,
            'responsible_assigned_at' => $responsibleUserId ? now() : null,
            'responsible_response' => null,
            'responsible_responded_at' => null,
        ];
    }

    public static function notifyAssigned(QuotationRevision $revision): void
    {
        if (! $revision->responsible_user_id
            || $revision->responsible_user_id === $revision->responsible_assigned_by_id) {
            return;
        }

        self::broadcastAfterCommit(fn () => event(new QuotationRevisionAssigned($revision->fresh())));
    }

    public static function notifyResponded(QuotationRevision $revision): void
    {
        if (! $revision->responsible_assigned_by_id
            || $revision->responsible_assigned_by_id === $revision->responsible_user_id) {
            return;
        }

        self::broadcastAfterCommit(fn () => event(new QuotationRevisionResponded($revision->fresh())));
    }

    /**
     * @return array<string, mixed>
     */
    public static function pendingFor(User $user, int $limit = 10): array
    {
        $query = QuotationRevision::query()
            ->where('responsible_user_id', $user->id)
            ->whereNull('responsible_response')
            ->whereHas('quotation');

        return [
            'count' => (clone $query)->count(),
            'items' => $query
                ->with(['quotation', 'status', 'title', 'responsibleAssignedBy'])
                ->latest('responsible_assigned_at')
                ->limit($limit)
                ->get()
                ->map(fn (QuotationRevision $revision): array => self::payload($revision))
                ->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function payload(QuotationRevision $revision): array
    {
        $revision->loadMissing(['quotation', 'status', 'title', 'responsibleUser', 'responsibleAssignedBy']);
        $quotation = $revision->quotation;

        return [
            'uuid' => $revision->uuid,
            'number' => $revision->number,
            'title' => $revision->title?->name,
            'status' => $revision->status?->name,
            'notes' => $revision->notes,
            'response' => $revision->responsible_response,
            'assigned_at' => $revision->responsible_assigned_at?->toISOString(),
            'responded_at' => $revision->responsible_responded_at?->toISOString(),
            'assigned_by' => $revision->responsibleAssignedBy?->name,
            'responsible' => $revision->responsibleUser?->name,
            'quotation' => $quotation ? [
                'uuid' => $quotation->uuid,
                'number' => $quotation->quotation_number,
                'title' => $quotation->title,
                'url' => route('admin.quotations.show', $quotation->uuid, false),
            ] : null,
        ];
    }

    /**
     * Broadcasting must never break saving, e.g. when the Reverb server is not running.
     */
    private static function broadcastAfterCommit(callable $callback): void
    {
        DB::afterCommit(function () use ($callback): void {
            rescue($callback);
        });
    }
}
