<?php

namespace App\Http\Controllers\Admin\Concerns;

use App\Models\Takeoff;
use App\Models\User;
use App\Support\TakeoffAccess;
use Illuminate\Http\Request;

trait AuthorizesTakeoffs
{
    protected function takeoffUser(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 403);

        return $user;
    }

    protected function ensureEditable(Request $request, Takeoff $takeoff): User
    {
        $user = $this->takeoffUser($request);
        abort_unless(TakeoffAccess::canUpdate($user), 403);
        abort_if($takeoff->status === 'archived', 403, 'Archived takeoffs cannot be edited.');

        return $user;
    }

    protected function clearApproval(Takeoff $takeoff, User $user): void
    {
        if ($takeoff->status !== 'approved') {
            return;
        }

        $takeoff->forceFill([
            'status' => 'in_review',
            'approved_by' => null,
            'approved_at' => null,
        ])->save();

        $takeoff->record($user, 'approval.cleared', 'Approval was cleared because the takeoff changed after review.');
    }
}
