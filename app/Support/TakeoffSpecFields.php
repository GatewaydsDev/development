<?php

namespace App\Support;

use App\Models\Takeoff;

class TakeoffSpecFields
{
    /**
     * Optional opening specs. A takeoff shows one of these only when its drawing
     * supplied a value, or someone added the field for that drawing.
     *
     * @var array<string, string>
     */
    public const FIELDS = [
        'depth' => 'Depth',
        'scheduled_thickness' => 'Thickness',
        'building_name' => 'Building',
        'frame_type' => 'Frame type',
        'frame_width' => 'Frame width',
        'frame_height' => 'Frame height',
        'frame_depth' => 'Jamb depth',
        'fire_requirement' => 'Fire rating',
        'glazing' => 'Glazing',
        'hardware_set' => 'Hardware set',
        'finish' => 'Finish',
        'acoustic_requirement' => 'Acoustic / STC',
        'rf_requirement' => 'RF shielding',
        'ballistic_requirement' => 'Ballistic',
    ];

    /**
     * @return list<string>
     */
    public static function keys(): array
    {
        return array_keys(self::FIELDS);
    }

    /**
     * @return list<string>
     */
    public static function filledKeys(Takeoff $takeoff): array
    {
        $takeoff->loadMissing('openings');
        $filled = [];

        foreach (self::keys() as $key) {
            foreach ($takeoff->openings as $opening) {
                if (filled($opening->{$key})) {
                    $filled[] = $key;

                    break;
                }
            }
        }

        return $filled;
    }

    /**
     * @return list<string>
     */
    public static function visible(Takeoff $takeoff): array
    {
        $saved = array_values(array_intersect($takeoff->spec_fields ?? [], self::keys()));

        return self::ordered(array_merge($saved, self::filledKeys($takeoff)));
    }

    /**
     * @param  list<string>|null  $requested  Null keeps the fields already remembered and adds any the drawing filled in.
     */
    public static function sync(Takeoff $takeoff, ?array $requested = null): void
    {
        $base = $requested === null
            ? array_values(array_intersect($takeoff->spec_fields ?? [], self::keys()))
            : array_values(array_intersect($requested, self::keys()));
        $next = self::ordered(array_merge($base, self::filledKeys($takeoff)));
        $current = self::ordered($takeoff->spec_fields ?? []);

        if ($next !== $current) {
            $takeoff->forceFill(['spec_fields' => $next])->save();
        }
    }

    /**
     * @param  list<string>  $keys
     * @return list<string>
     */
    private static function ordered(array $keys): array
    {
        $wanted = array_fill_keys($keys, true);

        return array_values(array_filter(self::keys(), fn (string $key): bool => isset($wanted[$key])));
    }
}
