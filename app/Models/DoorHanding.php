<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class DoorHanding extends Model
{
    protected $fillable = [
        'uuid',
        'name',
    ];

    protected static function booted(): void
    {
        static::creating(function (DoorHanding $handing): void {
            $handing->uuid ??= (string) Str::uuid();
        });
    }
}
