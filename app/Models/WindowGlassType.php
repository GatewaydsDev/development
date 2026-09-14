<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class WindowGlassType extends Model
{
    protected $fillable = [
        'uuid',
        'name',
    ];

    protected static function booted(): void
    {
        static::creating(function (WindowGlassType $type): void {
            $type->uuid ??= (string) Str::uuid();
        });
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class, 'window_glass_type_id');
    }
}
