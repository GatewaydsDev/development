<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InternalChatGroup extends Model
{
    protected $fillable = ['name', 'created_by'];

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'internal_chat_group_members')
            ->withPivot('last_read_message_id')
            ->withTimestamps();
    }

    public function messages(): HasMany
    {
        return $this->hasMany(InternalMessage::class, 'group_id');
    }
}
