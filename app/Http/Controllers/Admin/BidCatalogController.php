<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\BidPricingStatus;
use App\Models\BidScopeTitle;
use App\Models\BidStageType;
use App\Support\BidAccess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class BidCatalogController extends Controller
{
    public function storeStageType(Request $request): RedirectResponse
    {
        $this->authorizeCatalog($request);

        $name = $this->uniqueName($request, BidStageType::class);

        if ($name === null) {
            return back()->with('success', 'Stage already exists.');
        }

        BidStageType::create(['name' => $name]);

        return back()->with('success', 'Stage added successfully.');
    }

    public function storeScope(Request $request): RedirectResponse
    {
        $this->authorizeCatalog($request);

        $name = $this->uniqueName($request, BidScopeTitle::class);

        if ($name === null) {
            return back()->with('success', 'Scope title already exists.');
        }

        BidScopeTitle::create(['name' => $name]);

        return back()->with('success', 'Scope title added successfully.');
    }

    public function storePricingStatus(Request $request): RedirectResponse
    {
        $this->authorizeCatalog($request);

        $name = $this->uniqueName($request, BidPricingStatus::class);

        if ($name === null) {
            return back()->with('success', 'Pricing status already exists.');
        }

        BidPricingStatus::create(['name' => $name]);

        return back()->with('success', 'Pricing status added successfully.');
    }

    private function authorizeCatalog(Request $request): void
    {
        abort_unless(
            BidAccess::canCreate($request->user()) || BidAccess::canUpdate($request->user()),
            403,
        );
    }

    /**
     * @param class-string $model
     */
    private function uniqueName(Request $request, string $model): ?string
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $name = trim($validated['name']);
        $existing = $model::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->first();

        return $existing ? null : $name;
    }
}
