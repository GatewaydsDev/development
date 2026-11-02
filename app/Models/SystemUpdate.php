<?php

namespace App\Models;

use App\Models\Concerns\HasUuidRouteKey;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Facades\DB;
use App\Support\SystemUpdateAccess;

class SystemUpdate extends Model
{
    use HasUuidRouteKey;

    public const WINDOW_DAYS = 30;

    public const CATEGORIES = ['Feature', 'Improvement', 'Fix', 'Field'];

    protected $fillable = [
        'title',
        'summary',
        'category',
        'released_on',
        'details',
        'commits',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'released_on' => 'date',
            'details' => 'array',
            'commits' => 'array',
        ];
    }

    public function levels(): BelongsToMany
    {
        return $this->belongsToMany(UserLevel::class, 'system_update_levels')->withTimestamps();
    }

    public function scopeRecent(Builder $query): Builder
    {
        return $query->whereDate('released_on', '>=', now()->subDays(self::WINDOW_DAYS)->toDateString());
    }

    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $user->isSuperAdmin()
            ? $query
            : $query->whereHas('levels', fn (Builder $levels) => $levels->whereKey($user->level_id));
    }

    public function scopeUnreadBy(Builder $query, User $user): Builder
    {
        return $query->whereNotIn('id', fn ($reads) => $reads
            ->select('system_update_id')
            ->from('system_update_reads')
            ->where('user_id', $user->id));
    }

    public static function unreadCountFor(User $user): int
    {
        if (! SystemUpdateAccess::canView($user)) {
            return 0;
        }

        return static::query()->recent()->visibleTo($user)->unreadBy($user)->count();
    }

    public static function markAllReadFor(User $user): void
    {
        $ids = static::query()->recent()->visibleTo($user)->unreadBy($user)->pluck('id');

        if ($ids->isEmpty()) {
            return;
        }

        DB::table('system_update_reads')->insertOrIgnore(
            $ids->map(fn ($id): array => [
                'user_id' => $user->id,
                'system_update_id' => $id,
                'read_at' => now(),
            ])->all(),
        );
    }
}
