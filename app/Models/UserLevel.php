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
    ];

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
}
