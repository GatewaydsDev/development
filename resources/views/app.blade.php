<!DOCTYPE html>
@php($dashboardGradient = \App\Support\DashboardTheme::gradientForPage($page['component'] ?? null, auth()->user()?->dashboard_gradient))
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" data-dashboard-theme="{{ \App\Support\DashboardTheme::forPage($page['component'] ?? null, auth()->user()?->dashboard_theme) }}" data-dashboard-gradient="{{ $dashboardGradient }}" data-dashboard-surface="{{ \App\Support\DashboardTheme::surfaceForPage($page['component'] ?? null, auth()->user()?->dashboard_surface) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">

        @php($publicSeo = \App\Support\PublicSeo::forRequest(request()))
        <title inertia>{{ $publicSeo ? $publicSeo['titles']['en'].' - '.config('app.name', 'Gateway') : config('app.name', 'Gateway') }}</title>
        @if ($publicSeo)
            <meta inertia="description" name="description" content="{{ $publicSeo['descriptions']['en'] }}">
            <meta inertia="robots" name="robots" content="index, follow">
            <link inertia="canonical" rel="canonical" href="{{ $publicSeo['canonical'] }}">
            <meta inertia="og:locale" property="og:locale" content="en_US">
            <meta inertia="og:type" property="og:type" content="website">
            <meta inertia="og:site_name" property="og:site_name" content="Gateway Door Systems">
            <meta inertia="og:title" property="og:title" content="{{ $publicSeo['titles']['en'].' - '.config('app.name', 'Gateway') }}">
            <meta inertia="og:description" property="og:description" content="{{ $publicSeo['descriptions']['en'] }}">
            <meta inertia="og:url" property="og:url" content="{{ $publicSeo['canonical'] }}">
            <meta inertia="og:image" property="og:image" content="{{ $publicSeo['image'] }}">
            <meta inertia="twitter:card" name="twitter:card" content="summary_large_image">
            <meta inertia="twitter:title" name="twitter:title" content="{{ $publicSeo['titles']['en'].' - '.config('app.name', 'Gateway') }}">
            <meta inertia="twitter:description" name="twitter:description" content="{{ $publicSeo['descriptions']['en'] }}">
            <meta inertia="twitter:image" name="twitter:image" content="{{ $publicSeo['image'] }}">
            <script inertia="ldjson" type="application/ld+json">{!! $publicSeo['jsonLd'] !!}</script>
        @else
            <meta inertia="robots" name="robots" content="noindex, nofollow">
        @endif
        <link rel="icon" type="image/png" href="/images/Gateway_Door_Systems_Logo.png">

        <link rel="manifest" href="/manifest.webmanifest">
        <link rel="apple-touch-icon" href="/images/App-Logo.png">
        <meta name="theme-color" content="#047857">
        <meta name="vapid-public-key" content="{{ config('webpush.public_key') }}">

        <!-- Scripts -->
        @routes
        @viteReactRefresh
        @vite(['resources/js/app.tsx', "resources/js/Pages/{$page['component']}.tsx"])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
    </body>
</html>
