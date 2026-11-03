<?php

namespace App\Http\Controllers\ContactDirectory;

use App\Http\Controllers\Controller;
use App\Http\Requests\ContactDirectory\StoreContactCompanyRequest;
use App\Http\Requests\ContactDirectory\UpdateContactCompanyRequest;
use App\Models\ContactDirectory\ContactCompany;
use Illuminate\Contracts\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ContactCompanyController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->only(['search', 'is_active']);

        $companies = ContactCompany::query()
            ->withCount('contacts')
            ->when((string) ($filters['search'] ?? '') !== '', function ($query) use ($filters): void {
                $search = (string) $filters['search'];
                $query->where(function ($query) use ($search): void {
                    $query->where('name', 'like', "%{$search}%")
                        ->orWhere('website', 'like', "%{$search}%")
                        ->orWhere('city', 'like', "%{$search}%");
                });
            })
            ->when(array_key_exists('is_active', $filters), fn ($query): Builder => $query->where('is_active', (bool) $filters['is_active']))
            ->orderBy('name')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('ContactDirectory/Companies/Index', [
            'filters' => $filters,
            'companies' => $companies,
        ]);
    }

    public function show(Request $request, ContactCompany $company): Response
    {
        $company->loadCount('contacts');

        $contacts = $company->contacts()
            ->withPrimaryDetails()
            ->orderBy('last_name')
            ->paginate(20, ['*'], 'contacts_page')
            ->withQueryString();

        return Inertia::render('ContactDirectory/Companies/Show', [
            'company' => $company,
            'contacts' => $contacts,
        ]);
    }

    public function store(StoreContactCompanyRequest $request): mixed
    {
        $company = ContactCompany::create($request->validated());

        return redirect()->route('contact-directory.companies.show', $company)->with('success', 'Company created successfully.');
    }

    public function update(UpdateContactCompanyRequest $request, ContactCompany $company): mixed
    {
        $company->update($request->validated());

        return back()->with('success', 'Company updated successfully.');
    }
}
