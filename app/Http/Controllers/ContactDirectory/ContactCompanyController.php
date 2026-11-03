<?php

namespace App\Http\Controllers\ContactDirectory;

use App\Http\Controllers\Controller;
use App\Http\Requests\ContactDirectory\StoreContactCompanyRequest;
use App\Http\Requests\ContactDirectory\UpdateContactCompanyRequest;
use App\Models\ContactDirectory\ContactCompany;
use App\Services\ContactDirectory\CompanyAddresses;
use App\Services\ContactDirectory\CompanyContactMethods;
use Illuminate\Contracts\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ContactCompanyController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->only(['search', 'is_active']);

        $companies = ContactCompany::query()
            ->with(['primaryPhone', 'primaryEmail', 'headquarters'])
            ->withCount('contacts')
            ->when((string) ($filters['search'] ?? '') !== '', function ($query) use ($filters): void {
                $search = (string) $filters['search'];
                $query->where(function ($query) use ($search): void {
                    $query->where('name', 'like', "%{$search}%")
                        ->orWhere('website', 'like', "%{$search}%")
                        ->orWhere('city', 'like', "%{$search}%")
                        ->orWhereHas('addresses', fn ($query) => $query->where('city', 'like', "%{$search}%")->orWhere('state', 'like', "%{$search}%"))
                        ->orWhereHas('phoneNumbers', fn ($query) => $query->where('phone_number', 'like', "%{$search}%"))
                        ->orWhereHas('emailAddresses', fn ($query) => $query->where('email_address', 'like', "%{$search}%"));
                });
            })
            ->when(isset($filters['is_active']) && $filters['is_active'] !== '', fn ($query): Builder => $query->where('is_active', (bool) $filters['is_active']))
            ->orderBy('name')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('ContactDirectory/Companies/Index', [
            'filters' => $filters,
            'companies' => $companies,
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('ContactDirectory/Companies/Form', ['company' => null]);
    }

    public function edit(ContactCompany $company): Response
    {
        return Inertia::render('ContactDirectory/Companies/Form', [
            'company' => $company->load(['phoneNumbers', 'emailAddresses', 'addresses']),
        ]);
    }

    public function show(Request $request, ContactCompany $company): Response
    {
        $company->load(['phoneNumbers', 'emailAddresses', 'addresses'])->loadCount('contacts');

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

    public function store(StoreContactCompanyRequest $request, CompanyContactMethods $methods, CompanyAddresses $addresses): mixed
    {
        $data = $request->validated();
        $company = DB::transaction(function () use ($data, $methods, $addresses) {
            $company = ContactCompany::create(collect($data)->except(['phone_numbers', 'email_addresses', 'addresses'])->all());
            $methods->sync($company, $data);
            $addresses->sync($company, $data);

            return $company;
        });

        return redirect()->route('contact-directory.companies.show', $company)->with('success', 'Company created successfully.');
    }

    public function update(UpdateContactCompanyRequest $request, ContactCompany $company, CompanyContactMethods $methods, CompanyAddresses $addresses): mixed
    {
        $data = $request->validated();
        DB::transaction(function () use ($company, $data, $methods, $addresses): void {
            $company = ContactCompany::query()->whereKey($company->id)->lockForUpdate()->firstOrFail();
            $company->update(collect($data)->except(['phone_numbers', 'email_addresses', 'addresses'])->all());
            $methods->sync($company, $data);
            $addresses->sync($company, $data);
        });

        return redirect()->route('contact-directory.companies.show', $company)->with('success', 'Company updated successfully.');
    }
}
