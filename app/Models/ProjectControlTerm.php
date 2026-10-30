<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class ProjectControlTerm extends Model
{
    /**
     * @var array<string, int>
     */
    public const LIMITS = [
        'award_status' => 255,
        'pricing_class' => 120,
        'bonding' => 80,
        'probability' => 40,
        'cash_flag' => 255,
        'lead_time' => 255,
        'opening_category' => 120,
        'procurement_status' => 255,
        'order_status' => 255,
    ];

    /**
     * @var array<string, array{column: string, foreign: string}>
     */
    public const JOB_FIELDS = [
        'award_status' => ['column' => 'award_status', 'foreign' => 'award_status_id'],
        'pricing_class' => ['column' => 'pricing_class', 'foreign' => 'pricing_class_id'],
        'bonding' => ['column' => 'bonding_required', 'foreign' => 'bonding_option_id'],
        'probability' => ['column' => 'probability', 'foreign' => 'probability_id'],
        'cash_flag' => ['column' => 'cash_flag', 'foreign' => 'cash_flag_id'],
        'lead_time' => ['column' => 'lead_time', 'foreign' => 'lead_time_id'],
    ];

    protected $fillable = [
        'uuid',
        'kind',
        'slug',
        'name',
    ];

    protected static function booted(): void
    {
        static::creating(function (ProjectControlTerm $term): void {
            $term->uuid ??= (string) Str::uuid();
            $term->slug ??= static::uniqueSlug($term->kind, $term->name);
        });
    }

    public static function uniqueSlug(string $kind, string $name): string
    {
        $base = Str::slug($name, '_') ?: 'value';
        $slug = $base;
        $suffix = 2;

        while (static::query()->where('kind', $kind)->where('slug', $slug)->exists()) {
            $slug = "{$base}_{$suffix}";
            $suffix++;
        }

        return $slug;
    }

    public static function findOrCreate(string $kind, string $name): ?self
    {
        $name = trim($name);
        $limit = self::LIMITS[$kind] ?? 255;

        if ($name === '' || mb_strlen($name) > $limit || ! array_key_exists($kind, self::LIMITS)) {
            return null;
        }

        $existing = static::query()
            ->where('kind', $kind)
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->first();

        if ($existing instanceof self) {
            return $existing;
        }

        return static::query()->create([
            'kind' => $kind,
            'name' => $name,
        ]);
    }
}
