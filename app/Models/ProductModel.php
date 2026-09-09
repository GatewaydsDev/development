<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Str;

class ProductModel extends Model
{
    protected $fillable = [
        'uuid',
        'name',
    ];

    protected static function booted(): void
    {
        static::creating(function (ProductModel $model): void {
            $model->uuid ??= (string) Str::uuid();
        });
    }

    public function product(): HasOne
    {
        return $this->hasOne(Product::class);
    }

    public static function firstOrCreateByName(string $name): self
    {
        $name = trim($name);
        $existing = static::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->first();

        return $existing ?? static::create(['name' => $name]);
    }
}
