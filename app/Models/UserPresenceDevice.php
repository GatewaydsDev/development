<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Last activity of a user on one kind of device (website, mobile, tablet), so a person signed in
 * on several devices at once shows up on each of them.
 */
class UserPresenceDevice extends Model
{
    protected $fillable = ['user_id', 'device', 'last_seen_at', 'logged_out_at'];

    protected function casts(): array
    {
        return [
            'last_seen_at' => 'datetime',
            'logged_out_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function touchFor(User $user, string $device): void
    {
        $row = static::query()->firstOrNew(['user_id' => $user->id, 'device' => $device]);

        if ($row->exists && $row->last_seen_at !== null && $row->last_seen_at->diffInSeconds(now()) < 30 && ! $row->logged_out_at?->greaterThanOrEqualTo($row->last_seen_at)) {
            return;
        }

        $row->forceFill(['last_seen_at' => now()])->save();
    }

    public static function markLoggedOut(User $user, string $device): void
    {
        static::query()->where('user_id', $user->id)->where('device', $device)->update(['logged_out_at' => now()]);
    }
}
