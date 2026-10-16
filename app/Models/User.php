<?php

namespace App\Models;

use App\Models\Concerns\HasUuidRouteKey;
use App\Notifications\ResetPasswordNotification;
// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasUuidRouteKey, Notifiable;

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
        'dashboard_theme',
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
        'is_master',
        'microsoft_mailbox',
        'microsoft_tenant_id',
        'microsoft_client_id',
        'microsoft_client_secret',
        'microsoft_client_secret_id',
        'mail_signature',
        'mail_header_path',
        'mail_header_width',
        'mail_footer_colors',
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
            'is_master' => 'boolean',
            'microsoft_client_secret' => 'encrypted',
            'mail_footer_colors' => 'array',
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

    public function designatedEmployees(): HasMany
    {
        return $this->hasMany(Employee::class, 'foreman_user_id');
    }

    public function employee(): HasOne
    {
        return $this->hasOne(Employee::class);
    }

    public function emails(): HasMany
    {
        return $this->hasMany(UserEmail::class)->orderByDesc('is_primary')->orderBy('id');
    }

    public function savedMailRecipients(): HasMany
    {
        return $this->hasMany(MailSavedRecipient::class)->orderBy('name')->orderBy('email');
    }

    public function mailMessageStates(): HasMany
    {
        return $this->hasMany(MailMessageState::class);
    }

    public function mailHeaderUrl(): ?string
    {
        if (! is_string($this->mail_header_path) || $this->mail_header_path === '') {
            return null;
        }

        if (! Storage::disk('public')->exists($this->mail_header_path)) {
            return null;
        }

        return asset('storage/'.ltrim($this->mail_header_path, '/'));
    }

    public function mailHeaderWidth(): int
    {
        $width = (int) ($this->mail_header_width ?? 100);

        return $width >= 20 && $width <= 100 ? $width : 100;
    }

    /**
     * @return list<string>
     */
    public function mailFooterColors(): array
    {
        $colors = $this->mail_footer_colors;

        if (! is_array($colors)) {
            return [];
        }

        $valid = [];

        foreach ($colors as $color) {
            if (is_string($color) && preg_match('/^#[0-9A-Fa-f]{6}$/', $color) === 1) {
                $valid[] = strtolower($color);
            }
        }

        return $valid;
    }

    public function phones(): HasMany
    {
        return $this->hasMany(UserPhone::class)->orderByDesc('is_primary')->orderBy('id');
    }

    public function workSchedules(): HasMany
    {
        return $this->hasMany(EmployeeWorkSchedule::class, 'foreman_user_id');
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

    public function isMaster(): bool
    {
        return (bool) $this->is_master;
    }

    public function isSuperAdmin(): bool
    {
        if ($this->isMaster()) {
            return true;
        }

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

    public function hasMobilePermission(string $permission): bool
    {
        if ($this->isSuperAdmin()) {
            return true;
        }

        if (! $this->hasPermission($permission)) {
            return false;
        }

        return $this->level?->hasMobilePermission($permission) ?? false;
    }

    public function sendPasswordResetNotification(#[\SensitiveParameter] $token): void
    {
        $this->notify(new ResetPasswordNotification($token));
    }
}
