<?php

namespace App\Models;

use App\Notifications\ResetPasswordNotification;
// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'avatar',
        'signature_path',
        'date_of_birth',
        'last_login_at',
        'role',
        'language_id',
        'level_id',
        'password',
    ];

    /**
     * The accessors to append to the model's array form.
     *
     * @var list<string>
     */
    protected $appends = [
        'avatar_url',
        'signature_url',
        'initials',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function getAvatarUrlAttribute(): ?string
    {
        if (! $this->avatar) {
            return null;
        }

        if (Str::startsWith($this->avatar, ['http://', 'https://'])) {
            return $this->avatar;
        }

        return asset('storage/'.ltrim($this->avatar, '/'));
    }

    public function getSignatureUrlAttribute(): ?string
    {
        if (! $this->signature_path) {
            return null;
        }

        if (Str::startsWith($this->signature_path, ['http://', 'https://'])) {
            return $this->signature_path;
        }

        return asset('storage/'.ltrim($this->signature_path, '/'));
    }

    public function signatureAbsolutePath(): ?string
    {
        if (! $this->signature_path) {
            return null;
        }

        $disk = Storage::disk('public');

        if (! $disk->exists($this->signature_path)) {
            return null;
        }

        return $disk->path($this->signature_path);
    }

    public function getInitialsAttribute(): string
    {
        $words = preg_split('/\s+/', trim((string) $this->name)) ?: [];
        $words = array_values(array_filter($words));

        if ($words === []) {
            return '?';
        }

        $first = Str::substr($words[0], 0, 1);
        $second = count($words) > 1 ? Str::substr($words[count($words) - 1], 0, 1) : '';

        return Str::upper($first.$second);
    }

    public function preferredLanguage(): BelongsTo
    {
        return $this->belongsTo(Language::class, 'language_id');
    }

    public function level(): BelongsTo
    {
        return $this->belongsTo(UserLevel::class);
    }

    public function hasUserLevel(string|array $levels): bool
    {
        $levels = (array) $levels;

        if (! $this->level_id) {
            return false;
        }

        return UserLevel::query()
            ->whereKey($this->level_id)
            ->whereIn('name', $levels)
            ->exists();
    }

    public function isSuperAdmin(): bool
    {
        if (strtolower((string) $this->role) === 'super_admin') {
            return true;
        }

        return $this->hasUserLevel(UserLevel::SUPER_ADMIN_ALIASES);
    }

    public function canManageOwnAccount(): bool
    {
        return ! $this->isSuperAdmin();
    }

    public function hasPermission(string $permission): bool
    {
        if ($this->isSuperAdmin()) {
            return true;
        }

        if (in_array($permission, ['view-users', 'create-users', 'update-users', 'manage-access'], true)) {
            return false;
        }

        return $this->level?->hasPermission($permission) ?? false;
    }

    public function sendPasswordResetNotification(#[\SensitiveParameter] $token): void
    {
        $this->notify(new ResetPasswordNotification($token));
    }
}
