<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Company;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class CompanyController extends Controller
{
    public function show(): Response
    {
        $company = Company::query()
            ->latest()
            ->first();

        return Inertia::render('Admin/Company/Show', [
            'company' => $company
                ? [
                    'id' => $company->id,
                    'uuid' => $company->uuid,
                    'name' => $company->name,
                    'legal_name' => $company->legal_name,
                    'logo_url' => $company->logo_path
                        ? asset('storage/'.$company->logo_path)
                        : null,
                    'email' => $company->email,
                    'phone_number' => $company->phone_number,
                    'contact_phone_number' => $company->contact_phone_number,
                    'address_line_1' => $company->address_line_1,
                    'address_line_2' => $company->address_line_2,
                    'city' => $company->city,
                    'state' => $company->state,
                    'postal_code' => $company->postal_code,
                    'country' => $company->country,
                    'website_url' => $company->website_url,
                    'contact_url' => $company->contact_url,
                    'notes' => $company->notes,
                    'is_active' => $company->is_active,
                ]
                : null,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $company = Company::query()->latest()->first();
        $validated = $this->validatedCompanyData($request);

        if ($company) {
            $company->update($this->companyDataWithLogo($request, $company, $validated));
        } else {
            Company::create($this->companyDataWithLogo($request, null, $validated));
        }

        return redirect()
            ->route('admin.company.show')
            ->with('success', 'Company data saved successfully.');
    }

    public function update(Request $request, Company $company): RedirectResponse
    {
        $company->update($this->companyDataWithLogo(
            $request,
            $company,
            $this->validatedCompanyData($request),
        ));

        return redirect()
            ->route('admin.company.show')
            ->with('success', 'Company data updated successfully.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validatedCompanyData(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'legal_name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone_number' => ['nullable', 'string', 'max:50'],
            'contact_phone_number' => ['nullable', 'string', 'max:50'],
            'address_line_1' => ['nullable', 'string', 'max:255'],
            'address_line_2' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:255'],
            'state' => ['nullable', 'string', 'max:255'],
            'postal_code' => ['nullable', 'string', 'max:50'],
            'country' => ['nullable', 'string', 'max:255'],
            'website_url' => ['nullable', 'url', 'max:255'],
            'contact_url' => ['nullable', 'url', 'max:255'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'is_active' => ['boolean'],
            'logo' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp,svg', 'max:2048'],
            'remove_logo' => ['boolean'],
        ]);
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    private function companyDataWithLogo(Request $request, ?Company $company, array $validated): array
    {
        unset($validated['logo'], $validated['remove_logo']);

        if ($request->boolean('remove_logo') && $company?->logo_path) {
            Storage::disk('public')->delete($company->logo_path);
            $validated['logo_path'] = null;
        }

        if ($request->hasFile('logo')) {
            if ($company?->logo_path) {
                Storage::disk('public')->delete($company->logo_path);
            }

            $validated['logo_path'] = $request->file('logo')->store('company-logos', 'public');
        }

        return $validated;
    }
}
