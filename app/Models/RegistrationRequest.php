<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RegistrationRequest extends Model
{
    public const PENDING = 'pending';

    public const APPROVED = 'approved';

    public const DENIED = 'denied';

    public const COMPLETED = 'completed';

    public const EXPIRED = 'expired';

    protected $fillable = [
        'name', 'email', 'status', 'role', 'level_id', 'token_hash',
        'approved_by', 'approved_at', 'expires_at', 'completed_at', 'ip_address',
    ];

    protected function casts(): array
    {
        return [
            'approved_at' => 'datetime',
            'expires_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function isExpired(): bool
    {
        return $this->status === self::EXPIRED
            || ($this->status === self::APPROVED && $this->expires_at !== null && $this->expires_at->isPast());
    }

    public function isUsable(): bool
    {
        return $this->status === self::APPROVED && ! $this->isExpired();
    }
}
