<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class ProjectScope extends Model
{
    protected $fillable = [
        'uuid',
        'project_id',
        'scope_type',
        'notes',
    ];

    protected static function booted(): void
    {
        static::creating(function (ProjectScope $scope): void {
            $scope->uuid ??= (string) Str::uuid();
        });
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
