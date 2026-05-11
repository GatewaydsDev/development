<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'date_of_birth',
        'role',
        'language_id',
        'level_id',
        'password',
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
            'password' => 'hashed',
        ];
    }

    public function preferredLanguage(): BelongsTo
    {
        return $this->belongsTo(\App\Models\Language::class, 'language_id');
    }

    public function language(): BelongsTo
    {
        return $this->preferredLanguage();
    }

    public function level(): BelongsTo
    {
        return $this->belongsTo(\App\Models\UserLevel::class);
    }

    public function assignedProjects(): HasMany
    {
        return $this->hasMany(Project::class, 'assigned_to');
    }

    public function createdProjects(): HasMany
    {
        return $this->hasMany(Project::class, 'created_by');
    }

    public function hasUserLevel(string|array $levels): bool
    {
        $levels = (array) $levels;

        if (! $this->level_id) {
            return false;
        }

        return \App\Models\UserLevel::query()
            ->whereKey($this->level_id)
            ->whereIn('name', $levels)
            ->exists();
    }

    public function isSuperAdmin(): bool
    {
        return $this->hasUserLevel(\App\Models\UserLevel::SUPER_ADMIN);
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
}
