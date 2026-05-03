<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class UserLevel extends Model
{
    public const SUPER_ADMIN = 'Super Admin';

    public const ADMINISTRATOR = 'Administrator';

    public const ADMIN = 'Admin';

    public const PROJECT_MANAGER = 'Project Manager';

    public const USER = 'User';

    public const VISITOR = 'Visitor';

    protected $fillable = [
        'uuid',
        'name',
        'permissions',
    ];

    protected function casts(): array
    {
        return [
            'permissions' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (UserLevel $userLevel): void {
            $userLevel->uuid ??= (string) Str::uuid();
        });
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'level_id');
    }

    public function hasPermission(string $permission): bool
    {
        if ($this->name === self::SUPER_ADMIN) {
            return true;
        }

        if (is_array($this->permissions) && array_key_exists($permission, $this->permissions)) {
            return (bool) $this->permissions[$permission];
        }

        if (
            in_array($permission, ['view-users', 'create-users', 'update-users'], true)
            && is_array($this->permissions)
            && array_key_exists('manage-users', $this->permissions)
        ) {
            return (bool) $this->permissions['manage-users'];
        }

        return in_array($permission, config("access.defaults.{$this->name}", []), true);
    }

    /**
     * @return array<string, bool>
     */
    public function defaultPermissions(): array
    {
        $defaults = config("access.defaults.{$this->name}", []);

        return collect(config('access.permissions', []))
            ->keys()
            ->mapWithKeys(fn (string $permission): array => [
                $permission => in_array($permission, $defaults, true),
            ])
            ->all();
    }
}
