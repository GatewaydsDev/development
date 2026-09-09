<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Manufacturer extends Model
{
    protected $fillable = [
        'uuid',
        'name',
    ];

    protected static function booted(): void
    {
        static::creating(function (Manufacturer $manufacturer): void {
            $manufacturer->uuid ??= (string) Str::uuid();
        });
    }
}
