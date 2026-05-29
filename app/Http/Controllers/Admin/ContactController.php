<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ContactController extends Controller
{
    public function index(Request $request): Response
    {
        $search = (string) $request->query('search', '');

        return Inertia::render('Admin/Contacts/Index', [
            'filters' => [
                'search' => $search,
            ],
            'contacts' => Contact::query()
                ->when($search !== '', function ($query) use ($search): void {
                    $query->where(function ($query) use ($search): void {
                        $query
                            ->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%")
                            ->orWhere('company', 'like', "%{$search}%")
                            ->orWhere('phone_number', 'like', "%{$search}%");
                    });
                })
                ->orderBy('name')
                ->paginate(10)
                ->withQueryString()
                ->through(fn (Contact $contact): array => $this->contactPayload($contact)),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validatedContact($request);

        Contact::create($validated);

        return back()->with('success', 'Contact created successfully.');
    }

    public function update(Request $request, Contact $contact): RedirectResponse
    {
        $validated = $this->validatedContact($request, $contact);

        $contact->update($validated);

        return back()->with('success', 'Contact updated successfully.');
    }

    public function destroy(Contact $contact): RedirectResponse
    {
        $contact->delete();

        return back()->with('success', 'Contact deleted successfully.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validatedContact(Request $request, ?Contact $contact = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'email',
                'max:255',
                Rule::unique('contacts', 'email')->ignore($contact?->id),
            ],
            'phone_number' => ['nullable', 'string', 'max:50'],
            'company' => ['nullable', 'string', 'max:255'],
            'title' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'is_active' => ['boolean'],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function contactPayload(Contact $contact): array
    {
        return [
            'id' => $contact->id,
            'uuid' => $contact->uuid,
            'name' => $contact->name,
            'email' => $contact->email,
            'phone_number' => $contact->phone_number,
            'company' => $contact->company,
            'title' => $contact->title,
            'notes' => $contact->notes,
            'is_active' => $contact->is_active,
            'created_at' => $contact->created_at?->toFormattedDateString(),
        ];
    }
}
