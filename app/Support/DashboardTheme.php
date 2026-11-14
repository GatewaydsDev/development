<?php

namespace App\Support;

class DashboardTheme
{
    public const DEFAULT = 'gateway';

    public const DEFAULT_GRADIENT = 'none';

    public const DEFAULT_SURFACE = 'default';

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
            'indigo' => [
                'name' => 'Indigo',
                'description' => 'A deep blue-purple workspace.',
                'swatches' => ['#eef2ff', '#818cf8', '#4338ca'],
            ],
            'cyan' => [
                'name' => 'Cyan',
                'description' => 'A bright blue-green workspace.',
                'swatches' => ['#ecfeff', '#22d3ee', '#0e7490'],
            ],
            'fuchsia' => [
                'name' => 'Fuchsia',
                'description' => 'A vivid magenta workspace.',
                'swatches' => ['#fdf4ff', '#e879f9', '#a21caf'],
            ],
            'lime' => [
                'name' => 'Lime',
                'description' => 'A fresh yellow-green workspace.',
                'swatches' => ['#f7fee7', '#a3e635', '#4d7c0f'],
            ],
            'crimson' => [
                'name' => 'Crimson',
                'description' => 'A strong red workspace.',
                'swatches' => ['#fef2f2', '#f87171', '#b91c1c'],
            ],
        ];
    }

    /**
     * @return array<string, array{name: string, description: string, stops: list<string>}>
     */
    public static function gradients(): array
    {
        return [
            'none' => ['name' => 'None', 'description' => 'Flat theme color, no gradient.', 'stops' => []],
            'aurora' => ['name' => 'Aurora', 'description' => 'Violet into electric blue and cyan.', 'stops' => ['#7c3aed', '#3b82f6', '#06b6d4']],
            'voice-orb' => ['name' => 'Voice Orb', 'description' => 'The glowing purple, pink and orange assistant orb.', 'stops' => ['#8b5cf6', '#ec4899', '#f97316']],
            'nebula' => ['name' => 'Nebula', 'description' => 'Deep purple drifting into magenta and coral.', 'stops' => ['#6d28d9', '#c026d3', '#fb7185']],
            'sunrise' => ['name' => 'Sunrise', 'description' => 'Warm orange fading to pink and violet.', 'stops' => ['#f97316', '#f43f5e', '#a855f7']],
            'lagoon' => ['name' => 'Lagoon', 'description' => 'Cool cyan, blue and indigo.', 'stops' => ['#06b6d4', '#3b82f6', '#6366f1']],
            'mint' => ['name' => 'Mint', 'description' => 'Fresh emerald through teal to cyan.', 'stops' => ['#10b981', '#14b8a6', '#06b6d4']],
            'citrus' => ['name' => 'Citrus', 'description' => 'Bright yellow, orange and red.', 'stops' => ['#facc15', '#f97316', '#ef4444']],
            'blossom' => ['name' => 'Blossom', 'description' => 'Soft pink, lilac and periwinkle.', 'stops' => ['#f472b6', '#c084fc', '#818cf8']],
            'midnight' => ['name' => 'Midnight', 'description' => 'Navy blue into indigo and purple.', 'stops' => ['#1e3a8a', '#4f46e5', '#9333ea']],
            'ember' => ['name' => 'Ember', 'description' => 'Glowing red, orange and amber.', 'stops' => ['#ef4444', '#f97316', '#fbbf24']],
            'forest' => ['name' => 'Forest', 'description' => 'Deep green to lime.', 'stops' => ['#166534', '#16a34a', '#a3e635']],
            'candy' => ['name' => 'Candy', 'description' => 'Playful cyan, fuchsia and yellow.', 'stops' => ['#22d3ee', '#e879f9', '#fde047']],
            'cosmic' => ['name' => 'Cosmic', 'description' => 'Night-sky indigo, purple and crimson pink.', 'stops' => ['#312e81', '#7e22ce', '#db2777']],
            'glacier' => ['name' => 'Glacier', 'description' => 'Icy sky blue, periwinkle and lavender.', 'stops' => ['#7dd3fc', '#a5b4fc', '#e9d5ff']],
            'graphite' => ['name' => 'Graphite', 'description' => 'A quiet slate gradient.', 'stops' => ['#0f172a', '#475569', '#94a3b8']],
        ];
    }

    /**
     * @return list<string>
     */
    public static function gradientKeys(): array
    {
        return array_keys(self::gradients());
    }

    public static function normalizeGradient(?string $gradient): string
    {
        return in_array($gradient, self::gradientKeys(), true) ? $gradient : self::DEFAULT_GRADIENT;
    }

    public static function gradientForPage(?string $component, ?string $gradient): string
    {
        return self::appliesToPage($component) ? self::normalizeGradient($gradient) : self::DEFAULT_GRADIENT;
    }

    /**
     * @return list<array{key: string, name: string, description: string, stops: list<string>}>
     */
    public static function gradientCatalog(): array
    {
        return collect(self::gradients())
            ->map(fn (array $gradient, string $key): array => ['key' => $key] + $gradient)
            ->values()
            ->all();
    }

    /**
     * Surface themes (dark and light). Each one pairs page surfaces with one of the accent themes.
     *
     * @return array<string, array{name: string, description: string, accent: string, tone: string, swatches: list<string>}>
     */
    public static function surfaces(): array
    {
        return [
            'midnight' => ['name' => 'Midnight Blue', 'description' => 'Deep navy surfaces with an indigo accent.', 'accent' => 'indigo', 'tone' => 'dark', 'swatches' => ['#0b1020', '#131a30', '#1c2542']],
            'obsidian' => ['name' => 'Obsidian Violet', 'description' => 'Near-black with a violet glow.', 'accent' => 'violet', 'tone' => 'dark', 'swatches' => ['#0c0a14', '#15111f', '#201a30']],
            'graphite' => ['name' => 'Graphite', 'description' => 'Neutral charcoal with a slate accent.', 'accent' => 'slate', 'tone' => 'dark', 'swatches' => ['#0f1115', '#181b21', '#23272f']],
            'deep-ocean' => ['name' => 'Deep Ocean', 'description' => 'Dark teal-blue depths with an ocean accent.', 'accent' => 'ocean', 'tone' => 'dark', 'swatches' => ['#06141c', '#0c1f2b', '#142c3b']],
            'plum' => ['name' => 'Plum Night', 'description' => 'Dark wine-purple with a fuchsia accent.', 'accent' => 'fuchsia', 'tone' => 'dark', 'swatches' => ['#140a16', '#1f1223', '#2c1a32']],
            'evergreen' => ['name' => 'Evergreen', 'description' => 'Dark forest green with the Gateway accent.', 'accent' => 'gateway', 'tone' => 'dark', 'swatches' => ['#07130f', '#0e1f19', '#162c24']],
            'espresso' => ['name' => 'Espresso', 'description' => 'Warm dark brown with an amber accent.', 'accent' => 'amber', 'tone' => 'dark', 'swatches' => ['#14100b', '#1f1913', '#2c241b']],
            'crimson-night' => ['name' => 'Crimson Night', 'description' => 'Dark maroon-black with a crimson accent.', 'accent' => 'crimson', 'tone' => 'dark', 'swatches' => ['#150a0b', '#211214', '#2e1a1d']],
            'paper' => ['name' => 'Paper', 'description' => 'Clean white with a soft gray card.', 'accent' => 'gateway', 'tone' => 'light', 'swatches' => ['#ffffff', '#f8fafc', '#e2e8f0']],
            'ivory' => ['name' => 'Ivory', 'description' => 'Warm cream surfaces with an amber accent.', 'accent' => 'amber', 'tone' => 'light', 'swatches' => ['#fbf7ee', '#fffdf7', '#efe6d2']],
            'mist' => ['name' => 'Mist', 'description' => 'Cool blue-gray with an ocean accent.', 'accent' => 'ocean', 'tone' => 'light', 'swatches' => ['#eef3f8', '#f9fbfd', '#dce6f0']],
            'blush' => ['name' => 'Blush', 'description' => 'Soft pink surfaces with a rose accent.', 'accent' => 'rose', 'tone' => 'light', 'swatches' => ['#fdf2f4', '#fffafb', '#f6dde2']],
            'sage' => ['name' => 'Sage', 'description' => 'Calm green-gray with a teal accent.', 'accent' => 'teal', 'tone' => 'light', 'swatches' => ['#eff4ef', '#fafcfa', '#dce7dc']],
            'lavender-haze' => ['name' => 'Lavender Haze', 'description' => 'Pale lilac with a violet accent.', 'accent' => 'violet', 'tone' => 'light', 'swatches' => ['#f4f1fb', '#fcfbff', '#e4ddf5']],
            'sky' => ['name' => 'Sky', 'description' => 'Airy light blue with an indigo accent.', 'accent' => 'indigo', 'tone' => 'light', 'swatches' => ['#eef4ff', '#fafcff', '#dbe6fb']],
            'sand' => ['name' => 'Sand', 'description' => 'Neutral beige with a sunset accent.', 'accent' => 'sunset', 'tone' => 'light', 'swatches' => ['#f6f1ea', '#fdfaf6', '#e8dfd2']],
            'peach' => ['name' => 'Peach', 'description' => 'Warm apricot surfaces with an orange accent.', 'accent' => 'sunset', 'tone' => 'light', 'swatches' => ['#fff1e6', '#fffaf5', '#fbdcc4']],
            'lemon' => ['name' => 'Lemon', 'description' => 'Sunny pale yellow with an amber accent.', 'accent' => 'amber', 'tone' => 'light', 'swatches' => ['#fefce8', '#fffff5', '#f8f0b8']],
            'mint-cream' => ['name' => 'Mint Cream', 'description' => 'Fresh pale green with an emerald accent.', 'accent' => 'gateway', 'tone' => 'light', 'swatches' => ['#ecfdf3', '#f7fffa', '#cdf3dc']],
            'aqua' => ['name' => 'Aqua', 'description' => 'Light turquoise with a cyan accent.', 'accent' => 'cyan', 'tone' => 'light', 'swatches' => ['#e9fbfd', '#f6feff', '#c8eef3']],
            'cotton-candy' => ['name' => 'Cotton Candy', 'description' => 'Pastel pink-lilac with a fuchsia accent.', 'accent' => 'fuchsia', 'tone' => 'light', 'swatches' => ['#fdf0fb', '#fff9fe', '#f4d6ef']],
            'lime-light' => ['name' => 'Lime Light', 'description' => 'Zesty pale lime with a lime accent.', 'accent' => 'lime', 'tone' => 'light', 'swatches' => ['#f6fde6', '#fcfff3', '#e3f2b8']],
            'cloud' => ['name' => 'Cloud', 'description' => 'Cool silvery gray with a slate accent.', 'accent' => 'slate', 'tone' => 'light', 'swatches' => ['#f1f5f9', '#fbfcfd', '#dfe5ec']],
            'coral-reef' => ['name' => 'Coral Reef', 'description' => 'Light coral with a crimson accent.', 'accent' => 'crimson', 'tone' => 'light', 'swatches' => ['#fff0ee', '#fffaf9', '#fcd5d0']],
        ];
    }

    public static function normalizeSurface(?string $surface): string
    {
        return array_key_exists((string) $surface, self::surfaces()) ? $surface : self::DEFAULT_SURFACE;
    }

    public static function surfaceForPage(?string $component, ?string $surface): string
    {
        return self::appliesToPage($component) ? self::normalizeSurface($surface) : self::DEFAULT_SURFACE;
    }

    /**
     * @return list<array{key: string, name: string, description: string, accent: string, tone: string, swatches: list<string>}>
     */
    public static function surfaceCatalog(): array
    {
        return collect(self::surfaces())
            ->map(fn (array $surface, string $key): array => ['key' => $key] + $surface)
            ->values()
            ->all();
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
