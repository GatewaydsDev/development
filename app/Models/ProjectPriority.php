<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class ProjectPriority extends Model
{
    /**
     * @var list<array{slug: string, name: string}>
     */
    public const DEFAULTS = [
        ['slug' => 'low', 'name' => 'Low'],
        ['slug' => 'normal', 'name' => 'Normal'],
        ['slug' => 'high', 'name' => 'High'],
        ['slug' => 'urgent', 'name' => 'Urgent'],
    ];

    protected $fillable = [
        'uuid',
        'slug',
        'name',
    ];

    protected static function booted(): void
    {
        static::creating(function (ProjectPriority $priority): void {
            $priority->uuid ??= (string) Str::uuid();
            $priority->slug ??= static::uniqueSlug($priority->name);
        });
    }

    public static function uniqueSlug(string $name): string
    {
        $base = Str::slug($name, '_') ?: 'priority';
        $slug = $base;
        $suffix = 2;

        while (static::query()->where('slug', $slug)->exists()) {
            $slug = "{$base}_{$suffix}";
            $suffix++;
        }

        return $slug;
    }
}
