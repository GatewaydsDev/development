<?php

namespace App\Providers;

use App\Models\User;
use App\Models\UserLevel;
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

        Gate::define('view-dashboard', function (User $user): bool {
            return $user->hasUserLevel([
                UserLevel::ADMINISTRATOR,
                UserLevel::ADMIN,
                UserLevel::PROJECT_MANAGER,
                UserLevel::USER,
            ]);
        });

        Gate::define('manage-profile', function (User $user): bool {
            return $user->hasUserLevel([
                UserLevel::ADMINISTRATOR,
                UserLevel::ADMIN,
                UserLevel::PROJECT_MANAGER,
                UserLevel::USER,
                UserLevel::VISITOR,
            ]);
        });

        Gate::define('manage-users', function (User $user): bool {
            return $user->hasUserLevel([
                UserLevel::ADMINISTRATOR,
                UserLevel::ADMIN,
            ]);
        });

        Gate::define('manage-projects', function (User $user): bool {
            return $user->hasUserLevel([
                UserLevel::ADMINISTRATOR,
                UserLevel::ADMIN,
                UserLevel::PROJECT_MANAGER,
            ]);
        });

        Vite::prefetch(concurrency: 3);
    }
}
