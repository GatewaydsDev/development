<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Read-only MySQL view for adding or updating one assembly group.
 */
class TakeoffGroupForm extends Model
{
    protected $table = 'takeoff_group_form';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'manual' => 'boolean',
            'mismatch' => 'boolean',
            'updated_at' => 'datetime',
            'opening_ids' => 'array',
            'costs' => 'array',
        ];
    }
}
