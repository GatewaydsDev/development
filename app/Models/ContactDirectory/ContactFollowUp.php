<?php

namespace App\Models\ContactDirectory;

use App\Models\Concerns\HasUuidRouteKey;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class ContactFollowUp extends Model
{
    use HasUuidRouteKey, SoftDeletes;

    protected $table = 'contact_directory_follow_ups';

    public const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
    public const STATUSES = ['pending', 'completed', 'cancelled'];

    protected $fillable = [
        'uuid',
        'contact_id',
        'inquiry_id',
        'title',
        'description',
        'assigned_user_id',
        'due_at',
        'reminder_at',
        'priority',
        'status',
        'completed_at',
        'completed_by',
        'created_by',
        'snoozed_reason',
        'snoozed_until',
        'reminder_last_notified_at',
    ];

    protected function casts(): array
    {
        return [
            'due_at' => 'datetime',
            'reminder_at' => 'datetime',
            'completed_at' => 'datetime',
            'snoozed_until' => 'datetime',
            'reminder_last_notified_at' => 'datetime',
        ];
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(ContactDirectoryContact::class, 'contact_id');
    }

    public function inquiry(): BelongsTo
    {
        return $this->belongsTo(ContactDirectoryInquiry::class, 'inquiry_id');
    }

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_user_id');
    }

    public function completedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'completed_by');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
