<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Language extends Model
{
    protected $fillable = [
        'uuid',
        'name',
        'abbreviation',
    ];

    protected static function booted(): void
    {
        static::creating(function (Language $language): void {
            $language->uuid ??= (string) Str::uuid();
        });
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function preferences(): HasMany
    {
        return $this->hasMany(EmployeeLanguagePreference::class);
    }

    public static function createFromName(string $name): self
    {
        $name = trim($name);
        $existing = static::query()
            ->whereRaw('lower(name) = ?', [Str::lower($name)])
            ->first();

        if ($existing) {
            return $existing;
        }

        return static::create([
            'name' => $name,
            'abbreviation' => static::uniqueAbbreviation($name),
        ]);
    }

    private static function uniqueAbbreviation(string $name): string
    {
        $letters = Str::lower((string) preg_replace('/[^a-zA-Z]/', '', $name));
        $base = Str::substr($letters !== '' ? $letters : 'lang', 0, 6);
        $abbreviation = $base;
        $suffix = 2;

        while (static::query()->where('abbreviation', $abbreviation)->exists()) {
            $abbreviation = Str::substr($base, 0, 5).$suffix;
            $suffix++;
        }

        return $abbreviation;
    }
}
