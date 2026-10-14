<?php

namespace App\Support;

use App\Models\Takeoff;
use App\Models\TakeoffOpening;

class TakeoffRevision
{
    /**
     * @return array{added: list<array{id: int, tag: ?string, label: string}>, removed: list<array{id: int, tag: ?string, label: string}>, changed: list<array{id: int, tag: ?string, label: string}>}
     */
    public static function diff(Takeoff $current, Takeoff $previous): array
    {
        $current->loadMissing('openings');
        $previous->loadMissing('openings');

        $previousByOrigin = [];

        foreach ($previous->openings as $opening) {
            $previousByOrigin[self::origin($opening)] = $opening;
        }

        $added = [];
        $changed = [];
        $seen = [];

        foreach ($current->openings as $opening) {
            $origin = self::origin($opening);
            $seen[$origin] = true;
            $before = $previousByOrigin[$origin] ?? null;

            if (! $before) {
                $added[] = self::row($opening);

                continue;
            }

            if (TakeoffGrouping::signature($opening) !== TakeoffGrouping::signature($before)) {
                $changed[] = self::row($opening);
            }
        }

        $removed = [];

        foreach ($previous->openings as $opening) {
            $origin = self::origin($opening);

            if (! isset($seen[$origin])) {
                $removed[] = self::row($opening);
            }
        }

        return [
            'added' => $added,
            'removed' => $removed,
            'changed' => $changed,
        ];
    }

    public static function origin(TakeoffOpening $opening): string
    {
        return (string) ($opening->origin_opening_id ?: $opening->id);
    }

    /**
     * @return array{id: int, tag: ?string, label: string}
     */
    private static function row(TakeoffOpening $opening): array
    {
        $label = $opening->is_bulk
            ? 'Bulk '.($opening->tag ?: $opening->opening_type)
            : ($opening->tag ?: 'Untagged '.$opening->opening_type);

        return [
            'id' => $opening->id,
            'tag' => $opening->tag,
            'label' => $label,
        ];
    }
}
