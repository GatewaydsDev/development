<?php

namespace App\Models;

use App\Models\Concerns\HasUuidRouteKey;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class DailyTaskPhoto extends Model
{
    use HasUuidRouteKey;

    protected $fillable = [
        'daily_task_completion_id',
        'path',
        'original_name',
        'mime_type',
        'size',
        'caption',
        'taken_at',
    ];

    protected function casts(): array
    {
        return ['taken_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::deleting(function (DailyTaskPhoto $photo): void {
            Storage::disk('local')->delete($photo->path);
        });
    }

    public function completion(): BelongsTo
    {
        return $this->belongsTo(DailyTaskCompletion::class, 'daily_task_completion_id');
    }
}
