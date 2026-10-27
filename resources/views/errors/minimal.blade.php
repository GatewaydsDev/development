@php
    $code = trim($__env->yieldContent('code'));
    $pages = [
        '401' => ['heading' => 'Sign in to continue', 'body' => 'This page is available after you sign in.'],
        '403' => ['heading' => 'You do not have access', 'body' => 'Your account cannot open this page. Ask an administrator if you need it.'],
        '404' => ['heading' => 'Page not found', 'body' => 'That address is not on this site. Check the link, or go back to the home page.'],
        '419' => ['heading' => 'Your session expired', 'body' => 'Sign in again, then repeat what you were doing.'],
        '429' => ['heading' => 'Too many requests', 'body' => 'Wait a minute, then try again.'],
        '500' => ['heading' => 'Something went wrong', 'body' => 'This page could not be completed. The problem was recorded. Try again, or return home.'],
        '503' => ['heading' => 'Temporarily unavailable', 'body' => 'Gateway is briefly unavailable. Try again in a minute.'],
    ];
    $page = $pages[$code] ?? [
        'heading' => 'Something went wrong',
        'body' => 'This page could not be opened. Go back and try again.',
    ];
    $signedIn = false;

    try {
        $signedIn = auth()->check();
    } catch (Throwable) {
        $signedIn = false;
    }

    $needsSignIn = in_array($code, ['401', '419'], true);
@endphp
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
        <title>{{ $page['heading'] }} — {{ config('app.name', 'Gateway Door Systems') }}</title>
        <link rel="icon" type="image/png" href="/images/Gateway_Door_Systems_Logo.png">
        <script>
            (function () {
                try {
                    var theme = localStorage.getItem('gateway-theme');
                    var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    var dark = theme === 'dark' || ((theme === 'system' || !theme) && systemDark);
                    document.documentElement.classList.add(dark ? 'dark' : 'light');
                } catch (error) {}
            })();
        </script>
        <style>
            :root {
                color-scheme: light;
                --bg: #f3f7f4;
                --card: rgba(255, 255, 255, 0.92);
                --text: #102018;
                --muted: #5c6f66;
                --line: #d5e4db;
                --accent: #0f9f6e;
                --accent-strong: #047857;
                --ink: #06281c;
                --grid: rgba(15, 159, 110, 0.08);
                --glow: rgba(63, 207, 142, 0.28);
            }

            html.dark {
                color-scheme: dark;
                --bg: #0c1210;
                --card: rgba(17, 26, 22, 0.92);
                --text: #e8f5ee;
                --muted: #9aafa4;
                --line: #24332c;
                --accent: #3fcf8e;
                --accent-strong: #3fcf8e;
                --ink: #06281c;
                --grid: rgba(63, 207, 142, 0.08);
                --glow: rgba(63, 207, 142, 0.16);
            }

            * { box-sizing: border-box; }

            body {
                margin: 0;
                min-height: 100vh;
                font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                background:
                    radial-gradient(circle at top, var(--glow), transparent 28rem),
                    linear-gradient(var(--grid) 1px, transparent 1px),
                    linear-gradient(90deg, var(--grid) 1px, transparent 1px),
                    var(--bg);
                background-size: auto, 56px 56px, 56px 56px, auto;
                color: var(--text);
            }

            main {
                min-height: 100vh;
                display: grid;
                place-items: center;
                padding: 24px 16px;
            }

            .card {
                width: min(100%, 34rem);
                border: 1px solid var(--line);
                border-radius: 24px;
                background: var(--card);
                box-shadow: 0 24px 60px rgba(6, 40, 28, 0.08);
                padding: 32px 28px;
                backdrop-filter: blur(10px);
            }

            .brand {
                display: inline-flex;
                border-radius: 14px;
                background: #050505;
                padding: 8px 10px;
                line-height: 0;
            }

            .brand img {
                height: 72px;
                width: auto;
                display: block;
            }

            .code {
                margin: 28px 0 0;
                font-size: clamp(4.5rem, 12vw, 6.5rem);
                line-height: 0.9;
                font-weight: 750;
                letter-spacing: -0.06em;
                color: var(--accent);
            }

            h1 {
                margin: 12px 0 0;
                font-size: 1.75rem;
                line-height: 1.2;
                letter-spacing: -0.03em;
            }

            p {
                margin: 12px 0 0;
                color: var(--muted);
                font-size: 1rem;
                line-height: 1.6;
            }

            .actions {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                margin-top: 28px;
            }

            a.button, button.button {
                display: inline-flex;
                min-height: 44px;
                align-items: center;
                justify-content: center;
                border-radius: 10px;
                padding: 0 16px;
                font: inherit;
                font-size: 0.95rem;
                font-weight: 650;
                text-decoration: none;
                cursor: pointer;
            }

            .primary {
                border: 0;
                background: #3fcf8e;
                color: var(--ink);
            }

            .primary:hover { background: #35b87d; }

            .secondary {
                border: 1px solid var(--line);
                background: transparent;
                color: var(--text);
            }

            .secondary:hover { background: rgba(63, 207, 142, 0.08); }

            a.button:focus-visible, button.button:focus-visible {
                outline: 2px solid var(--accent);
                outline-offset: 2px;
            }
        </style>
    </head>
    <body>
        <main>
            <section class="card">
                <a class="brand" href="{{ url('/') }}" aria-label="Gateway Door Systems">
                    <img src="/images/Gateway_Door_Systems_Logo.png" alt="Gateway Door Systems">
                </a>
                <p class="code">{{ $code !== '' ? $code : 'Error' }}</p>
                <h1>{{ $page['heading'] }}</h1>
                <p>{{ $page['body'] }}</p>
                <div class="actions">
                    @if ($needsSignIn)
                        <a class="button primary" href="{{ url('/login') }}">Sign in</a>
                        <a class="button secondary" href="{{ url('/') }}">Back to the site</a>
                    @elseif ($signedIn)
                        <a class="button primary" href="{{ url('/dashboard') }}">Go to the dashboard</a>
                        <a class="button secondary" href="{{ url('/') }}">Back to the site</a>
                    @else
                        <a class="button primary" href="{{ url('/') }}">Back to the site</a>
                        <a class="button secondary" href="{{ url('/login') }}">Sign in</a>
                    @endif
                    <button class="button secondary" type="button" onclick="history.back()">Go back</button>
                </div>
            </section>
        </main>
    </body>
</html>
