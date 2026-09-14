<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class ProjectScopeType extends Model
{
    /**
     * @var list<array{slug: string, name: string}>
     */
    public const DEFAULTS = [
        ['slug' => 'radio_frequency_doors', 'name' => 'Radio frequency doors'],
        ['slug' => 'sound_transmission', 'name' => 'Sound transmission'],
        ['slug' => 'bullet', 'name' => 'Bullet'],
        ['slug' => 'blast', 'name' => 'Blast'],
        ['slug' => 'oversized_assemblies', 'name' => 'Oversized assemblies'],
        ['slug' => 'hurricane_and_tornado', 'name' => 'Hurricane and tornado'],
        ['slug' => 'forced_entry_doors', 'name' => 'Forced entry doors'],
        ['slug' => 'other', 'name' => 'Other'],
    ];

    protected $fillable = [
        'uuid',
        'slug',
        'name',
    ];

    protected static function booted(): void
    {
        static::creating(function (ProjectScopeType $type): void {
            $type->uuid ??= (string) Str::uuid();
            $type->slug ??= static::uniqueSlug($type->name);
        });
    }

    public static function uniqueSlug(string $name): string
    {
        $base = Str::slug($name, '_') ?: 'scope';
        $slug = $base;
        $suffix = 2;

        while (static::query()->where('slug', $slug)->exists()) {
            $slug = "{$base}_{$suffix}";
            $suffix++;
        }

        return $slug;
    }

    public static function firstOrCreateByName(string $name): self
    {
        $name = trim($name);
        $existing = static::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->first();

        return $existing ?? static::query()->create(['name' => $name]);
    }
}
