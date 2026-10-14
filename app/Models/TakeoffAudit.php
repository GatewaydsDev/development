<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TakeoffAudit extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'takeoff_id',
        'user_id',
        'action',
        'summary',
        'changes',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'changes' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function takeoff(): BelongsTo
    {
        return $this->belongsTo(Takeoff::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
