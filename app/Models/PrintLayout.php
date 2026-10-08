<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PrintLayout extends Model
{
    protected $fillable = [
        'name',
        'design',
        'created_by',
        'header_background_color',
        'table_header_background_color',
        'text_case',
    ];

    protected $casts = [
        'design' => 'array',
    ];

    public function assignments(): HasMany
    {
        return $this->hasMany(DocumentLayoutAssignment::class);
    }
}
