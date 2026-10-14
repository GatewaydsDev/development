<?php

namespace App\Models;

use App\Models\Concerns\HasUuidRouteKey;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class TakeoffAssemblyTemplate extends Model
{
    use HasUuidRouteKey;

    protected $fillable = [
        'uuid',
        'name',
        'opening_type',
        'product_category',
        'frame_type',
        'handing',
        'hardware_set',
        'glazing',
        'finish',
        'manufacturer',
        'product_model',
        'product_id',
        'components',
        'default_costs',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'components' => 'array',
            'default_costs' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (TakeoffAssemblyTemplate $template): void {
            $template->uuid ??= (string) Str::uuid();
        });
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function snapshot(): array
    {
        return [
            'name' => $this->name,
            'opening_type' => $this->opening_type,
            'product_category' => $this->product_category,
            'frame_type' => $this->frame_type,
            'handing' => $this->handing,
            'hardware_set' => $this->hardware_set,
            'glazing' => $this->glazing,
            'finish' => $this->finish,
            'manufacturer' => $this->manufacturer,
            'product_model' => $this->product_model,
            'product_id' => $this->product_id,
            'components' => $this->components,
            'default_costs' => $this->default_costs,
        ];
    }
}
