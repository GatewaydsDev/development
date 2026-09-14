<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class ProductType extends Model
{
    protected $fillable = [
        'uuid',
        'name',
        'allows_parts',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'allows_parts' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (ProductType $type): void {
            $type->uuid ??= (string) Str::uuid();
            $type->allows_parts ??= static::allowsPartsFromName((string) $type->name);
            $type->sort_order ??= static::sortOrderForName((string) $type->name);
        });
    }

    public static function kindFromName(string $name): string
    {
        $normalized = mb_strtolower(trim($name));

        if ($normalized === 'door' || str_ends_with($normalized, ' door') || str_contains($normalized, ' door ')) {
            return Product::KIND_DOOR;
        }

        if ($normalized === 'window' || str_ends_with($normalized, ' window') || str_contains($normalized, ' window ')) {
            return Product::KIND_WINDOW;
        }

        return Product::KIND_PART;
    }

    public static function allowsPartsFromName(string $name): bool
    {
        return in_array(static::kindFromName($name), [
            Product::KIND_DOOR,
            Product::KIND_WINDOW,
        ], true);
    }

    public static function sortOrderForName(string $name): int
    {
        return match (mb_strtolower(trim($name))) {
            'door' => 1,
            'window' => 2,
            'part' => 3,
            default => 10,
        };
    }

    public static function canonicalNames(): array
    {
        return ['Door', 'Window', 'Part'];
    }

    public static function firstOrCreateForKind(string $kind): self
    {
        $name = match ($kind) {
            Product::KIND_DOOR => 'Door',
            Product::KIND_WINDOW => 'Window',
            default => 'Part',
        };

        return static::query()->firstOrCreate(
            ['name' => $name],
            [
                'allows_parts' => static::allowsPartsFromName($name),
                'sort_order' => static::sortOrderForName($name),
            ],
        );
    }

    public static function ensureCanonical(): void
    {
        foreach ([Product::KIND_DOOR, Product::KIND_WINDOW, Product::KIND_PART] as $kind) {
            static::firstOrCreateForKind($kind);
        }
    }

    public function kind(): string
    {
        return static::kindFromName($this->name);
    }
}
