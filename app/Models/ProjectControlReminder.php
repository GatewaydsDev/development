<?php

namespace App\Models;

use App\Models\Concerns\HasUuidRouteKey;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectControlReminder extends Model
{
    use HasUuidRouteKey;

    protected $fillable = [
        'uuid',
        'project_control_id',
        'user_id',
        'created_by',
        'remind_at',
        'note',
        'notify_popup',
        'notify_email',
        'recipient_email',
        'popup_sent_at',
        'email_sent_at',
        'email_attempts',
        'email_error',
        'dismissed_at',
    ];

    protected function casts(): array
    {
        return [
            'remind_at' => 'datetime',
            'notify_popup' => 'boolean',
            'notify_email' => 'boolean',
            'popup_sent_at' => 'datetime',
            'email_sent_at' => 'datetime',
            'dismissed_at' => 'datetime',
            'email_attempts' => 'integer',
        ];
    }

    public function control(): BelongsTo
    {
        return $this->belongsTo(ProjectControl::class, 'project_control_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
