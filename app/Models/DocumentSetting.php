<?php

namespace App\Models;

use App\Support\DocumentAppearance;
use Illuminate\Database\Eloquent\Model;

class DocumentSetting extends Model
{
    protected $fillable = [
        'document_key',
        'header_background_color',
        'table_header_background_color',
    ];

    public static function current(): self
    {
        return static::forKey(DocumentAppearance::key('bid', 'print'));
    }

    public static function forKey(string $key): self
    {
        $settings = static::query()->where('document_key', $key)->first();

        if ($settings) {
            return $settings;
        }

        $fallback = static::query()->first();

        return static::query()->create([
            'document_key' => $key,
            'header_background_color' => $fallback?->header_background_color ?? DocumentAppearance::DEFAULT_HEADER_BACKGROUND,
            'table_header_background_color' => $fallback?->table_header_background_color ?? DocumentAppearance::DEFAULT_TABLE_HEADER_BACKGROUND,
        ]);
    }
}
