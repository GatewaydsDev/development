<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Str;

class Contractor extends Model
{
    protected $fillable = [
        'uuid',
        'name',
        'contact_name',
        'email',
        'phone_number',
    ];

    protected static function booted(): void
    {
        static::creating(function (Contractor $contractor): void {
            $contractor->uuid ??= (string) Str::uuid();
        });
    }

    public function projects(): BelongsToMany
    {
        return $this->belongsToMany(Project::class, 'project_contractor')
            ->withTimestamps();
    }
}
