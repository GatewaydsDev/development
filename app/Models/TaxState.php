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

    /**
     * @var array<string, string>
     */
    public const ABBREVIATIONS = [
        'NJ' => 'New Jersey',
        'NY' => 'New York',
        'PA' => 'Pennsylvania',
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

    public function abbreviation(): string
    {
        return static::abbreviationFor($this->name);
    }

    public static function abbreviationFor(?string $name): string
    {
        $name = trim((string) $name);

        if ($name === '') {
            return '';
        }

        if (preg_match('/^[A-Za-z]{2}$/', $name) === 1) {
            return strtoupper($name);
        }

        foreach (static::ABBREVIATIONS as $code => $fullName) {
            if (strcasecmp($fullName, $name) === 0) {
                return $code;
            }
        }

        return collect(preg_split('/\s+/', $name) ?: [])
            ->filter()
            ->map(fn (string $part): string => mb_strtoupper(mb_substr($part, 0, 1)))
            ->implode('');
    }

    public static function findForProjectState(?string $state): ?self
    {
        $state = trim((string) $state);

        if ($state === '') {
            return null;
        }

        $match = static::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($state)])
            ->first();

        if ($match) {
            return $match;
        }

        $mappedName = static::ABBREVIATIONS[strtoupper($state)] ?? null;

        if ($mappedName) {
            $match = static::query()
                ->whereRaw('LOWER(name) = ?', [mb_strtolower($mappedName)])
                ->first();

            if ($match) {
                return $match;
            }
        }

        return static::query()
            ->get()
            ->first(function (self $taxState) use ($state): bool {
                $abbreviation = collect(preg_split('/\s+/', $taxState->name) ?: [])
                    ->filter()
                    ->map(fn (string $part): string => mb_substr($part, 0, 1))
                    ->implode('');

                return strcasecmp($abbreviation, $state) === 0;
            });
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
