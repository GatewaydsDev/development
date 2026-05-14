<?php

namespace App\Http\Middleware;

use App\Models\UserActivity;
use App\Services\UserActivityLogger;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class LogUserPageAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        return $next($request);
    }

    public function terminate(Request $request, Response $response): void
    {
        $user = $request->user();

        if (
            ! $user
            || ! $request->isMethod('GET')
            || $response->getStatusCode() >= 400
            || $this->isPartialInertiaReload($request)
        ) {
            return;
        }

        $pageName = app(UserActivityLogger::class)->pageName($request);

        app(UserActivityLogger::class)->log(
            user: $user,
            eventType: UserActivity::TYPE_PAGE_VIEW,
            action: 'viewed page',
            description: $pageName
                ? "{$user->name} viewed {$pageName}."
                : "{$user->name} viewed {$request->path()}.",
            request: $request,
            pageName: $pageName,
        );
    }

    private function isPartialInertiaReload(Request $request): bool
    {
        return $request->headers->has('X-Inertia-Partial-Data');
    }
}
