<?php

namespace App\Support;

use App\Models\Takeoff;
use App\Models\TakeoffOpening;

class TakeoffGuide
{
    /**
     * @return array{ready: bool, next: string, steps: list<array{key: string, title: string, detail: string, state: string, section: string}>}
     */
    public static function for(Takeoff $takeoff): array
    {
        $takeoff->loadMissing(['openings.costs', 'groups.costs', 'supplierQuotes']);

        $active = $takeoff->openings->filter(
            fn (TakeoffOpening $opening): bool => ! in_array($opening->disposition, ['excluded', 'not_applicable'], true),
        );
        $recorded = $active->contains(
            fn (TakeoffOpening $opening): bool => filled($opening->tag) && $opening->width !== null && $opening->height !== null,
        );
        $costs = $takeoff->openings
            ->flatMap(fn (TakeoffOpening $opening) => $opening->costs)
            ->concat($takeoff->groups->flatMap(fn ($group) => $group->costs));
        $material = $costs->where('kind', 'material');
        $materialMissingProduct = $material->contains(fn ($cost): bool => ! filled($cost->product_id));
        $commercialStarted = $active->isNotEmpty() && $active->every(
            fn (TakeoffOpening $opening): bool => filled($opening->commercial_status) && $opening->commercial_status !== 'unverified',
        );
        $blocking = TakeoffRelease::messages($takeoff);

        $steps = [
            [
                'key' => 'opening',
                'title' => 'Record the opening from the drawing',
                'detail' => 'Add one opening. Enter the tag, size, and handing the drawing shows. Leave the cost lines empty.',
                'state' => $recorded ? 'done' : 'open',
                'section' => 'workspace',
            ],
            [
                'key' => 'products',
                'title' => 'Keep each product on its own cost line',
                'detail' => $material->isEmpty()
                    ? 'Leave costs empty until a supplier quote arrives. Then add a separate line for the leaf, the frame, and the hardware, and choose the catalog product. Put the supplier number in the product SKU.'
                    : 'Each material line needs its own catalog product, so the leaf, frame, and hardware stay separate. Put the supplier number in the product SKU.',
                'state' => $material->isEmpty() ? 'later' : ($materialMissingProduct ? 'open' : 'done'),
                'section' => 'assemblies',
            ],
            [
                'key' => 'commercial',
                'title' => 'Set commercial status and the two markups',
                'detail' => 'Set Commercial status on the opening. Use a sell-price override only when a price was agreed, and enter the reason. Set the supply markup above, and the install markup when installation is priced separately.',
                'state' => $active->isEmpty() ? 'later' : ($commercialStarted ? 'done' : 'open'),
                'section' => 'workspace',
            ],
            [
                'key' => 'release',
                'title' => 'Clear the review before you send',
                'detail' => $blocking === []
                    ? 'Approval and a sent quotation stay closed while a review flag remains. The customer quotation shows the selling price only.'
                    : $blocking[0].(count($blocking) > 1 ? ' '.(count($blocking) - 1).' more checks are open.' : '').' The customer quotation shows the selling price only.',
                'state' => $recorded && $blocking === [] ? 'done' : ($recorded ? 'open' : 'later'),
                'section' => 'review',
            ],
        ];

        $current = collect($steps)->first(fn (array $step): bool => $step['state'] === 'open');

        foreach ($steps as $index => $step) {
            if ($current && $step['key'] === $current['key']) {
                $steps[$index]['state'] = 'current';
            } elseif ($step['state'] === 'open') {
                $steps[$index]['state'] = 'later';
            }
        }

        return [
            'ready' => $current === null,
            'next' => $current['title'] ?? 'Ready to approve and send.',
            'steps' => $steps,
        ];
    }
}
