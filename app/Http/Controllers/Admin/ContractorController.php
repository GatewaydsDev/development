<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Contractor;
use App\Models\ContractorContact;
use App\Support\ContractorAccess;
use App\Support\ProjectAccess;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class ContractorController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless(ContractorAccess::canView($request->user()), 403);

        $search = (string) $request->query('search', '');
        $highlight = (int) $request->query('highlight', 0);

        return Inertia::render('Admin/Contractors/Index', [
            'filters' => [
                'search' => $search,
                'highlight' => $highlight > 0 ? $highlight : null,
            ],
            'contractors' => Contractor::query()
                ->with([
                    'contacts' => fn ($query) => $query->orderByDesc('is_primary')->orderBy('name'),
                ])
                ->withCount('projects')
                ->when($search !== '', function ($query) use ($search): void {
                    $query->where(function ($query) use ($search): void {
                        $query
                            ->where('name', 'like', "%{$search}%")
                            ->orWhere('website', 'like', "%{$search}%")
                            ->orWhere('city', 'like', "%{$search}%")
                            ->orWhere('state', 'like', "%{$search}%")
                            ->orWhereHas('contacts', function ($query) use ($search): void {
                                $query
                                    ->where('name', 'like', "%{$search}%")
                                    ->orWhere('email', 'like', "%{$search}%")
                                    ->orWhere('phone_number', 'like', "%{$search}%");
                            });
                    });
                })
                ->when($highlight > 0, function ($query) use ($highlight): void {
                    $query->orderByRaw('CASE WHEN id = ? THEN 0 ELSE 1 END', [$highlight]);
                })
                ->orderBy('name')
                ->paginate(10)
                ->withQueryString()
                ->through(fn (Contractor $contractor): array => $this->contractorPayload($contractor)),
        ]);
    }

    public function create(Request $request): Response
    {
        abort_unless(ContractorAccess::canCreate($request->user()), 403);

        return Inertia::render('Admin/Contractors/Create', [
            'options' => $this->options(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        if (! $request->exists('contacts')) {
            return $this->storeFromCatalog($request);
        }

        abort_unless(ContractorAccess::canCreate($request->user()), 403);

        $validated = $this->validatedContractor($request);
        $this->validateContactUniqueness($validated['contacts'] ?? []);

        $contractor = DB::transaction(function () use ($validated): Contractor {
            $contractor = Contractor::create($this->contractorAttributes($validated));

            $this->syncContacts($contractor, $validated['contacts'] ?? []);

            return $contractor;
        });

        return redirect()
            ->route('admin.contractors.index', ['highlight' => $contractor->id])
            ->with('success', 'Contractor created successfully.');
    }

    public function edit(Request $request, Contractor $contractor): Response
    {
        abort_unless(ContractorAccess::canUpdate($request->user()), 403);

        $contractor->load([
            'contacts' => fn ($query) => $query->orderByDesc('is_primary')->orderBy('name'),
        ]);
        $contractor->loadCount('projects');

        return Inertia::render('Admin/Contractors/Edit', [
            'contractor' => $this->contractorPayload($contractor),
            'options' => $this->options(),
        ]);
    }

    public function update(Request $request, Contractor $contractor): RedirectResponse
    {
        abort_unless(ContractorAccess::canUpdate($request->user()), 403);

        $validated = $this->validatedContractor($request, $contractor);
        $this->validateContactUniqueness($validated['contacts'] ?? [], $contractor);

        DB::transaction(function () use ($contractor, $validated): void {
            $contractor->update($this->contractorAttributes($validated));

            $this->syncContacts($contractor, $validated['contacts'] ?? []);
        });

        return redirect()
            ->route('admin.contractors.index', ['highlight' => $contractor->id])
            ->with('success', 'Contractor updated successfully.');
    }

    public function destroy(Request $request, Contractor $contractor): RedirectResponse
    {
        abort_unless(ContractorAccess::canDelete($request->user()), 403);

        if ($contractor->projects()->exists()) {
            return back()->with('error', 'Contractors linked to a project cannot be deleted.');
        }

        $contractor->delete();

        return redirect()
            ->route('admin.contractors.index')
            ->with('success', 'Contractor deleted successfully.');
    }

    public function contactAvailability(Request $request): JsonResponse
    {
        abort_unless(
            ContractorAccess::canCreate($request->user()) || ContractorAccess::canUpdate($request->user()),
            403,
        );

        $validated = $request->validate([
            'field' => ['required', 'string', Rule::in(['email', 'phone_number'])],
            'value' => ['nullable', 'string', 'max:255'],
            'contractor_id' => ['nullable', 'integer', Rule::exists(Contractor::class, 'id')],
        ]);

        $value = trim((string) ($validated['value'] ?? ''));

        if ($value === '') {
            return response()->json(['available' => true]);
        }

        $query = ContractorContact::query()
            ->when(
                $validated['field'] === 'email',
                fn ($query) => $query->whereRaw('LOWER(email) = ?', [strtolower($value)]),
                fn ($query) => $query->where('phone_number', $value),
            )
            ->when(
                $validated['contractor_id'] ?? null,
                fn ($query, int $contractorId) => $query->where('contractor_id', '!=', $contractorId),
            );

        return response()->json([
            'available' => ! $query->exists(),
        ]);
    }

    private function storeFromCatalog(Request $request): RedirectResponse
    {
        abort_unless(
            ProjectAccess::canCreate($request->user())
            || ProjectAccess::canUpdate($request->user())
            || ContractorAccess::canCreate($request->user()),
            403,
        );

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone_number' => ['nullable', 'string', 'max:50'],
        ]);

        $name = trim($validated['name']);
        $email = trim((string) ($validated['email'] ?? ''));
        $phoneNumber = trim((string) ($validated['phone_number'] ?? ''));
        $existing = Contractor::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->first();

        if ($existing) {
            return back()->with('success', 'Contractor already exists.');
        }

        DB::transaction(function () use ($name, $email, $phoneNumber): void {
            $contractor = Contractor::create([
                'name' => $name,
            ]);

            if ($email !== '' || $phoneNumber !== '') {
                $contractor->contacts()->create([
                    'name' => $name,
                    'email' => $email !== '' ? $email : null,
                    'phone_number' => $phoneNumber !== '' ? $phoneNumber : null,
                    'is_primary' => true,
                ]);
            }
        });

        return back()->with('success', 'Contractor added successfully.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validatedContractor(Request $request, ?Contractor $contractor = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255', $this->uniqueContractorNameRule($contractor)],
            'website' => ['nullable', 'string', 'max:255'],
            'address_line_1' => ['nullable', 'string', 'max:255'],
            'address_line_2' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:255'],
            'state' => ['nullable', 'string', 'max:255'],
            'postal_code' => ['nullable', 'string', 'max:50'],
            'country' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'contacts' => ['array'],
            'contacts.*.name' => ['nullable', 'string', 'max:255'],
            'contacts.*.title' => ['nullable', 'string', 'max:255'],
            'contacts.*.email' => ['nullable', 'email', 'max:255'],
            'contacts.*.phone_number' => ['nullable', 'string', 'max:50'],
            'contacts.*.phone_type' => ['nullable', 'string', Rule::in(['', ...Contractor::PHONE_TYPES])],
            'contacts.*.notes' => ['nullable', 'string', 'max:1000'],
            'contacts.*.is_primary' => ['boolean'],
        ]);
    }

    private function uniqueContractorNameRule(?Contractor $contractor = null): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($contractor): void {
            $name = trim((string) $value);

            if ($name === '') {
                return;
            }

            $exists = Contractor::query()
                ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
                ->when(
                    $contractor,
                    fn ($query) => $query->whereKeyNot($contractor->id),
                )
                ->exists();

            if ($exists) {
                $fail('A contractor with this name already exists.');
            }
        };
    }

    /**
     * @param  array<int, array<string, mixed>>  $contacts
     *
     * @throws ValidationException
     */
    private function validateContactUniqueness(array $contacts, ?Contractor $contractor = null): void
    {
        $errors = [];
        $seenEmails = [];
        $seenPhones = [];

        foreach ($contacts as $index => $contact) {
            $email = strtolower(trim((string) ($contact['email'] ?? '')));
            $phoneNumber = trim((string) ($contact['phone_number'] ?? ''));
            $phoneDigits = preg_replace('/\D/', '', $phoneNumber) ?: '';
            $phoneType = trim((string) ($contact['phone_type'] ?? ''));

            if ($phoneDigits !== '' && $phoneType === '') {
                $errors["contacts.{$index}.phone_type"] = 'Select a phone type.';
            }

            if ($email !== '') {
                if (isset($seenEmails[$email])) {
                    $errors["contacts.{$index}.email"] = 'This email is already used in this contractor form.';
                } else {
                    $seenEmails[$email] = true;
                }

                $exists = ContractorContact::query()
                    ->whereRaw('LOWER(email) = ?', [$email])
                    ->when($contractor, fn ($query) => $query->where('contractor_id', '!=', $contractor->id))
                    ->exists();

                if ($exists) {
                    $errors["contacts.{$index}.email"] = 'This email is already used by another contractor contact.';
                }
            }

            if ($phoneDigits !== '') {
                if (isset($seenPhones[$phoneDigits])) {
                    $errors["contacts.{$index}.phone_number"] = 'This phone number is already used in this contractor form.';
                } else {
                    $seenPhones[$phoneDigits] = true;
                }

                $exists = ContractorContact::query()
                    ->where('phone_number', $phoneNumber)
                    ->when($contractor, fn ($query) => $query->where('contractor_id', '!=', $contractor->id))
                    ->exists();

                if ($exists) {
                    $errors["contacts.{$index}.phone_number"] = 'This phone number is already used by another contractor contact.';
                }
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    private function contractorAttributes(array $validated): array
    {
        return [
            'name' => $validated['name'],
            'website' => $validated['website'] ?? null,
            'address_line_1' => $validated['address_line_1'] ?? null,
            'address_line_2' => $validated['address_line_2'] ?? null,
            'city' => $validated['city'] ?? null,
            'state' => $validated['state'] ?? null,
            'postal_code' => $validated['postal_code'] ?? null,
            'country' => $validated['country'] ?? null,
            'notes' => $validated['notes'] ?? null,
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $contacts
     */
    private function syncContacts(Contractor $contractor, array $contacts): void
    {
        $contacts = collect($contacts)
            ->filter(fn (array $contact): bool => filled($contact['name'] ?? null)
                || filled($contact['email'] ?? null)
                || filled($contact['phone_number'] ?? null))
            ->values()
            ->map(function (array $contact, int $index): array {
                $phoneNumber = trim((string) ($contact['phone_number'] ?? ''));

                return [
                    'name' => trim((string) ($contact['name'] ?? '')) ?: 'Contact '.($index + 1),
                    'title' => $contact['title'] ?? null,
                    'email' => $contact['email'] ?? null,
                    'phone_number' => $phoneNumber !== '' ? $phoneNumber : null,
                    'phone_type' => $phoneNumber !== '' ? ($contact['phone_type'] ?: null) : null,
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

        $contractor->contacts()->delete();
        $contractor->contacts()->createMany($contacts->all());
    }

    /**
     * @return array<string, mixed>
     */
    private function contractorPayload(Contractor $contractor): array
    {
        $primaryContact = $contractor->primaryContact();

        return [
            'id' => $contractor->id,
            'uuid' => $contractor->uuid,
            'name' => $contractor->name,
            'website' => $contractor->website,
            'address_line_1' => $contractor->address_line_1,
            'address_line_2' => $contractor->address_line_2,
            'city' => $contractor->city,
            'state' => $contractor->state,
            'postal_code' => $contractor->postal_code,
            'country' => $contractor->country,
            'notes' => $contractor->notes,
            'email' => $primaryContact?->email,
            'phone_number' => $primaryContact?->phone_number,
            'contact_name' => $primaryContact?->name,
            'projects_count' => $contractor->projects_count ?? $contractor->projects()->count(),
            'contacts' => $contractor->contacts
                ->map(fn (ContractorContact $contact): array => [
                    'id' => $contact->id,
                    'uuid' => $contact->uuid,
                    'name' => $contact->name,
                    'title' => $contact->title,
                    'email' => $contact->email,
                    'phone_number' => $contact->phone_number,
                    'phone_type' => $contact->phone_type,
                    'notes' => $contact->notes,
                    'is_primary' => $contact->is_primary,
                ])
                ->values(),
            'created_at' => $contractor->created_at?->toFormattedDateString(),
            'updated_at' => $contractor->updated_at?->toFormattedDateString(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function options(): array
    {
        return [
            'phoneTypes' => Contractor::PHONE_TYPES,
        ];
    }
}
