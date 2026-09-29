<?php

namespace App\Support;

class DashboardTheme
{
    public const DEFAULT = 'gateway';

    /**
     * @return array<string, array{name: string, description: string, swatches: list<string>}>
     */
    public static function all(): array
    {
        return [
            'gateway' => [
                'name' => 'Gateway',
                'description' => 'The standard green workspace.',
                'swatches' => ['#ecfdf5', '#34d399', '#047857'],
            ],
            'ocean' => [
                'name' => 'Ocean',
                'description' => 'A blue workspace for a cooler look.',
                'swatches' => ['#f0f9ff', '#38bdf8', '#0369a1'],
            ],
            'teal' => [
                'name' => 'Teal',
                'description' => 'A blue-green workspace.',
                'swatches' => ['#f0fdfa', '#2dd4bf', '#0f766e'],
            ],
            'violet' => [
                'name' => 'Violet',
                'description' => 'A purple workspace with a stronger accent.',
                'swatches' => ['#f5f3ff', '#a78bfa', '#6d28d9'],
            ],
            'sunset' => [
                'name' => 'Sunset',
                'description' => 'A warm orange workspace.',
                'swatches' => ['#fff7ed', '#fb923c', '#c2410c'],
            ],
            'amber' => [
                'name' => 'Amber',
                'description' => 'A golden workspace.',
                'swatches' => ['#fffbeb', '#fbbf24', '#b45309'],
            ],
            'rose' => [
                'name' => 'Rose',
                'description' => 'A rose workspace with a deep accent.',
                'swatches' => ['#fff1f2', '#fb7185', '#be123c'],
            ],
            'slate' => [
                'name' => 'Slate',
                'description' => 'A neutral gray workspace.',
                'swatches' => ['#f8fafc', '#94a3b8', '#1e293b'],
            ],
        ];
    }

    /**
     * @return list<string>
     */
    public static function keys(): array
    {
        return array_keys(self::all());
    }

    public static function normalize(?string $theme): string
    {
        return in_array($theme, self::keys(), true) ? $theme : self::DEFAULT;
    }

    public static function appliesToPage(?string $component): bool
    {
        if ($component === null || $component === '') {
            return false;
        }

        return $component === 'Dashboard'
            || str_starts_with($component, 'Admin/')
            || str_starts_with($component, 'Appearance/')
            || str_starts_with($component, 'Notifications/')
            || str_starts_with($component, 'Profile/');
    }

    public static function forPage(?string $component, ?string $theme): string
    {
        if (! self::appliesToPage($component)) {
            return self::DEFAULT;
        }

        return self::normalize($theme);
    }

    /**
     * @return list<array{key: string, name: string, description: string, swatches: list<string>}>
     */
    public static function catalog(): array
    {
        return collect(self::all())
            ->map(fn (array $theme, string $key): array => [
                'key' => $key,
                'name' => $theme['name'],
                'description' => $theme['description'],
                'swatches' => $theme['swatches'],
            ])
            ->values()
            ->all();
    }
}
