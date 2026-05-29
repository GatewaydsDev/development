<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContactEmailLog extends Model
{
    protected $fillable = [
        'contact_submission_id',
        'contact_id',
        'sent_by_id',
        'recipient_name',
        'recipient_email',
        'subject',
        'message',
    ];

    public function submission(): BelongsTo
    {
        return $this->belongsTo(ContactSubmission::class, 'contact_submission_id');
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function sentBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by_id');
    }
}
