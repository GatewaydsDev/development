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
        return self::fromCosts($takeoff, $opening->costs, (string) $opening->quantity);
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
            $sellingTotal = TakeoffMoney::add(
                $sellingTotal,
                TakeoffMoney::selling(
                    $extended,
                    $takeoff->pricing_method,
                    $takeoff->markup_rate !== null ? (string) $takeoff->markup_rate : null,
                    $takeoff->margin_rate !== null ? (string) $takeoff->margin_rate : null,
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
}
