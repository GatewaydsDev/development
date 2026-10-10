<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class QuotationRevisionStatus extends Model
{
    protected $table = 'quotation_revision_statuses';

    protected $fillable = [
        'uuid',
        'name',
    ];

    protected static function booted(): void
    {
        static::creating(function (QuotationRevisionStatus $item): void {
            $item->uuid ??= (string) Str::uuid();
        });
    }

    public static function firstOrCreateByName(string $name): self
    {
        $name = trim($name);
        $existing = static::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->first();

        return $existing ?? static::query()->create(['name' => $name]);
    }

    /**
     * @return array<int, array{id: int, name: string}>
     */
    public static function options(): array
    {
        return static::query()
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (self $item): array => ['id' => $item->id, 'name' => $item->name])
            ->values()
            ->all();
    }
}
