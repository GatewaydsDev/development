<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AppSetting extends Model
{
    protected $fillable = ['key', 'value'];

    public static function read(string $key): ?string
    {
        return static::query()->where('key', $key)->value('value');
    }

    public static function write(string $key, ?string $value): void
    {
        if ($value === null || $value === '') {
            static::query()->where('key', $key)->delete();

            return;
        }

        static::query()->updateOrCreate(['key' => $key], ['value' => $value]);
    }
}
