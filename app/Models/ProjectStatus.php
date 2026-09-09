<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class ProjectStatus extends Model
{
    /**
     * @var list<array{slug: string, name: string}>
     */
    public const DEFAULTS = [
        ['slug' => 'lead', 'name' => 'Lead'],
        ['slug' => 'quoted', 'name' => 'Quoted'],
        ['slug' => 'approved', 'name' => 'Approved'],
        ['slug' => 'scheduled', 'name' => 'Scheduled'],
        ['slug' => 'in_progress', 'name' => 'In Progress'],
        ['slug' => 'completed', 'name' => 'Completed'],
        ['slug' => 'cancelled', 'name' => 'Cancelled'],
    ];

    protected $fillable = [
        'uuid',
        'slug',
        'name',
    ];

    protected static function booted(): void
    {
        static::creating(function (ProjectStatus $status): void {
            $status->uuid ??= (string) Str::uuid();
            $status->slug ??= static::uniqueSlug($status->name);
        });
    }

    public function projects(): HasMany
    {
        return $this->hasMany(Project::class);
    }

    public static function idFor(string $slug): ?int
    {
        $id = static::query()->where('slug', $slug)->value('id');

        return $id !== null ? (int) $id : null;
    }

    public static function defaultId(): ?int
    {
        $id = static::idFor('lead')
            ?? static::query()->orderBy('id')->value('id');

        return $id !== null ? (int) $id : null;
    }

    public static function uniqueSlug(string $name): string
    {
        $base = Str::slug($name, '_') ?: 'status';
        $slug = $base;
        $suffix = 2;

        while (static::query()->where('slug', $slug)->exists()) {
            $slug = "{$base}_{$suffix}";
            $suffix++;
        }

        return $slug;
    }
}
