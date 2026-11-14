<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SystemUpdate;
use App\Models\User;
use App\Models\UserLevel;
use App\Support\SystemUpdateAccess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class SystemUpdateController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $this->viewer($request);
        $canManage = SystemUpdateAccess::canManage($user);

        $updates = SystemUpdate::query()
            ->recent()
            ->visibleTo($user)
            ->with('levels:id,name')
            ->orderByDesc('released_on')
            ->orderByDesc('id')
            ->get()
            ->map(fn (SystemUpdate $update): array => $this->payload($update, $canManage))
            ->values();

        SystemUpdate::markAllReadFor($user);

        return Inertia::render('Admin/SystemUpdates/Index', [
            'updates' => $updates,
            'levels' => $canManage
                ? UserLevel::query()->orderBy('name')->get(['id', 'name'])
                    ->reject(fn (UserLevel $level): bool => in_array($level->name, UserLevel::SUPER_ADMIN_ALIASES, true))
                    ->values()
                : [],
            'categories' => SystemUpdate::CATEGORIES,
            'windowDays' => SystemUpdate::WINDOW_DAYS,
            'canManage' => $canManage,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->manager($request);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:160'],
            'summary' => ['nullable', 'string', 'max:500'],
            'category' => ['required', Rule::in(SystemUpdate::CATEGORIES)],
            'released_on' => ['required', 'date'],
            'details' => ['nullable', 'array', 'max:30'],
            'details.*' => ['nullable', 'string', 'max:300'],
        ]);

        SystemUpdate::query()->create([
            'title' => $data['title'],
            'summary' => $data['summary'] ?? null,
            'category' => $data['category'],
            'released_on' => $data['released_on'],
            'details' => array_values(array_filter(array_map('trim', $data['details'] ?? []))),
            'commits' => [],
            'created_by' => $request->user()->id,
        ]);

        return back()->with('success', 'Update added.');
    }

    public function destroy(Request $request, SystemUpdate $systemUpdate): RedirectResponse
    {
        $this->manager($request);
        $systemUpdate->levels()->detach();
        $systemUpdate->delete();

        return back()->with('success', 'Update deleted.');
    }

    /**
     * Adds the chosen levels to one or more updates, or with mode "set" makes them the exact audience.
     */
    public function share(Request $request): RedirectResponse
    {
        $this->manager($request);
        $data = $request->validate([
            'update_uuids' => ['required', 'array', 'min:1'],
            'update_uuids.*' => ['string', Rule::exists('system_updates', 'uuid')],
            'level_ids' => ['present', 'array'],
            'level_ids.*' => ['integer', Rule::exists('user_levels', 'id')],
            'mode' => ['sometimes', Rule::in(['add', 'set'])],
            'confirmed' => ['accepted'],
        ]);

        $levelIds = UserLevel::query()
            ->whereIn('id', $data['level_ids'])
            ->get()
            ->reject(fn (UserLevel $level): bool => in_array($level->name, UserLevel::SUPER_ADMIN_ALIASES, true))
            ->pluck('id')
            ->all();
        $exact = ($data['mode'] ?? 'add') === 'set';

        SystemUpdate::query()->whereIn('uuid', $data['update_uuids'])->get()
            ->each(fn (SystemUpdate $update) => $exact
                ? $update->levels()->sync($levelIds)
                : $update->levels()->syncWithoutDetaching($levelIds));

        return back()->with('success', 'Sharing updated. Those user levels can now see the selected updates.');
    }

    private function viewer(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User && SystemUpdateAccess::canView($user), 403);

        return $user;
    }

    private function manager(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User && SystemUpdateAccess::canManage($user), 403);

        return $user;
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(SystemUpdate $update, bool $canManage): array
    {
        return [
            'uuid' => $update->uuid,
            'title' => $update->title,
            'summary' => $update->summary,
            'category' => $update->category,
            'released_on' => $update->released_on?->toDateString(),
            'released_label' => $update->released_on?->format('M j, Y'),
            'details' => $update->details ?? [],
            'commits' => $canManage ? ($update->commits ?? []) : [],
            'levels' => $canManage ? $update->levels->map(fn (UserLevel $level): array => ['id' => $level->id, 'name' => $level->name])->values() : [],
        ];
    }
}
