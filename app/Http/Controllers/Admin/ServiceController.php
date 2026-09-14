<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Service;
use App\Support\BidAccess;
use App\Support\ServiceAccess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ServiceController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless(ServiceAccess::canView($request->user()), 403);

        $search = (string) $request->query('search', '');
        $highlight = (int) $request->query('highlight', 0);

        return Inertia::render('Admin/Services/Index', [
            'filters' => [
                'search' => $search,
                'highlight' => $highlight > 0 ? $highlight : null,
            ],
            'services' => Service::query()
                ->withCount('bidScopeProducts')
                ->when($search !== '', function ($query) use ($search): void {
                    $query->where(function ($query) use ($search): void {
                        $query
                            ->where('name', 'like', "%{$search}%")
                            ->orWhere('description', 'like', "%{$search}%");
                    });
                })
                ->when($highlight > 0, function ($query) use ($highlight): void {
                    $query->orderByRaw('CASE WHEN id = ? THEN 0 ELSE 1 END', [$highlight]);
                })
                ->orderBy('name')
                ->paginate(10)
                ->withQueryString()
                ->through(fn (Service $service): array => $this->servicePayload($service)),
        ]);
    }

    public function create(Request $request): Response
    {
        abort_unless(ServiceAccess::canCreate($request->user()), 403);

        return Inertia::render('Admin/Services/Create');
    }

    public function store(Request $request): RedirectResponse
    {
        if (! $request->exists('description')) {
            return $this->storeFromCatalog($request);
        }

        abort_unless(ServiceAccess::canCreate($request->user()), 403);

        $service = Service::create($this->validatedService($request));

        return redirect()
            ->route('admin.services.index', ['highlight' => $service->id])
            ->with('success', 'Service created successfully.');
    }

    public function edit(Request $request, Service $service): Response
    {
        abort_unless(ServiceAccess::canUpdate($request->user()), 403);

        $service->loadCount('bidScopeProducts');

        return Inertia::render('Admin/Services/Edit', [
            'service' => $this->servicePayload($service),
        ]);
    }

    public function update(Request $request, Service $service): RedirectResponse
    {
        abort_unless(ServiceAccess::canUpdate($request->user()), 403);

        $service->update($this->validatedService($request, $service));

        return redirect()
            ->route('admin.services.index', ['highlight' => $service->id])
            ->with('success', 'Service updated successfully.');
    }

    public function destroy(Request $request, Service $service): RedirectResponse
    {
        abort_unless(ServiceAccess::canDelete($request->user()), 403);

        if ($service->bidScopeProducts()->exists()) {
            return back()->with('error', 'Services used on a bid cannot be deleted.');
        }

        $service->delete();

        return redirect()
            ->route('admin.services.index')
            ->with('success', 'Service deleted successfully.');
    }

    private function storeFromCatalog(Request $request): RedirectResponse
    {
        abort_unless(
            BidAccess::canCreate($request->user())
            || BidAccess::canUpdate($request->user())
            || ServiceAccess::canCreate($request->user()),
            403,
        );

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $name = trim($validated['name']);
        $existing = Service::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->first();

        if ($existing) {
            return back()->with('success', 'Service already exists.');
        }

        Service::create(['name' => $name]);

        return back()->with('success', 'Service added successfully.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validatedService(Request $request, ?Service $service = null): array
    {
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                function (string $attribute, mixed $value, \Closure $fail) use ($service): void {
                    $existing = Service::query()
                        ->whereRaw('LOWER(name) = ?', [mb_strtolower(trim((string) $value))])
                        ->when($service, fn ($query) => $query->whereKeyNot($service->id))
                        ->exists();

                    if ($existing) {
                        $fail('This service already exists.');
                    }
                },
            ],
            'description' => ['nullable', 'string', 'max:5000'],
        ]);

        return [
            'name' => trim($validated['name']),
            'description' => trim((string) ($validated['description'] ?? '')) ?: null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function servicePayload(Service $service): array
    {
        return [
            'id' => $service->id,
            'uuid' => $service->uuid,
            'name' => $service->name,
            'description' => $service->description,
            'bid_count' => $service->bid_scope_products_count ?? $service->bidScopeProducts()->count(),
        ];
    }
}
