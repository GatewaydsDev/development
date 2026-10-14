<?php

namespace App\Support;

use App\Models\Quotation;
use App\Models\QuotationLineItem;
use App\Models\Takeoff;
use App\Models\TakeoffOpening;
use App\Models\TakeoffQuotationLine;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TakeoffConversion
{
    /**
     * @return list<array<string, mixed>>
     */
    public static function lines(Takeoff $takeoff, ?Quotation $quotation = null): array
    {
        $takeoff->loadMissing(['openings.costs', 'openings.group', 'groups.openings', 'groups.costs']);
        $pricing = TakeoffPricing::summarize($takeoff);
        $flags = collect(TakeoffReview::flags($takeoff))->groupBy('opening_id');
        $transferred = $quotation
            ? TakeoffQuotationLine::query()->where('quotation_id', $quotation->id)->pluck('source_key')->all()
            : [];
        $lines = [];

        foreach ($takeoff->groups as $group) {
            $active = $group->openings->where('disposition', 'active');

            if ($active->isEmpty()) {
                continue;
            }

            $estimate = $pricing['groups'][$group->id];
            $quantity = $estimate['quantity'];
            $unit = TakeoffMoney::comp($quantity, '0') === 1
                ? TakeoffMoney::div($estimate['selling'], $quantity)
                : '0.00';
            $memberFlags = [];

            foreach ($active as $opening) {
                foreach ($flags->get($opening->id, []) as $flag) {
                    $memberFlags[] = $flag;
                }
            }

            $lines[] = self::line(
                'group:'.$group->id,
                'origin-group:'.($group->origin_group_id ?: $group->id),
                'group',
                $group->name,
                $quantity,
                $group->name.' — '.$active->map(fn (TakeoffOpening $opening): string => $opening->label())->implode(', '),
                null,
                'Supply and installation for the grouped openings',
                $unit,
                $estimate['selling'],
                $memberFlags,
                in_array('origin-group:'.($group->origin_group_id ?: $group->id), $transferred, true),
                $active->pluck('id')->all(),
            );
        }

        foreach ($takeoff->openings as $opening) {
            if ($opening->disposition !== 'active' || $opening->group_id) {
                continue;
            }

            $estimate = $pricing['openings'][$opening->id];
            $quantity = (string) $opening->quantity;
            $unit = TakeoffMoney::comp($quantity, '0') === 1
                ? TakeoffMoney::div($estimate['selling'], $quantity)
                : '0.00';

            $lines[] = self::line(
                'opening:'.$opening->id,
                'origin-opening:'.($opening->origin_opening_id ?: $opening->id),
                'opening',
                $opening->label(),
                $quantity,
                TakeoffPresenter::lineDescription($opening),
                TakeoffPresenter::size($opening),
                match ($opening->scope) {
                    'supply' => 'Supply only',
                    'installation' => 'Installation only',
                    default => 'Supply and installation',
                },
                $unit,
                $estimate['selling'],
                $flags->get($opening->id, collect())->values()->all(),
                in_array('origin-opening:'.($opening->origin_opening_id ?: $opening->id), $transferred, true),
                [$opening->id],
            );
        }

        return $lines;
    }

    /**
     * @param  list<string>  $keys
     */
    public static function transfer(Takeoff $takeoff, Quotation $quotation, array $keys, bool $replace, User $user): int
    {
        if ((int) $quotation->project_id !== (int) $takeoff->project_id) {
            throw ValidationException::withMessages([
                'quotation_id' => 'Choose a quotation for this project.',
            ]);
        }

        $keys = array_values(array_unique($keys));
        $available = collect(self::lines($takeoff, $quotation))->keyBy('key');
        $selected = collect($keys)->map(function (string $key) use ($available): array {
            $line = $available->get($key);

            if (! $line) {
                throw ValidationException::withMessages([
                    'keys' => 'One of the selected takeoff items is no longer available.',
                ]);
            }

            return $line;
        });

        $groupedOpeningIds = $selected
            ->where('kind', 'group')
            ->flatMap(fn (array $line): array => $line['opening_ids'])
            ->all();

        if ($selected->contains(fn (array $line): bool => $line['kind'] === 'opening' && in_array($line['opening_ids'][0], $groupedOpeningIds, true))) {
            throw ValidationException::withMessages([
                'keys' => 'Choose either a group or its individual openings, not both.',
            ]);
        }

        try {
            return DB::transaction(function () use ($takeoff, $quotation, $selected, $replace, $user): int {
                $existing = TakeoffQuotationLine::query()
                    ->where('quotation_id', $quotation->id)
                    ->whereIn('source_key', $selected->pluck('source_key')->all())
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('source_key');

                if ($existing->isNotEmpty() && ! $replace) {
                    throw ValidationException::withMessages([
                        'keys' => 'Some items were already transferred to this quotation. Choose replace to update those lines.',
                    ]);
                }

                $sort = (int) $quotation->lineItems()->max('sort_order');
                $count = 0;

                foreach ($selected as $line) {
                    $attributes = [
                        'description' => mb_substr($line['description'], 0, 255),
                        'quantity' => $line['quantity'],
                        'size' => $line['size'] ? mb_substr((string) $line['size'], 0, 255) : null,
                        'unit_price' => $line['unit_price'],
                        'extended' => $line['extended'],
                    ];
                    $transfer = $existing->get($line['source_key']);

                    if ($transfer) {
                        $item = $transfer->quotation_line_item_id
                            ? QuotationLineItem::query()->where('quotation_id', $quotation->id)->find($transfer->quotation_line_item_id)
                            : null;

                        if ($item) {
                            $item->update($attributes);
                        } else {
                            $sort++;
                            $item = $quotation->lineItems()->create($attributes + ['sort_order' => $sort]);
                        }

                        $transfer->update([
                            'quotation_line_item_id' => $item->id,
                            'takeoff_id' => $takeoff->id,
                            'takeoff_revision' => $takeoff->revision_number,
                            'snapshot' => self::snapshot($takeoff, $line),
                        ]);
                    } else {
                        $sort++;
                        $item = $quotation->lineItems()->create($attributes + ['sort_order' => $sort]);
                        TakeoffQuotationLine::query()->create([
                            'quotation_id' => $quotation->id,
                            'quotation_line_item_id' => $item->id,
                            'takeoff_id' => $takeoff->id,
                            'takeoff_revision' => $takeoff->revision_number,
                            'source_key' => $line['source_key'],
                            'snapshot' => self::snapshot($takeoff, $line),
                            'created_by' => $user->id,
                        ]);
                    }

                    $count++;
                }

                $takeoff->record($user, 'quotation.converted', 'Transferred '.$count.' item(s) to quotation '.$quotation->quotation_number.'.', [
                    'quotation_id' => $quotation->id,
                    'quotation_number' => $quotation->quotation_number,
                    'replace' => $replace,
                    'keys' => $selected->pluck('key')->all(),
                ]);

                return $count;
            });
        } catch (QueryException $exception) {
            throw ValidationException::withMessages([
                'keys' => 'Those items were already transferred. Reload the preview and try again.',
            ]);
        }
    }

    /**
     * @param  list<array<string, mixed>>  $flags
     * @param  list<int>  $openingIds
     * @return array<string, mixed>
     */
    private static function line(
        string $key,
        string $sourceKey,
        string $kind,
        string $label,
        string $quantity,
        string $description,
        ?string $size,
        string $scope,
        string $unitPrice,
        string $extended,
        array $flags,
        bool $alreadyTransferred,
        array $openingIds,
    ): array {
        return [
            'key' => $key,
            'source_key' => $sourceKey,
            'kind' => $kind,
            'label' => $label,
            'quantity' => $quantity,
            'description' => $description,
            'size' => $size,
            'scope' => $scope,
            'unit_price' => $unitPrice,
            'extended' => $extended,
            'flags' => array_values($flags),
            'already_transferred' => $alreadyTransferred,
            'opening_ids' => $openingIds,
        ];
    }

    /**
     * @param  array<string, mixed>  $line
     * @return array<string, mixed>
     */
    private static function snapshot(Takeoff $takeoff, array $line): array
    {
        return [
            'takeoff_uuid' => $takeoff->uuid,
            'takeoff_revision' => $takeoff->revision_number,
            'description' => $line['description'],
            'quantity' => $line['quantity'],
            'size' => $line['size'],
            'scope' => $line['scope'],
            'unit_price' => $line['unit_price'],
            'extended' => $line['extended'],
            'source_key' => $line['source_key'],
        ];
    }
}
