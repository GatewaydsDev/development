<?php

namespace App\Models;

use App\Models\Concerns\HasUuidRouteKey;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class TakeoffDocument extends Model
{
    use HasUuidRouteKey;

    protected $fillable = [
        'uuid',
        'takeoff_id',
        'original_filename',
        'storage_path',
        'mime',
        'size',
        'document_type',
        'revision_label',
        'sheet_number',
        'sheet_title',
        'page_count',
        'uploaded_by',
    ];

    protected static function booted(): void
    {
        static::creating(function (TakeoffDocument $document): void {
            $document->uuid ??= (string) Str::uuid();
        });

        static::deleting(function (TakeoffDocument $document): void {
            if ($document->storage_path) {
                Storage::disk(config('takeoffs.disk'))->delete($document->storage_path);
            }
        });
    }

    public function takeoff(): BelongsTo
    {
        return $this->belongsTo(Takeoff::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
