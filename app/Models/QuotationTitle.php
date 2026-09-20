<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class QuotationTitle extends Model
{
    protected $fillable = [
        'uuid',
        'name',
    ];

    protected static function booted(): void
    {
        static::creating(function (QuotationTitle $title): void {
            $title->uuid ??= (string) Str::uuid();
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
}
