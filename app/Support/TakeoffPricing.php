<?php

namespace App\Support;

use App\Models\Takeoff;
use App\Models\TakeoffCost;
use App\Models\TakeoffGroup;
use App\Models\TakeoffOpening;

class TakeoffPricing
{
    /**
     * @return array{
     *     cost: string,
     *     selling: string,
     *     profit: string,
     *     margin: ?string,
     *     openings: array<int, array{cost: string, selling: string, profit: string, margin: ?string}>,
     *     groups: array<int, array{cost: string, selling: string, profit: string, margin: ?string, quantity: string}>
     * }
     */
    public static function summarize(Takeoff $takeoff): array
    {
        $takeoff->loadMissing(['openings.costs', 'groups.costs', 'groups.openings']);

        $openings = [];
        $groups = [];
        $totalCost = '0.00';
        $totalSelling = '0.00';
        $groupedIds = [];

        foreach ($takeoff->groups as $group) {
            $estimate = self::group($takeoff, $group);
            $groups[$group->id] = $estimate;
            $totalCost = TakeoffMoney::add($totalCost, $estimate['cost']);
            $totalSelling = TakeoffMoney::add($totalSelling, $estimate['selling']);

            foreach ($group->openings as $opening) {
                $groupedIds[$opening->id] = true;
            }
        }

        foreach ($takeoff->openings as $opening) {
            $estimate = self::opening($takeoff, $opening);
            $openings[$opening->id] = $estimate;

            if (! isset($groupedIds[$opening->id]) && $opening->disposition === 'active') {
                $totalCost = TakeoffMoney::add($totalCost, $estimate['cost']);
                $totalSelling = TakeoffMoney::add($totalSelling, $estimate['selling']);
            }
        }

        $profit = TakeoffMoney::sub($totalSelling, $totalCost);

        return [
            'cost' => $totalCost,
            'selling' => $totalSelling,
            'profit' => $profit,
            'margin' => TakeoffMoney::marginRatio($profit, $totalSelling),
            'openings' => $openings,
            'groups' => $groups,
        ];
    }

    /**
     * @return array{cost: string, selling: string, profit: string, margin: ?string}
     */
    public static function opening(Takeoff $takeoff, TakeoffOpening $opening): array
    {
        $estimate = self::fromCosts($takeoff, $opening->costs, (string) $opening->quantity);

        if ($opening->price_override === null || $opening->price_override === '') {
            return $estimate;
        }

        $selling = TakeoffMoney::money($opening->price_override);
        $profit = TakeoffMoney::sub($selling, $estimate['cost']);

        return [
            'cost' => $estimate['cost'],
            'selling' => $selling,
            'profit' => $profit,
            'margin' => TakeoffMoney::marginRatio($profit, $selling),
        ];
    }

    /**
     * @return array{cost: string, selling: string, profit: string, margin: ?string, quantity: string}
     */
    public static function group(Takeoff $takeoff, TakeoffGroup $group): array
    {
        $quantity = '0.00';

        foreach ($group->openings as $opening) {
            if ($opening->disposition !== 'active') {
                continue;
            }

            $quantity = TakeoffMoney::add($quantity, $opening->quantity);
        }

        if ($group->costs->isNotEmpty()) {
            $estimate = self::fromCosts($takeoff, $group->costs, $quantity);
        } else {
            $cost = '0.00';
            $selling = '0.00';

            foreach ($group->openings as $opening) {
                if ($opening->disposition !== 'active') {
                    continue;
                }

                $member = self::opening($takeoff, $opening);
                $cost = TakeoffMoney::add($cost, $member['cost']);
                $selling = TakeoffMoney::add($selling, $member['selling']);
            }

            $profit = TakeoffMoney::sub($selling, $cost);
            $estimate = [
                'cost' => $cost,
                'selling' => $selling,
                'profit' => $profit,
                'margin' => TakeoffMoney::marginRatio($profit, $selling),
            ];
        }

        $estimate['quantity'] = $quantity;

        return $estimate;
    }

    /**
     * @param  iterable<int, TakeoffCost>  $costs
     * @return array{cost: string, selling: string, profit: string, margin: ?string}
     */
    public static function fromCosts(Takeoff $takeoff, iterable $costs, string $quantity): array
    {
        $costTotal = '0.00';
        $sellingTotal = '0.00';

        foreach ($costs as $cost) {
            $amount = self::rowAmount($cost);
            $extended = $cost->basis === 'per_unit'
                ? TakeoffMoney::mul($amount, $quantity)
                : $amount;
            $costTotal = TakeoffMoney::add($costTotal, $extended);

            if (self::isFee($cost)) {
                continue;
            }

            $sellingTotal = TakeoffMoney::add(
                $sellingTotal,
                TakeoffMoney::selling(
                    $extended,
                    self::method($takeoff, $cost),
                    self::markupRate($takeoff, $cost),
                    self::marginRate($takeoff, $cost),
                ),
            );
        }

        $profit = TakeoffMoney::sub($sellingTotal, $costTotal);

        return [
            'cost' => $costTotal,
            'selling' => $sellingTotal,
            'profit' => $profit,
            'margin' => TakeoffMoney::marginRatio($profit, $sellingTotal),
        ];
    }

    public static function rowAmount(TakeoffCost $cost): string
    {
        if ($cost->kind === 'labor') {
            return TakeoffMoney::mul($cost->labor_hours ?? '0', $cost->hourly_rate ?? '0');
        }

        return TakeoffMoney::money($cost->amount ?? '0');
    }

    private static function isFee(TakeoffCost $cost): bool
    {
        return $cost->kind === 'transaction_fee' || $cost->price_scope === 'fee';
    }

    private static function method(Takeoff $takeoff, TakeoffCost $cost): string
    {
        if ($cost->price_scope !== 'install') {
            return (string) $takeoff->pricing_method;
        }

        $installMethod = $takeoff->install_pricing_method ?: 'markup';
        $hasInstallRate = $installMethod === 'margin'
            ? $takeoff->install_margin_rate !== null
            : $takeoff->install_markup_rate !== null;

        return $hasInstallRate ? (string) $installMethod : (string) $takeoff->pricing_method;
    }

    private static function markupRate(Takeoff $takeoff, TakeoffCost $cost): ?string
    {
        if ($cost->price_scope === 'install' && $takeoff->install_markup_rate !== null) {
            return (string) $takeoff->install_markup_rate;
        }

        return $takeoff->markup_rate !== null ? (string) $takeoff->markup_rate : null;
    }

    private static function marginRate(Takeoff $takeoff, TakeoffCost $cost): ?string
    {
        if ($cost->price_scope === 'install' && $takeoff->install_margin_rate !== null) {
            return (string) $takeoff->install_margin_rate;
        }

        return $takeoff->margin_rate !== null ? (string) $takeoff->margin_rate : null;
    }
}
