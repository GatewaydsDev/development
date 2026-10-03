<?php

namespace App\Observers;

use App\Models\Skill;
use App\Support\SkillListVersion;
use Illuminate\Support\Facades\DB;

class SkillObserver
{
    public function saved(Skill $skill): void
    {
        DB::afterCommit(fn () => SkillListVersion::bump());
    }

    public function deleted(Skill $skill): void
    {
        DB::afterCommit(fn () => SkillListVersion::bump());
    }
}
