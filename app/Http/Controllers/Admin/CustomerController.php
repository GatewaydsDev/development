<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\CustomerContact;
use App\Models\CustomerContactRole;
use App\Support\CustomerAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class CustomerController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless(CustomerAccess::canView($request->user()), 403);

        $search = (string) $request->query('search', '');

        return Inertia::render('Admin/Customers/Index', [
            'filters' => [
                'search' => $search,
            ],
            'customers' => Customer::query()
                ->with([
                    'contacts' => fn ($query) => $query->orderByDesc('is_primary')->orderBy('name'),
                    'project.status',
                ])
                ->when($search !== '', function ($query) use ($search): void {
                    $query->where(function ($query) use ($search): void {
                        $query
                            ->where('name', 'like', "%{$search}%")
                            ->orWhere('company_name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%")
                            ->orWhere('phone_number', 'like', "%{$search}%")
                            ->orWhereHas('contacts', function ($query) use ($search): void {
                                $query
                                    ->where('name', 'like', "%{$search}%")
                                    ->orWhere('email', 'like', "%{$search}%")
                                    ->orWhere('phone_number', 'like', "%{$search}%");
                            });
                    });
                })
                ->latest()
                ->paginate(10)
                ->withQueryString()
                ->through(fn (Customer $customer): array => $this->customerPayload($customer)),
        ]);
    }

    public function create(Request $request): Response
    {
        abort_unless(CustomerAccess::canCreate($request->user()), 403);

        return Inertia::render('Admin/Customers/Create', [
            'contactRoles' => $this->contactRoles(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless(CustomerAccess::canCreate($request->user()), 403);

        if (! $request->exists('company_name') && $request->filled('name')) {
            return $this->storeFromCatalog($request);
        }

        $validated = $this->validatedCustomer($request);
        $this->validateContactUniqueness($validated['contacts'] ?? []);

        DB::transaction(function () use ($validated): void {
            $customer = Customer::create($this->customerAttributes($validated));

            $this->syncContacts($customer, $validated['contacts'] ?? []);
        });

        return redirect()
            ->route('admin.customers.index')
            ->with('success', 'Customer created successfully.');
    }

    public function storeContact(Request $request): RedirectResponse
    {
        abort_unless(
            CustomerAccess::canCreate($request->user()) || CustomerAccess::canUpdate($request->user()),
            403,
        );

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'customer_id' => ['nullable', 'integer', Rule::exists(Customer::class, 'id')],
            'email' => ['nullable', 'email', 'max:255'],
            'phone_number' => ['nullable', 'string', 'max:50'],
        ]);

        $name = trim($validated['name']);
        $customer = filled($validated['customer_id'] ?? null)
            ? Customer::query()->find($validated['customer_id'])
            : null;

        if (! $customer) {
            $customer = Customer::query()
                ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
                ->first();
        }

        if (! $customer) {
            $customer = Customer::create([
                'name' => $name,
                'company_name' => $name,
            ]);
        }

        $existing = $customer->contacts()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->first();

        if ($existing) {
            return back()->with('success', 'Contact already exists.');
        }

        $customer->contacts()->create([
            'name' => $name,
            'email' => $validated['email'] ?? null,
            'phone_number' => $validated['phone_number'] ?? null,
            'is_primary' => ! $customer->contacts()->exists(),
        ]);

        return back()->with('success', 'Contact added successfully.');
    }

    public function edit(Request $request, Customer $customer): Response
    {
        abort_unless(CustomerAccess::canUpdate($request->user()), 403);

        $customer->load([
            'contacts' => fn ($query) => $query->orderByDesc('is_primary')->orderBy('name'),
            'project.status',
        ]);

        return Inertia::render('Admin/Customers/Edit', [
            'customer' => $this->customerPayload($customer),
            'contactRoles' => $this->contactRoles(),
        ]);
    }

    public function update(Request $request, Customer $customer): RedirectResponse
    {
        abort_unless(CustomerAccess::canUpdate($request->user()), 403);

        $validated = $this->validatedCustomer($request);
        $this->validateContactUniqueness($validated['contacts'] ?? [], $customer);

        DB::transaction(function () use ($customer, $validated): void {
            $customer->update($this->customerAttributes($validated));

            $this->syncContacts($customer, $validated['contacts'] ?? []);
        });

        return redirect()
            ->route('admin.customers.index')
            ->with('success', 'Customer updated successfully.');
    }

    public function destroy(Request $request, Customer $customer): RedirectResponse
    {
        abort_unless(CustomerAccess::canDelete($request->user()), 403);

        if ($customer->projects()->exists()) {
            return back()->with('error', 'Customers linked to a project cannot be deleted.');
        }

        $customer->delete();

        return redirect()
            ->route('admin.customers.index')
            ->with('success', 'Customer deleted successfully.');
    }

    public function contactAvailability(Request $request): JsonResponse
    {
        abort_unless(
            CustomerAccess::canCreate($request->user()) || CustomerAccess::canUpdate($request->user()),
            403,
        );

        $validated = $request->validate([
            'field' => ['required', 'string', Rule::in(['email', 'phone_number'])],
            'value' => ['nullable', 'string', 'max:255'],
            'customer_id' => ['nullable', 'integer', Rule::exists(Customer::class, 'id')],
        ]);

        $value = trim((string) ($validated['value'] ?? ''));

        if ($value === '') {
            return response()->json(['available' => true]);
        }

        $query = CustomerContact::query()
            ->when(
                $validated['field'] === 'email',
                fn ($query) => $query->whereRaw('LOWER(email) = ?', [strtolower($value)]),
                fn ($query) => $query->where('phone_number', $value),
            )
            ->when(
                $validated['customer_id'] ?? null,
                fn ($query, int $customerId) => $query->where('customer_id', '!=', $customerId),
            );

        return response()->json([
            'available' => ! $query->exists(),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validatedCustomer(Request $request): array
    {
        return $request->validate([
            'company_name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone_number' => ['nullable', 'string', 'max:50'],
            'address_line_1' => ['nullable', 'string', 'max:255'],
            'address_line_2' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:255'],
            'state' => ['nullable', 'string', 'max:255'],
            'postal_code' => ['nullable', 'string', 'max:50'],
            'country' => ['nullable', 'string', 'max:255'],
            'contacts' => ['array'],
            'contacts.*.name' => ['nullable', 'string', 'max:255'],
            'contacts.*.customer_contact_role_id' => ['nullable', 'integer', Rule::exists(CustomerContactRole::class, 'id')],
            'contacts.*.title' => ['nullable', 'string', 'max:255'],
            'contacts.*.email' => ['nullable', 'email', 'max:255'],
            'contacts.*.phone_number' => ['nullable', 'string', 'max:50'],
            'contacts.*.notes' => ['nullable', 'string', 'max:1000'],
            'contacts.*.is_primary' => ['boolean'],
        ]);
    }

    /**
     * @param  array<int, array<string, mixed>>  $contacts
     *
     * @throws ValidationException
     */
    private function validateContactUniqueness(array $contacts, ?Customer $customer = null): void
    {
        $errors = [];
        $seenEmails = [];
        $seenPhones = [];

        foreach ($contacts as $index => $contact) {
            $email = strtolower(trim((string) ($contact['email'] ?? '')));
            $phoneNumber = trim((string) ($contact['phone_number'] ?? ''));
            $phoneDigits = preg_replace('/\D/', '', $phoneNumber) ?: '';

            if ($email !== '') {
                if (isset($seenEmails[$email])) {
                    $errors["contacts.{$index}.email"] = 'This email is already used in this customer form.';
                } else {
                    $seenEmails[$email] = true;
                }

                $exists = CustomerContact::query()
                    ->whereRaw('LOWER(email) = ?', [$email])
                    ->when($customer, fn ($query) => $query->where('customer_id', '!=', $customer->id))
                    ->exists();

                if ($exists) {
                    $errors["contacts.{$index}.email"] = 'This email is already used by another customer contact.';
                }
            }

            if ($phoneDigits !== '') {
                if (isset($seenPhones[$phoneDigits])) {
                    $errors["contacts.{$index}.phone_number"] = 'This phone number is already used in this customer form.';
                } else {
                    $seenPhones[$phoneDigits] = true;
                }

                $exists = CustomerContact::query()
                    ->where('phone_number', $phoneNumber)
                    ->when($customer, fn ($query) => $query->where('customer_id', '!=', $customer->id))
                    ->exists();

                if ($exists) {
                    $errors["contacts.{$index}.phone_number"] = 'This phone number is already used by another customer contact.';
                }
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    private function storeFromCatalog(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone_number' => ['nullable', 'string', 'max:50'],
        ]);

        $name = trim($validated['name']);
        $existing = Customer::query()
            ->where(function ($query) use ($name): void {
                $query
                    ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
                    ->orWhereRaw('LOWER(company_name) = ?', [mb_strtolower($name)]);
            })
            ->first();

        if ($existing) {
            return back()->with('success', 'Customer already exists.');
        }

        Customer::create([
            'name' => $name,
            'company_name' => $name,
            'email' => $validated['email'] ?? null,
            'phone_number' => $validated['phone_number'] ?? null,
        ]);

        return back()->with('success', 'Customer added successfully.');
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    private function customerAttributes(array $validated): array
    {
        $primaryContact = collect($validated['contacts'] ?? [])
            ->first(fn (array $contact): bool => (bool) ($contact['is_primary'] ?? false))
            ?? collect($validated['contacts'] ?? [])->first();

        $companyName = trim((string) ($validated['company_name'] ?? ''));

        return [
            'name' => $companyName,
            'company_name' => $companyName !== '' ? $companyName : null,
            'email' => $validated['email'] ?? $primaryContact['email'] ?? null,
            'phone_number' => $validated['phone_number'] ?? $primaryContact['phone_number'] ?? null,
            'address_line_1' => $validated['address_line_1'] ?? null,
            'address_line_2' => $validated['address_line_2'] ?? null,
            'city' => $validated['city'] ?? null,
            'state' => $validated['state'] ?? null,
            'postal_code' => $validated['postal_code'] ?? null,
            'country' => $validated['country'] ?? null,
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $contacts
     */
    private function syncContacts(Customer $customer, array $contacts): void
    {
        $contacts = collect($contacts)
            ->filter(fn (array $contact): bool => filled($contact['name'] ?? null) || filled($contact['email'] ?? null) || filled($contact['phone_number'] ?? null))
            ->values()
            ->map(function (array $contact, int $index): array {
                return [
                    'name' => $contact['name'] ?: 'Contact '.($index + 1),
                    'customer_contact_role_id' => $contact['customer_contact_role_id'] ?? null,
                    'title' => $contact['title'] ?? null,
                    'email' => $contact['email'] ?? null,
                    'phone_number' => $contact['phone_number'] ?? null,
                    'notes' => $contact['notes'] ?? null,
                    'is_primary' => (bool) ($contact['is_primary'] ?? false),
                ];
            });

        if ($contacts->isNotEmpty() && ! $contacts->contains('is_primary', true)) {
            $contacts = $contacts->map(function (array $contact, int $index): array {
                $contact['is_primary'] = $index === 0;

                return $contact;
            });
        }

        $customer->contacts()->delete();
        $customer->contacts()->createMany($contacts->all());
    }

    /**
     * @return array<string, mixed>
     */
    private function customerPayload(Customer $customer): array
    {
        return [
            'id' => $customer->id,
            'uuid' => $customer->uuid,
            'name' => $customer->name,
            'company_name' => $customer->company_name,
            'email' => $customer->email,
            'phone_number' => $customer->phone_number,
            'contacts' => $customer->contacts
                ->map(fn ($contact): array => [
                    'id' => $contact->id,
                    'uuid' => $contact->uuid,
                    'name' => $contact->name,
                    'customer_contact_role_id' => $contact->customer_contact_role_id,
                    'title' => $contact->title,
                    'email' => $contact->email,
                    'phone_number' => $contact->phone_number,
                    'notes' => $contact->notes,
                    'is_primary' => $contact->is_primary,
                ])
                ->values(),
            'address_line_1' => $customer->address_line_1,
            'address_line_2' => $customer->address_line_2,
            'city' => $customer->city,
            'state' => $customer->state,
            'postal_code' => $customer->postal_code,
            'country' => $customer->country,
            'project' => $customer->project
                ? [
                    'id' => $customer->project->id,
                    'name' => $customer->project->name,
                    'project_number' => $customer->project->project_number,
                    'status' => $customer->project->status?->name,
                ]
                : null,
            'created_at' => $customer->created_at?->toFormattedDateString(),
            'updated_at' => $customer->updated_at?->toFormattedDateString(),
        ];
    }

    /**
     * @return array<int, array{id: int, name: string}>
     */
    private function contactRoles(): array
    {
        return CustomerContactRole::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (CustomerContactRole $role): array => [
                'id' => $role->id,
                'name' => $role->name,
            ])
            ->all();
    }
}
