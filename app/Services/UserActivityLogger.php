<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserActivity;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class UserActivityLogger
{
    /**
     * @param  array<string, mixed>  $metadata
     */
    public function log(
        User $user,
        string $eventType,
        string $action,
        ?string $description = null,
        ?Request $request = null,
        ?Model $subject = null,
        array $metadata = [],
        ?string $pageName = null,
    ): ?UserActivity {
        $request ??= request();

        if (! Schema::hasTable('user_activities')) {
            return null;
        }

        return UserActivity::create([
            'user_id' => $user->id,
            'event_type' => $eventType,
            'action' => $action,
            'page_name' => $pageName ?? $this->pageName($request),
            'description' => $description,
            'subject_type' => $subject ? $subject::class : null,
            'subject_id' => $subject?->getKey(),
            'route_name' => $request->route()?->getName(),
            'method' => $request->method(),
            'path' => $request->path(),
            'url' => Str::limit($request->fullUrl(), 2048, ''),
            'ip_address' => $request->ip(),
            'user_agent' => Str::limit((string) $request->userAgent(), 1000, ''),
            'metadata' => $metadata === [] ? null : $metadata,
            'occurred_at' => now(),
        ]);
    }

    public function pageName(Request $request): ?string
    {
        $routeName = $request->route()?->getName();

        if (! $routeName) {
            return null;
        }

        $customNames = [
            'home' => 'Home',
            'dashboard' => 'Dashboard',
            'profile.edit' => 'Profile',
            'admin.company.show' => 'Company profile',
            'admin.account.edit' => 'Account settings',
            'admin.access-control.edit' => 'Access control',
            'admin.user-activities.index' => 'User activity audit',
        ];

        if (isset($customNames[$routeName])) {
            return $customNames[$routeName];
        }

        return Str::of($routeName)
            ->replace('admin.', '')
            ->replace('.', ' ')
            ->replace('-', ' ')
            ->title()
            ->toString();
    }

    /**
     * @return array<string, mixed>
     */
    public function changedAttributes(Model $model): array
    {
        return collect($model->getChanges())
            ->except(['updated_at', 'created_at', 'remember_token', 'password'])
            ->map(fn (mixed $value, string $key): array => [
                'from' => Arr::get($model->getOriginal(), $key),
                'to' => $value,
            ])
            ->all();
    }
}
