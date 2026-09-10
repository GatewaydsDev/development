<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class TaxState extends Model
{
    /**
     * @var list<array{name: string, rate: float}>
     */
    public const DEFAULTS = [
        [
            'name' => 'New Jersey',
            'rate' => 6.625,
        ],
        [
            'name' => 'New York',
            'rate' => 4.0,
        ],
        [
            'name' => 'Pennsylvania',
            'rate' => 6.0,
        ],
    ];

    protected $fillable = [
        'uuid',
        'name',
        'rate',
    ];

    protected function casts(): array
    {
        return [
            'rate' => 'decimal:3',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (TaxState $taxState): void {
            $taxState->uuid ??= (string) Str::uuid();
        });
    }

    public function statePrices(): HasMany
    {
        return $this->hasMany(ProductStatePrice::class);
    }

    public static function firstOrCreateByName(string $name, mixed $rate = null): self
    {
        $name = trim($name);
        $existing = static::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->first();

        return $existing ?? static::create([
            'name' => $name,
            'rate' => $rate === null || $rate === '' ? null : $rate,
        ]);
    }
}
