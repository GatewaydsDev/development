<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class ProjectBidDate extends Model
{
    protected $fillable = [
        'uuid',
        'project_id',
        'user_id',
        'bid_date',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'bid_date' => 'date',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (ProjectBidDate $bidDate): void {
            $bidDate->uuid ??= (string) Str::uuid();
            $bidDate->user_id ??= auth()->id();
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
