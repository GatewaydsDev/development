<?php

namespace App\Http\Requests\ContactDirectory;

use App\Http\Requests\ContactDirectory\Concerns\ValidatesContactMethods;
use App\Models\ContactDirectory\ContactDirectoryContact;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreContactDirectoryContactRequest extends FormRequest
{
    use ValidatesContactMethods;

    public function authorize(): bool
    {
        return $this->user()->hasPermission('manage-contacts-directory');
    }

    public function rules(): array
    {
        return [
            'company_id' => ['nullable', 'integer', 'exists:contact_companies,id'],
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['nullable', 'string', 'max:255'],
            'job_title' => ['nullable', 'string', 'max:255'],
            'contact_type' => ['required', 'string', Rule::in(ContactDirectoryContact::CONTACT_TYPES)],
            'owner_id' => ['required', 'integer', 'exists:users,id'],
            'notes' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
            ...$this->contactMethodRules(),
        ];
    }
}
