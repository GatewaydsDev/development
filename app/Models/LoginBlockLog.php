<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoginBlockLog extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'blocked_at' => 'datetime',
            'released_at' => 'datetime',
        ];
    }
}
