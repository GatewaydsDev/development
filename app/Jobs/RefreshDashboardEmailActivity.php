<?php

namespace App\Jobs;

use App\Models\User;
use App\Support\DashboardEmailActivity;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class RefreshDashboardEmailActivity implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 15;

    public bool $failOnTimeout = true;

    public int $uniqueFor = 30;

    public function __construct(
        public readonly int $userId,
        public readonly int $range,
    ) {}

    public function handle(): void
    {
        $user = User::find($this->userId);

        if (! $user instanceof User) {
            return;
        }

        DashboardEmailActivity::refresh($user, $this->range);
    }

    public function uniqueId(): string
    {
        return $this->userId.':'.$this->range;
    }
}
