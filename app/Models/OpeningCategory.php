<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class OpeningCategory extends Model
{
    protected $fillable = [
        'uuid',
        'name',
    ];

    protected static function booted(): void
    {
        static::creating(function (OpeningCategory $category): void {
            $category->uuid ??= (string) Str::uuid();
        });
    }

    /**
     * @return list<array{id: int|null, name: string}>
     */
    public static function choices(): array
    {
        $choices = [];
        $known = [];

        foreach (self::query()->orderBy('name')->get(['id', 'name']) as $category) {
            $known[mb_strtolower($category->name)] = true;
            $choices[] = [
                'id' => $category->id,
                'name' => $category->name,
            ];
        }

        $used = TakeoffOpening::query()
            ->whereNotNull('product_category')
            ->distinct()
            ->orderBy('product_category')
            ->pluck('product_category');

        foreach ($used as $name) {
            $trimmed = trim((string) $name);
            $key = mb_strtolower($trimmed);

            if ($trimmed === '' || isset($known[$key])) {
                continue;
            }

            $known[$key] = true;
            $choices[] = [
                'id' => null,
                'name' => $trimmed,
            ];
        }

        usort($choices, fn (array $left, array $right): int => strcasecmp($left['name'], $right['name']));

        return $choices;
    }

    public static function remember(?string $name): ?string
    {
        $trimmed = trim((string) $name);

        if ($trimmed === '') {
            return null;
        }

        $existing = self::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($trimmed)])
            ->first();

        if ($existing) {
            return $existing->name;
        }

        return self::create(['name' => $trimmed])->name;
    }
}
