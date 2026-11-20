<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class ProjectAddendum extends Model
{
    protected $fillable = [
        'uuid',
        'project_id',
        'user_id',
        'number',
        'issued_on',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'issued_on' => 'date',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (ProjectAddendum $addendum): void {
            $addendum->uuid ??= (string) Str::uuid();
            $addendum->user_id ??= auth()->id();
        });
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
