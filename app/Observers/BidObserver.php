<?php

namespace App\Observers;

use App\Models\Bid;
use App\Support\BidListVersion;
use Illuminate\Support\Facades\DB;

class BidObserver
{
    public function saved(Bid $bid): void
    {
        DB::afterCommit(fn () => BidListVersion::bump());
    }

    public function deleted(Bid $bid): void
    {
        DB::afterCommit(fn () => BidListVersion::bump());
    }
}
