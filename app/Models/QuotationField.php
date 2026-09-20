<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class QuotationField extends Model
{
    public const DEFAULT_NAMES = [
        'Openings',
        'Acoustic rating',
        'Door size',
        'Frame throat / wall',
        'Handing / swing',
        'Fire rating',
        'Qty',
        'Location',
        'Location / opening',
        'Configuration',
        'Door handing',
        'Construction',
        'Thickness',
        'STC rating',
        'RF shielding',
        'ADA',
        'Description',
        'Weight',
        'Area tested',
        'Glass type',
        'Glazing type',
        'Seal',
        'Manufacturer',
        'Abbreviation',
        'Product',
    ];

    /**
     * Opening-condition labels shown as a two-column project table.
     *
     * @var list<string>
     */
    public const OPENING_CONDITION_NAMES = [
        'Openings',
        'Acoustic rating',
        'Door size',
        'Frame throat / wall',
        'Handing / swing',
        'Fire rating',
    ];

    protected $fillable = [
        'uuid',
        'name',
    ];

    protected static function booted(): void
    {
        static::creating(function (QuotationField $field): void {
            $field->uuid ??= (string) Str::uuid();
        });
    }

    public static function firstOrCreateByName(string $name): self
    {
        $name = trim($name);
        $existing = static::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->first();

        return $existing ?? static::query()->create(['name' => $name]);
    }

    /**
     * Every specification slot for a product, including empty values.
     *
     * @return array<string, string>
     */
    public static function specificationsFromProduct(Product $product): array
    {
        $product->loadMissing([
            'manufacturer',
            'configurations',
            'handings',
            'constructions',
            'glassType',
            'glazingType',
            'seal',
        ]);

        $handing = $product->handings->pluck('name')->filter()->implode(', ');
        $stc = $product->stc_rating;

        $values = [
            'Product' => $product->name,
            'Abbreviation' => $product->abbreviation,
            'Manufacturer' => $product->manufacturer?->name,
            'Description' => $product->description,
            'Openings' => null,
            'Location / opening' => null,
            'Door size' => null,
            'Frame throat / wall' => null,
            'Fire rating' => $product->fire_label,
            'Acoustic rating' => $stc,
            'STC rating' => $stc,
            'Thickness' => $product->thickness,
            'RF shielding' => $product->rf_shielding,
            'ADA' => $product->ada === null ? null : ($product->ada ? 'Yes' : 'No'),
            'Weight' => $product->weight === null ? null : (string) $product->weight,
            'Area tested' => $product->area_tested,
            'Glass type' => $product->glassType?->name,
            'Glazing type' => $product->glazingType?->name,
            'Seal' => $product->seal?->name,
            'Configuration' => $product->configurations->pluck('name')->filter()->implode(', '),
            'Handing / swing' => $handing,
            'Door handing' => $handing,
            'Construction' => $product->constructions->pluck('name')->filter()->implode(', '),
        ];

        return collect($values)
            ->map(fn (mixed $value): string => trim((string) ($value ?? '')))
            ->all();
    }

    /**
     * @return array<string, string>
     */
    public static function valuesFromProduct(Product $product): array
    {
        return collect(static::specificationsFromProduct($product))
            ->filter(fn (string $value): bool => $value !== '')
            ->all();
    }
}
