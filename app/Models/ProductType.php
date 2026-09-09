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
        });
    }

    public static function allowsPartsFromName(string $name): bool
    {
        $normalized = mb_strtolower(trim($name));

        return $normalized === 'door'
            || str_ends_with($normalized, ' door')
            || str_contains($normalized, ' door ');
    }

    public static function firstOrCreateForKind(string $kind): self
    {
        $name = $kind === Product::KIND_DOOR ? 'Door' : 'Part';

        return static::query()->firstOrCreate(
            ['name' => $name],
            ['allows_parts' => $name === 'Door'],
        );
    }

    public function kind(): string
    {
        return $this->allows_parts ? Product::KIND_DOOR : Product::KIND_PART;
    }
}
