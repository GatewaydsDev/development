<?php

namespace App\Providers;

use App\Models\Company;
use App\Models\Contractor;
use App\Models\ContractorContact;
use App\Models\DocumentSetting;
use App\Models\Employee;
use App\Models\EmployeePayRate;
use App\Models\Profession;
use App\Models\Project;
use App\Models\User;
use App\Models\UserActivity;
use App\Models\UserLevel;
use App\Observers\AuditModelObserver;
use App\Services\UserActivityLogger;
use App\Support\DocumentAppearance;
use Illuminate\Auth\Events\Login;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\View;
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
        $this->registerActivityAuditing();

        Gate::before(function (User $user): ?bool {
            return $user->isSuperAdmin() ? true : null;
        });

        foreach (array_keys(config('access.permissions', [])) as $permission) {
            Gate::define($permission, function (User $user) use ($permission): bool {
                return $user->hasPermission($permission);
            });
        }

        Vite::prefetch(concurrency: 3);

        View::composer('admin.*', function ($view): void {
            $colors = $view->getData()['colors'] ?? DocumentAppearance::current()->css();
            $view->with('colors', $colors);
            $view->with('c', $colors);
        });
    }

    private function registerActivityAuditing(): void
    {
        Event::listen(Login::class, function (Login $event): void {
            if (! $event->user instanceof User) {
                return;
            }

            $user = $event->user;

            if (Schema::hasColumn('users', 'last_login_at')) {
                $user->forceFill([
                    'last_login_at' => now(),
                ])->saveQuietly();
            }

            app(UserActivityLogger::class)->log(
                user: $user,
                eventType: UserActivity::TYPE_LOGIN,
                action: 'logged in',
                description: "{$user->name} logged in.",
                request: request(),
                pageName: 'Login',
            );
        });

        foreach ([
            Company::class,
            Contractor::class,
            ContractorContact::class,
            Employee::class,
            EmployeePayRate::class,
            Profession::class,
            Project::class,
            User::class,
            UserLevel::class,
            DocumentSetting::class,
        ] as $model) {
            $model::observe(AuditModelObserver::class);
        }
    }
}
