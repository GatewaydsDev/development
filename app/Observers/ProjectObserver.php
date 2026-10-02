<?php

namespace App\Observers;

use App\Models\Project;
use App\Support\ProjectListVersion;
use Illuminate\Support\Facades\DB;

class ProjectObserver
{
    public function saved(Project $project): void
    {
        DB::afterCommit(fn () => ProjectListVersion::bump());
    }

    public function deleted(Project $project): void
    {
        DB::afterCommit(fn () => ProjectListVersion::bump());
    }
}
