<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Read-only MySQL view for showing one takeoff.
 * Child lists are JSON columns.
 */
class TakeoffOverview extends Model
{
    protected $table = 'takeoff_overview';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'transaction_fee_applicable' => 'boolean',
            'approved_at' => 'datetime',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
            'documents' => 'array',
            'openings' => 'array',
            'groups' => 'array',
            'supplier_quotes' => 'array',
            'markups' => 'array',
            'sections' => 'array',
            'audits' => 'array',
            'source' => 'array',
        ];
    }
}
