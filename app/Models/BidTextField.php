<?php

namespace App\Models;

use App\Support\BidApplicationText;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class BidTextField extends Model
{
    protected $fillable = [
        'uuid',
        'key',
        'name',
        'value',
    ];

    protected static function booted(): void
    {
        static::creating(function (BidTextField $field): void {
            $field->uuid ??= (string) Str::uuid();
            $field->key ??= static::keyFromName((string) $field->name);
        });
    }

    public static function keyFromName(string $name): string
    {
        return Str::slug($name, '_') ?: '';
    }

    public static function isReservedKey(string $key): bool
    {
        return array_key_exists($key, BidApplicationText::PLACEHOLDERS);
    }

    /**
     * @return array<string, string>
     */
    public static function replacementValues(): array
    {
        return static::query()
            ->orderBy('name')
            ->get(['key', 'value'])
            ->filter(fn (self $field): bool => trim((string) $field->value) !== '')
            ->mapWithKeys(fn (self $field): array => [
                $field->key => (string) $field->value,
            ])
            ->all();
    }
}
