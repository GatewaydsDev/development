<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class DoorConstruction extends Model
{
    protected $fillable = [
        'uuid',
        'name',
    ];

    protected static function booted(): void
    {
        static::creating(function (DoorConstruction $construction): void {
            $construction->uuid ??= (string) Str::uuid();
        });
    }
}
