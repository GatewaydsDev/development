<?php

namespace App\Support;

use App\Models\Takeoff;
use App\Models\TakeoffOpening;
use App\Models\TakeoffSupplierQuote;
use Illuminate\Support\Carbon;

class TakeoffReview
{
    /**
     * @return list<array{code: string, message: string, opening_id: ?int}>
     */
    public static function flags(Takeoff $takeoff): array
    {
        $takeoff->loadMissing(['openings.costs', 'openings.group.costs', 'groups.costs', 'supplierQuotes']);
        $flags = [];
        $tags = [];

        foreach ($takeoff->openings as $opening) {
            $tag = self::tag($opening->tag);

            if ($tag !== '') {
                $tags[$tag][] = $opening->id;
            }

            foreach (self::openingFlags($opening) as $flag) {
                $flags[] = $flag;
            }
        }

        foreach ($tags as $tag => $ids) {
            if (count($ids) < 2) {
                continue;
            }

            foreach ($ids as $id) {
                $flags[] = [
                    'code' => 'duplicate_tag',
                    'message' => 'Opening tag '.$tag.' is used more than once. Duplicate tags are kept separate.',
                    'opening_id' => $id,
                ];
            }
        }

        foreach ($takeoff->supplierQuotes as $quote) {
            if (! self::expired($quote)) {
                continue;
            }

            $flags[] = [
                'code' => 'expired_supplier_quote',
                'message' => 'Supplier quote '.($quote->quote_number ?: $quote->supplier_name).' is expired.',
                'opening_id' => $quote->opening_id,
            ];
        }

        return $flags;
    }

    /**
     * @return list<array{code: string, message: string, opening_id: int}>
     */
    public static function openingFlags(TakeoffOpening $opening): array
    {
        if (in_array($opening->disposition, ['excluded', 'not_applicable'], true) && filled($opening->disposition_reason)) {
            return $opening->needs_review ? [[
                'code' => 'needs_review',
                'message' => 'This opening needs review.',
                'opening_id' => $opening->id,
            ]] : [];
        }

        $waived = is_array($opening->waived_checks) ? $opening->waived_checks : [];
        $flags = [];

        if (($opening->width === null || $opening->height === null) && ! self::waived($waived, 'dimensions')) {
            $flags[] = self::flag($opening, 'missing_dimensions', 'Width or height is missing.');
        }

        $hasProduct = $opening->product_id || filled($opening->manufacturer) || filled($opening->product_model);

        if (! $hasProduct && ! self::waived($waived, 'product')) {
            $flags[] = self::flag($opening, 'missing_product', 'No product is selected or named.');
        }

        $hasRequirement = filled($opening->acoustic_requirement)
            || filled($opening->rf_requirement)
            || filled($opening->fire_requirement)
            || filled($opening->ballistic_requirement)
            || filled($opening->other_requirements);

        if ($hasRequirement && $opening->verification_status !== 'completed' && ! self::waived($waived, 'technical')) {
            $flags[] = self::flag($opening, 'unverified_requirement', 'A technical requirement is recorded and verification is not completed.');
        }

        if ($opening->opening_type === 'door' && ! filled($opening->hardware_set) && ! self::waived($waived, 'hardware')) {
            $flags[] = self::flag($opening, 'missing_hardware', 'Hardware set is missing for this door.');
        }

        $hasPricing = $opening->costs->isNotEmpty() || ($opening->group && $opening->group->costs->isNotEmpty());

        if (! $hasPricing && ! self::waived($waived, 'pricing')) {
            $flags[] = self::flag($opening, 'missing_pricing', 'Pricing is missing.');
        }

        if ($opening->group && $opening->group->mismatch) {
            $flags[] = self::flag($opening, 'group_mismatch', 'This opening is in a manual group whose configurations do not all match.');
        }

        if ($opening->needs_review) {
            $flags[] = self::flag($opening, 'needs_review', 'This opening needs review.');
        }

        if ($opening->group && $opening->costs->isNotEmpty() && $opening->group->costs->isNotEmpty()) {
            $flags[] = self::flag($opening, 'grouped_opening_costs', 'This opening has its own costs, and its group does too. The estimate uses the group costs.');
        }

        return $flags;
    }

    /**
     * @param  array<string, mixed>  $waived
     */
    private static function waived(array $waived, string $check): bool
    {
        return filled($waived[$check] ?? null);
    }

    /**
     * @return array{code: string, message: string, opening_id: int}
     */
    private static function flag(TakeoffOpening $opening, string $code, string $message): array
    {
        return [
            'code' => $code,
            'message' => $message,
            'opening_id' => $opening->id,
        ];
    }

    private static function tag(?string $tag): string
    {
        return mb_strtolower(trim((string) $tag));
    }

    private static function expired(TakeoffSupplierQuote $quote): bool
    {
        if (! $quote->expires_at) {
            return false;
        }

        return Carbon::parse($quote->expires_at)->startOfDay()->lt(now()->startOfDay());
    }
}
