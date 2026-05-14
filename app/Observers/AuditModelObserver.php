<?php

namespace App\Observers;

use App\Models\UserActivity;
use App\Services\UserActivityLogger;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class AuditModelObserver
{
    public function created(Model $model): void
    {
        $this->log($model, UserActivity::TYPE_RECORD_CREATED, 'created');
    }

    public function updated(Model $model): void
    {
        $changes = app(UserActivityLogger::class)->changedAttributes($model);

        if ($changes === []) {
            return;
        }

        $this->log($model, UserActivity::TYPE_RECORD_UPDATED, 'updated', [
            'changes' => $changes,
        ]);
    }

    public function deleted(Model $model): void
    {
        $this->log($model, UserActivity::TYPE_RECORD_DELETED, 'deleted');
    }

    /**
     * @param  array<string, mixed>  $metadata
     */
    private function log(Model $model, string $eventType, string $verb, array $metadata = []): void
    {
        $user = Auth::user();

        if (! $user || $model instanceof UserActivity) {
            return;
        }

        $label = $this->modelLabel($model);
        $recordName = $this->recordName($model);

        app(UserActivityLogger::class)->log(
            user: $user,
            eventType: $eventType,
            action: "{$verb} {$label}",
            description: $recordName
                ? "{$user->name} {$verb} {$label} {$recordName}."
                : "{$user->name} {$verb} a {$label} record.",
            subject: $model,
            metadata: $metadata,
        );
    }

    private function modelLabel(Model $model): string
    {
        return Str::of(class_basename($model))
            ->headline()
            ->lower()
            ->toString();
    }

    private function recordName(Model $model): ?string
    {
        foreach (['name', 'full_name', 'email', 'project_number'] as $attribute) {
            $value = $model->getAttribute($attribute);

            if (filled($value)) {
                return (string) $value;
            }
        }

        return $model->getKey() ? '#'.$model->getKey() : null;
    }
}
