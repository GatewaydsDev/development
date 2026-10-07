<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Admin\EmployeeWorkScheduleController as AdminEmployeeWorkScheduleController;
use App\Http\Controllers\Controller;
use App\Models\Contractor;
use App\Models\ContractorContact;
use App\Models\Project;
use App\Models\User;
use App\Models\WorkScheduleListing;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ForemanScheduleController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user instanceof User && EmployeeAccess::isForeman($user), 404);

        $today = now()->toDateString();
        $until = now()->addDays(13)->toDateString();

        $listings = WorkScheduleListing::query()
            ->where('foreman_user_id', $user->id)
            ->whereDate('starts_on', '<=', $until)
            ->whereDate('ends_on', '>=', $today)
            ->orderBy('starts_on')
            ->orderBy('id')
            ->get();

        $projects = Project::query()
            ->with('contractors.contacts')
            ->whereIn('id', $listings->pluck('project_id')->filter()->all())
            ->get()
            ->keyBy('id');

        return response()->json([
            'date' => $today,
            'schedules' => $listings
                ->map(function (WorkScheduleListing $listing) use ($projects): array {
                    $payload = app(AdminEmployeeWorkScheduleController::class)->listingPayload($listing);
                    $project = $projects->get($listing->project_id);

                    if (is_array($payload['project']) && $project instanceof Project) {
                        $payload['project']['contact'] = $this->mainContact($project);
                    }

                    return $payload;
                })
                ->values()
                ->all(),
        ]);
    }

    /**
     * @return array{company: string, name: ?string, title: ?string, email: ?string, phone_number: ?string}|null
     */
    private function mainContact(Project $project): ?array
    {
        $contractors = $project->contractors;

        if ($contractors->isEmpty()) {
            return null;
        }

        $contractor = $contractors->first(
            fn (Contractor $contractor): bool => $contractor->role === Contractor::ROLE_CONTRACTOR
                && $contractor->primaryContact() instanceof ContractorContact,
        ) ?? $contractors->first(
            fn (Contractor $contractor): bool => $contractor->primaryContact() instanceof ContractorContact,
        ) ?? $contractors->first();

        if (! $contractor instanceof Contractor) {
            return null;
        }

        $contact = $contractor->primaryContact();

        return [
            'company' => $contractor->name,
            'name' => $contact?->name,
            'title' => $contact?->title,
            'email' => $contact?->email,
            'phone_number' => $contact?->phone_number,
        ];
    }
}
