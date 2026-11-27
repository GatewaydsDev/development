<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Read-only MySQL view for adding or updating an assembly template.
 */
class TakeoffTemplateForm extends Model
{
    protected $table = 'takeoff_template_form';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'components' => 'array',
            'default_costs' => 'array',
            'updated_at' => 'datetime',
        ];
    }
}
