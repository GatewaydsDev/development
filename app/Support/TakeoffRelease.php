<?php

namespace App\Support;

use App\Models\Project;
use App\Models\Takeoff;
use Illuminate\Validation\ValidationException;

class TakeoffRelease
{
    /**
     * @var list<string>
     */
    public const BLOCKING = [
        'missing_dimensions',
        'missing_product',
        'unverified_requirement',
        'missing_hardware',
        'missing_pricing',
        'missing_handing',
        'needs_review',
        'expired_supplier_quote',
        'thickness_uncertain',
        'commercial_not_approved',
        'missing_supplier_quote',
        'inclusion_unconfirmed',
        'inclusion_missing_price',
        'missing_transaction_fee',
        'group_mismatch',
    ];

    /**
     * @return list<string>
     */
    public static function messages(Takeoff $takeoff): array
    {
        return collect(TakeoffReview::flags($takeoff))
            ->filter(fn (array $flag): bool => in_array($flag['code'], self::BLOCKING, true))
            ->pluck('message')
            ->unique()
            ->values()
            ->all();
    }

    public static function assertReady(Takeoff $takeoff): void
    {
        $messages = self::messages($takeoff);

        if ($messages === []) {
            return;
        }

        throw ValidationException::withMessages([
            'status' => implode(' ', $messages),
        ]);
    }

    public static function assertProjectReady(Project $project): void
    {
        $takeoff = $project->takeoffs()->latest('id')->first();

        if (! $takeoff) {
            return;
        }

        self::assertReady($takeoff);
    }
}
