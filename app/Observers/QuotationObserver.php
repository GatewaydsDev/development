<?php

namespace App\Observers;

use App\Models\Quotation;
use App\Support\QuotationListVersion;
use Illuminate\Support\Facades\DB;

class QuotationObserver
{
    public function saved(Quotation $quotation): void
    {
        DB::afterCommit(fn () => QuotationListVersion::bump());
    }

    public function deleted(Quotation $quotation): void
    {
        DB::afterCommit(fn () => QuotationListVersion::bump());
    }
}
