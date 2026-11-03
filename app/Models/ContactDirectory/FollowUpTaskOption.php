<?php

namespace App\Models\ContactDirectory;

use Illuminate\Database\Eloquent\Model;

class FollowUpTaskOption extends Model
{
    protected $table = 'contact_task_options';

    protected $fillable = ['name'];
}
