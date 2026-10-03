<?php

namespace App\Observers;

use App\Models\Employee;
use App\Support\EmployeeListVersion;
use Illuminate\Support\Facades\DB;

class EmployeeObserver
{
    public function saved(Employee $employee): void
    {
        DB::afterCommit(fn () => EmployeeListVersion::bump());
    }

    public function deleted(Employee $employee): void
    {
        DB::afterCommit(fn () => EmployeeListVersion::bump());
    }
}
