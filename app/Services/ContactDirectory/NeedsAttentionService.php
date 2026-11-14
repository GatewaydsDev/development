<?php

namespace App\Services\ContactDirectory;

use App\Models\ContactDirectory\ContactDirectoryInquiry;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

class NeedsAttentionService
{
    public function __construct(
        private readonly SupplierQuoteCalculator $quoteCalculator,
    ) {}

    /**
     * Suggestions for the signed-in user's visible inquiries.
     *
     * Each suggestion has a reason, an action label and an inquiry id.
     */
    public function suggestionsForUser(User $user): array
    {
        $inquiries = ContactDirectoryInquiry::query()
            ->whereNotIn('status', ['closed', 'cancelled'])
            ->with([
                'currentQuote:id,inquiry_id,uuid,revision_number,expires_at,currency,review_status,is_current_revision',
                'priceRequest:id,uuid,title,status',
            ])
            ->withCount([
                'followUps as pending_follow_ups_count' => fn (Builder $query): Builder => $query->where('status', 'pending'),
            ])
            ->withMax('activities as last_activity_at', 'occurred_at')
            ->orderBy('updated_at')
            ->get();

        $suggestions = [];
        $seen = [];

        foreach ($inquiries as $inquiry) {
            foreach ($this->suggestionsForInquiry($inquiry) as $suggestion) {
                $key = $suggestion['inquiry_id'] . '|' . $suggestion['reason'];

                if (isset($seen[$key])) {
                    continue;
                }

                $seen[$key] = true;
                $suggestions[] = $suggestion;
            }
        }

        return array_slice($suggestions, 0, 50);
    }

    public function suggestionsForInquiry(ContactDirectoryInquiry $inquiry): array
    {
        $inactivityDays = (int) config('contact_directory.inactivity_days', 7);
        $quoteExpiryWarningDays = (int) config('contact_directory.quote_expiry_warning_days', 14);

        $suggestions = [];

        $isClosed = in_array($inquiry->status, ['closed', 'cancelled'], true);

        if ($isClosed) {
            return [];
        }

        if ($inquiry->pending_follow_ups_count === 0) {
            $suggestions[] = [
                'inquiry_id' => $inquiry->id,
                'reason' => 'No follow-up is scheduled for this open inquiry.',
                'action' => 'schedule_follow_up',
                'severity' => 'warning',
            ];
        }

        if (
            $inquiry->waiting_on === 'supplier'
            && $inquiry->expected_response_date !== null
            && $inquiry->expected_response_date->isPast()
        ) {
            $suggestions[] = [
                'inquiry_id' => $inquiry->id,
                'reason' => 'The supplier response is past its expected date.',
                'action' => 'log_response',
                'severity' => 'error',
            ];
        }

        $currentQuote = $inquiry->currentQuote;

        if (
            $currentQuote !== null
            && $currentQuote->review_status === 'awaiting_review'
        ) {
            $suggestions[] = [
                'inquiry_id' => $inquiry->id,
                'reason' => 'A received quote is awaiting review.',
                'action' => 'review_quote',
                'severity' => 'warning',
            ];
        }

        if (
            $currentQuote !== null
            && $currentQuote->expires_at !== null
            && $currentQuote->expires_at->diffInDays(now()) <= $quoteExpiryWarningDays
            && ! $currentQuote->expires_at->isPast()
        ) {
            $suggestions[] = [
                'inquiry_id' => $inquiry->id,
                'reason' => 'The current quote expires soon.',
                'action' => 'review_quote',
                'severity' => 'warning',
            ];
        }

        $hasMissingPrices = $currentQuote !== null
            && $currentQuote->items->isNotEmpty()
            && $currentQuote->items->filter(fn ($item): bool => $item->unit_price === null || trim((string) $item->unit_price) === '')->count() > 0;

        if ($hasMissingPrices) {
            $suggestions[] = [
                'inquiry_id' => $inquiry->id,
                'reason' => 'The current quote is missing prices on one or more line items.',
                'action' => 'request_missing_information',
                'severity' => 'warning',
            ];
        }

        if (
            $inquiry->last_activity_at !== null
            && $inquiry->last_activity_at->diffInDays(now()) >= $inactivityDays
        ) {
            $suggestions[] = [
                'inquiry_id' => $inquiry->id,
                'reason' => "No activity has been logged on this inquiry in {$inactivityDays} days.",
                'action' => 'log_response',
                'severity' => 'warning',
            ];
        }

        return $suggestions;
    }

    public function applyInquiryFilter(Builder $query, User $user): Builder
    {
        $inquiryIds = collect($this->suggestionsForUser($user))
            ->pluck('inquiry_id')
            ->unique()
            ->values()
            ->all();

        return $query->whereKey($inquiryIds);
    }
}
