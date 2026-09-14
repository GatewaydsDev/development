<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class Product extends Model
{
    public const KIND_DOOR = 'door';

    public const KIND_WINDOW = 'window';

    public const KIND_PART = 'part';

    public const KINDS = [
        self::KIND_DOOR,
        self::KIND_WINDOW,
        self::KIND_PART,
    ];

    protected $fillable = [
        'uuid',
        'manufacturer_id',
        'product_type_id',
        'product_model_id',
        'name',
        'abbreviation',
        'kind',
        'description',
        'notes',
        'rf_shielding',
        'stc_rating',
        'ada',
        'fire_label',
        'thickness',
        'area_tested',
        'weight',
        'window_glass_type_id',
        'window_glazing_type_id',
        'window_seal_id',
        'spec_pdf_path',
        'price',
        'markup_percent',
        'min_markup_percent',
        'tax_state_id',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'markup_percent' => 'decimal:2',
            'min_markup_percent' => 'decimal:2',
            'weight' => 'decimal:2',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Product $product): void {
            $product->uuid ??= (string) Str::uuid();
            $product->syncKindAndType();
            $product->syncProductModel();
        });

        static::updating(function (Product $product): void {
            $product->syncKindAndType();
            $product->syncProductModel();
        });

        static::deleting(function (Product $product): void {
            $product->deleteSpecPdf();
        });
    }

    public function manufacturer(): BelongsTo
    {
        return $this->belongsTo(Manufacturer::class);
    }

    public function productType(): BelongsTo
    {
        return $this->belongsTo(ProductType::class);
    }

    public function productModel(): BelongsTo
    {
        return $this->belongsTo(ProductModel::class);
    }

    public function parts(): BelongsToMany
    {
        return $this->belongsToMany(self::class, 'product_part', 'product_id', 'part_id')
            ->withTimestamps()
            ->orderBy('name');
    }

    public function doors(): BelongsToMany
    {
        return $this->belongsToMany(self::class, 'product_part', 'part_id', 'product_id')
            ->withTimestamps()
            ->orderBy('name');
    }

    public function configurations(): BelongsToMany
    {
        return $this->belongsToMany(DoorConfiguration::class, 'product_door_configuration')
            ->withTimestamps()
            ->orderBy('name');
    }

    public function handings(): BelongsToMany
    {
        return $this->belongsToMany(DoorHanding::class, 'product_door_handing')
            ->withTimestamps()
            ->orderBy('name');
    }

    public function taxState(): BelongsTo
    {
        return $this->belongsTo(TaxState::class);
    }

    public function statePrices(): HasMany
    {
        return $this->hasMany(ProductStatePrice::class)
            ->orderBy('id');
    }

    public function constructions(): BelongsToMany
    {
        return $this->belongsToMany(DoorConstruction::class, 'product_door_construction')
            ->withTimestamps()
            ->orderBy('name');
    }

    public function glassType(): BelongsTo
    {
        return $this->belongsTo(WindowGlassType::class, 'window_glass_type_id');
    }

    public function glazingType(): BelongsTo
    {
        return $this->belongsTo(WindowGlazingType::class, 'window_glazing_type_id');
    }

    public function seal(): BelongsTo
    {
        return $this->belongsTo(WindowSeal::class, 'window_seal_id');
    }

    public function deleteSpecPdf(): void
    {
        if (! $this->spec_pdf_path) {
            return;
        }

        Storage::disk('public')->delete($this->spec_pdf_path);
        $this->spec_pdf_path = null;
    }

    public function syncProductModel(): void
    {
        if ($this->product_model_id) {
            $model = $this->relationLoaded('productModel')
                ? $this->productModel
                : ProductModel::query()->find($this->product_model_id);

            if ($model) {
                $this->name = $model->name;
            }

            return;
        }

        if (! filled($this->name)) {
            return;
        }

        $model = ProductModel::firstOrCreateByName((string) $this->name);
        $this->product_model_id = $model->id;
        $this->name = $model->name;
    }

    public function syncKindAndType(): void
    {
        if (! $this->product_type_id) {
            $this->product_type_id = ProductType::firstOrCreateForKind(
                in_array($this->kind, self::KINDS, true) ? $this->kind : self::KIND_PART,
            )->id;
        }

        $type = $this->relationLoaded('productType')
            ? $this->productType
            : ProductType::query()->find($this->product_type_id);

        if ($type) {
            $this->kind = $type->kind();
        }
    }

    public function isDoor(): bool
    {
        return $this->kind === self::KIND_DOOR;
    }

    public function isWindow(): bool
    {
        return $this->kind === self::KIND_WINDOW;
    }

    public function isAssembly(): bool
    {
        return $this->isDoor() || $this->isWindow();
    }

    public function isPart(): bool
    {
        return $this->kind === self::KIND_PART;
    }

    public function sellPriceForState(?string $projectState): ?float
    {
        $this->loadMissing(['statePrices.taxState']);

        $taxState = TaxState::findForProjectState($projectState);
        $matched = $taxState
            ? $this->statePrices->firstWhere('tax_state_id', $taxState->id)
            : null;

        if ($matched?->price !== null) {
            return $this->pricedAmount(
                $matched->price,
                $matched->markup_percent ?? $this->markup_percent,
            );
        }

        if ($this->price !== null) {
            return $this->pricedAmount($this->price, $this->markup_percent);
        }

        $fallback = $this->statePrices->first(
            fn (ProductStatePrice $row): bool => $row->price !== null,
        );

        if ($fallback) {
            return $this->pricedAmount(
                $fallback->price,
                $fallback->markup_percent ?? $this->markup_percent,
            );
        }

        return null;
    }

    private function pricedAmount(mixed $base, mixed $markup): float
    {
        $amount = (float) $base;

        if ($markup === null || $markup === '') {
            return round($amount, 2);
        }

        return round($amount * (1 + ((float) $markup / 100)), 2);
    }
}
