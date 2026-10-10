<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\QuotationRevision;
use App\Models\QuotationRevisionStatus;
use App\Support\QuotationRevisionAssignments;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class QuotationRevisionAssignmentController extends Controller
{
    public function respond(Request $request, QuotationRevision $revision): RedirectResponse
    {
        abort_unless($revision->responsible_user_id === $request->user()->id, 403);

        $validated = $request->validate([
            'response' => ['required', Rule::in(array_keys(QuotationRevisionAssignments::RESPONSE_STATUSES))],
        ]);

        $response = $validated['response'];
        $status = QuotationRevisionStatus::firstOrCreateByName(QuotationRevisionAssignments::RESPONSE_STATUSES[$response]);

        $revision->update([
            'responsible_response' => $response,
            'responsible_responded_at' => now(),
            'status_id' => $status->id,
        ]);

        QuotationRevisionAssignments::notifyResponded($revision);

        return back()->with(
            'success',
            $response === QuotationRevisionAssignments::ACCEPTED
                ? "Revision {$revision->number} accepted."
                : "Revision {$revision->number} declined.",
        );
    }
}
