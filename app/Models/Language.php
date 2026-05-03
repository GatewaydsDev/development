<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Language extends Model
{
    protected $fillable = [
        'uuid',
        'name',
        'abbreviation',
    ];

    protected static function booted(): void
    {
        static::creating(function (Language $language): void {
            $language->uuid ??= (string) Str::uuid();
        });
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
