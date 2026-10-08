<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentLayoutAssignment extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'document_key',
        'print_layout_id',
    ];

    public function layout(): BelongsTo
    {
        return $this->belongsTo(PrintLayout::class, 'print_layout_id');
    }
}
