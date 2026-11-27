<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Read-only MySQL view for the takeoff add/update form.
 */
class TakeoffForm extends Model
{
    protected $table = 'takeoff_form';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'transaction_fee_applicable' => 'boolean',
            'updated_at' => 'datetime',
            'openings' => 'array',
            'groups' => 'array',
        ];
    }
}
