<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class DoorConfiguration extends Model
{
    protected $fillable = [
        'uuid',
        'name',
    ];

    protected static function booted(): void
    {
        static::creating(function (DoorConfiguration $configuration): void {
            $configuration->uuid ??= (string) Str::uuid();
        });
    }
}
