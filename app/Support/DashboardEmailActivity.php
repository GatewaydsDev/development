<?php

namespace App\Support;

use App\Exceptions\MicrosoftGraphException;
use App\Models\User;
use App\Services\MicrosoftGraphMailService;
use Carbon\CarbonImmutable;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;

/**
 * Daily received / sent email counts for the signed-in user's Microsoft 365
 * mailbox, shown as a chart on the dashboard.
 */
class DashboardEmailActivity
{
    public const RANGES = [7, 14, 30];

    public const DEFAULT_RANGE = 14;

    private const CACHE_SECONDS = 300;

    /**
     * @return array{
     *     status: 'ok'|'no_mailbox'|'error',
     *     mailbox: string|null,
     *     range: int,
     *     days: list<array{date: string, label: string, received: int, sent: int}>,
     *     totals: array{received: int, sent: int},
     *     truncated: bool,
     *     error: string|null,
     *     refreshedAt: string|null
     * }
     */
    public static function for(User $user, mixed $range = null): array
    {
        $range = self::range($range);
        $mailbox = strtolower(trim((string) ($user->fresh()?->microsoft_mailbox ?? $user->microsoft_mailbox ?? '')));

        if ($mailbox === '' || filter_var($mailbox, FILTER_VALIDATE_EMAIL) === false) {
            return self::payload('no_mailbox', null, $range, self::emptyDays($range));
        }

        $cacheKey = 'dashboard-email-activity:'.$user->id.':'.$mailbox.':'.$range;
        $cached = Cache::get($cacheKey);

        if (is_array($cached)) {
            return $cached;
        }

        $timezone = (string) config('app.timezone', 'UTC');
        $today = CarbonImmutable::now($timezone)->startOfDay();
        $since = $today->subDays($range - 1);
        $graph = app(MicrosoftGraphMailService::class)->actingAs($user);

        try {
            $received = $graph->messageTimestamps($mailbox, 'inbox', $since);
            $sent = $graph->messageTimestamps($mailbox, 'sent', $since);
        } catch (MicrosoftGraphException|ConnectionException $exception) {
            report($exception);

            return self::payload(
                'error',
                $mailbox,
                $range,
                self::emptyDays($range),
                false,
                $exception instanceof MicrosoftGraphException
                    ? $exception->getMessage()
                    : 'Microsoft 365 did not respond. Try again in a moment.',
            );
        }

        $days = [];

        for ($day = $since; $day->lessThanOrEqualTo($today); $day = $day->addDay()) {
            $days[$day->toDateString()] = [
                'date' => $day->toDateString(),
                'label' => $day->format('M j'),
                'received' => 0,
                'sent' => 0,
            ];
        }

        foreach (['received' => $received, 'sent' => $sent] as $bucket => $result) {
            foreach ($result['timestamps'] as $stamp) {
                try {
                    $date = CarbonImmutable::parse($stamp)->setTimezone($timezone)->toDateString();
                } catch (\Throwable) {
                    continue;
                }

                if (isset($days[$date])) {
                    $days[$date][$bucket]++;
                }
            }
        }

        $payload = self::payload(
            'ok',
            $mailbox,
            $range,
            array_values($days),
            $received['truncated'] || $sent['truncated'],
        );

        Cache::put($cacheKey, $payload, self::CACHE_SECONDS);

        return $payload;
    }

    public static function range(mixed $range): int
    {
        $range = is_numeric($range) ? (int) $range : self::DEFAULT_RANGE;

        return in_array($range, self::RANGES, true) ? $range : self::DEFAULT_RANGE;
    }

    /**
     * @return list<array{date: string, label: string, received: int, sent: int}>
     */
    private static function emptyDays(int $range): array
    {
        $today = CarbonImmutable::now((string) config('app.timezone', 'UTC'))->startOfDay();
        $days = [];

        for ($offset = $range - 1; $offset >= 0; $offset--) {
            $day = $today->subDays($offset);
            $days[] = [
                'date' => $day->toDateString(),
                'label' => $day->format('M j'),
                'received' => 0,
                'sent' => 0,
            ];
        }

        return $days;
    }

    /**
     * @param  list<array{date: string, label: string, received: int, sent: int}>  $days
     * @return array<string, mixed>
     */
    private static function payload(
        string $status,
        ?string $mailbox,
        int $range,
        array $days,
        bool $truncated = false,
        ?string $error = null,
    ): array {
        return [
            'status' => $status,
            'mailbox' => $mailbox,
            'range' => $range,
            'days' => $days,
            'totals' => [
                'received' => array_sum(array_column($days, 'received')),
                'sent' => array_sum(array_column($days, 'sent')),
            ],
            'truncated' => $truncated,
            'error' => $error,
            'refreshedAt' => $status === 'ok' ? now()->toIso8601String() : null,
        ];
    }
}
