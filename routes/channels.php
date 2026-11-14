<?php

use App\Models\EmployeeWorkSchedule;
use App\Models\User;
use App\Support\JobProgressAccess;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('expenses', function ($user) {
    return $user instanceof User && $user->isSuperAdmin();
});

Broadcast::channel('job-progress.{scheduleUuid}', function (User $user, string $scheduleUuid) {
    $schedule = EmployeeWorkSchedule::query()
        ->where('uuid', $scheduleUuid)
        ->first();

    return $schedule !== null && JobProgressAccess::canView($user, $schedule);
});
