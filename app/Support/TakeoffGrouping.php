<?php

namespace App\Support;

use App\Models\TakeoffOpening;

class TakeoffGrouping
{
    public static function signature(TakeoffOpening $opening): string
    {
        $parts = [
            $opening->opening_type,
            self::text($opening->product_category),
            self::number($opening->width),
            self::number($opening->height),
            self::number($opening->depth),
            $opening->dimension_unit,
            self::text($opening->frame_type),
            self::text($opening->handing),
            self::text($opening->hardware_set),
            self::text($opening->glazing),
            self::text($opening->finish),
            self::text($opening->manufacturer),
            self::text($opening->product_model),
            (string) ($opening->product_id ?? ''),
            $opening->scope,
            self::text($opening->acoustic_requirement),
            self::text($opening->rf_requirement),
            self::text($opening->fire_requirement),
            self::text($opening->ballistic_requirement),
            self::text($opening->other_requirements),
        ];

        return implode("\n", $parts);
    }

    public static function text(?string $value): string
    {
        return mb_strtolower(trim((string) $value));
    }

    public static function number(mixed $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        return bcadd(TakeoffMoney::raw($value), '0', 3);
    }
}
