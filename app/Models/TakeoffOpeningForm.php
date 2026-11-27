<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Read-only MySQL view for adding or updating one opening.
 */
class TakeoffOpeningForm extends Model
{
    protected $table = 'takeoff_opening_form';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'counted_tag' => 'boolean',
            'is_bulk' => 'boolean',
            'thickness_uncertain' => 'boolean',
            'needs_review' => 'boolean',
            'waived_checks' => 'array',
            'template_snapshot' => 'array',
            'verified_at' => 'datetime',
            'updated_at' => 'datetime',
            'costs' => 'array',
            'markers' => 'array',
            'references' => 'array',
        ];
    }
}
