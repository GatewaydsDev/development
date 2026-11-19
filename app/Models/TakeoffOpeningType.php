<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TakeoffOpeningType extends Model
{
    protected $fillable = [
        'name',
    ];

    public static function displayName(string $name): string
    {
        $trimmed = trim($name);
        $lower = mb_strtolower($trimmed);

        return match ($lower) {
            'door', 'doors' => 'Door',
            'window', 'windows' => 'Window',
            default => $trimmed,
        };
    }

    public static function remember(?string $name): ?string
    {
        $display = self::displayName((string) $name);

        if ($display === '') {
            return null;
        }

        $existing = self::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($display)])
            ->first();

        if ($existing) {
            return $existing->name;
        }

        return self::create(['name' => $display])->name;
    }

    /**
     * @return list<array{id: int, name: string}>
     */
    public static function choices(): array
    {
        $names = ['Door', 'Window'];
        $used = TakeoffOpening::query()
            ->whereNotNull('opening_type')
            ->distinct()
            ->pluck('opening_type');

        foreach ($used as $type) {
            $display = self::displayName((string) $type);

            if ($display !== '') {
                $names[] = $display;
            }
        }

        foreach (array_unique($names) as $name) {
            self::remember($name);
        }

        return self::query()
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (self $type): array => [
                'id' => $type->id,
                'name' => $type->name,
            ])
            ->values()
            ->all();
    }
}
