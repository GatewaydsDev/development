<?php

require_once __DIR__.'/../scripts/patch-php85-mysql-ssl.php';

patchPhp85MysqlSslCa(dirname(__DIR__));

use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LogUserPageAccess;
use App\Http\Middleware\PreventBackHistory;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withSchedule(function (Schedule $schedule): void {
        $schedule->command('user-activities:archive')->daily();
    })
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->trustProxies(at: '*');
        // Layout text, table cells, and imported paragraphs must round-trip exactly.
        $middleware->trimStrings(except: [
            fn (Request $request): bool => $request->exists('elements') || $request->exists('layout_elements'),
        ]);

        $middleware->web(append: [
            LogUserPageAccess::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);

        $middleware->alias([
            'prevent-back-history' => PreventBackHistory::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->respond(function (Response $response, Throwable $exception, Request $request) {
            if ($response->getStatusCode() === 419) {
                return back()->with(
                    'status',
                    'Your session expired for security. Please sign in again.'
                );
            }

            if ($response->getStatusCode() === 429 && $request->routeIs('mailbox.send')) {
                return back()->withErrors([
                    'body' => 'Too many messages were sent in a short time. Wait a minute and try again.',
                ]);
            }

            $status = $response->getStatusCode();
            $showErrorPage = in_array($status, [401, 403, 404, 419, 429, 500, 503], true)
                && ($status !== 500 || ! config('app.debug'));

            if ($showErrorPage && $request->header('X-Inertia') && ! $request->expectsJson()) {
                try {
                    return Inertia::render('Error', ['status' => $status])
                        ->toResponse($request)
                        ->setStatusCode($status);
                } catch (Throwable) {
                    return $response;
                }
            }

            return $response;
        });
    })->create();
