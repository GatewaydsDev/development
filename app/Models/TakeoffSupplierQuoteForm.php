<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Read-only MySQL view for adding or updating one supplier quote.
 */
class TakeoffSupplierQuoteForm extends Model
{
    protected $table = 'takeoff_supplier_quote_form';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'quote_date' => 'date',
            'expires_at' => 'date',
            'accepted_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }
}
