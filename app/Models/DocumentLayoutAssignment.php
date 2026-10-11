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
        'is_default',
    ];

    protected $casts = [
        'is_default' => 'boolean',
    ];

    public static function defaultFor(string $documentKey): ?self
    {
        return static::query()
            ->where('document_key', $documentKey)
            ->orderByDesc('is_default')
            ->orderByDesc('id')
            ->first();
    }

    public function layout(): BelongsTo
    {
        return $this->belongsTo(PrintLayout::class, 'print_layout_id');
    }
}
