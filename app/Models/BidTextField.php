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
        'source',
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
     * @param  array<string, string>  $values
     * @return array<string, string>
     */
    public static function aliasedValues(array $values): array
    {
        return static::query()
            ->orderBy('name')
            ->get(['key', 'source', 'value'])
            ->mapWithKeys(function (self $field) use ($values): array {
                $source = trim((string) $field->source);

                if ($source !== '' && isset($values[$source]) && trim((string) $values[$source]) !== '') {
                    return [$field->key => (string) $values[$source]];
                }

                $static = trim((string) $field->value);

                return $static !== '' ? [$field->key => $static] : [];
            })
            ->filter()
            ->all();
    }

    /**
     * @return array<string, string>
     */
    public static function replacementValues(): array
    {
        return static::aliasedValues([]);
    }
}
