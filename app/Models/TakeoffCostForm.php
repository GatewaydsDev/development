<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Read-only MySQL view for adding or updating one cost line.
 */
class TakeoffCostForm extends Model
{
    protected $table = 'takeoff_cost_form';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'from_template' => 'boolean',
            'updated_at' => 'datetime',
        ];
    }
}
