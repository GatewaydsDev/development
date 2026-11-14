<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserLoginLog extends Model
{
    public const UPDATED_AT = null;

    public const LOGIN = 'login';

    public const LOGOUT = 'logout';

    protected $fillable = [
        'user_id',
        'event',
        'guard',
        'device_type',
        'ip_address',
        'user_agent',
        'country',
        'region',
        'city',
        'latitude',
        'longitude',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'float',
            'longitude' => 'float',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
