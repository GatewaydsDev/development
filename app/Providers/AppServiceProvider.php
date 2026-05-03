<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Gate::before(function (User $user): ?bool {
            return $user->isSuperAdmin() ? true : null;
        });

        foreach (array_keys(config('access.permissions', [])) as $permission) {
            Gate::define($permission, function (User $user) use ($permission): bool {
                return $user->hasPermission($permission);
            });
        }

        Vite::prefetch(concurrency: 3);
    }
}
