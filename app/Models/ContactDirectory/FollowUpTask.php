<?php

namespace App\Models\ContactDirectory;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FollowUpTask extends Model
{
    protected $table = 'contact_directory_follow_up_tasks';

    protected $fillable = ['follow_up_id', 'title', 'position'];

    public function followUp(): BelongsTo
    {
        return $this->belongsTo(ContactFollowUp::class, 'follow_up_id');
    }
}
