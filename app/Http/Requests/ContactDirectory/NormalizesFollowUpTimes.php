<?php

namespace App\Http\Requests\ContactDirectory;

use Illuminate\Support\Carbon;
use Throwable;

/**
 * The browser sends ISO instants (UTC). Eloquent stores the clock time of the Carbon it is given,
 * so convert to the application timezone before validation and persistence.
 */
trait NormalizesFollowUpTimes
{
    protected function normalizeTimes(string ...$keys): void
    {
        $normalized = [];

        foreach ($keys as $key) {
            $value = $this->input($key);

            if (! is_string($value) || trim($value) === '') {
                continue;
            }

            try {
                $normalized[$key] = Carbon::parse($value)->setTimezone(config('app.timezone'))->format('Y-m-d H:i:s');
            } catch (Throwable) {
                // Leave invalid values for the "date" rule to report.
            }
        }

        $this->merge($normalized);
    }
}
