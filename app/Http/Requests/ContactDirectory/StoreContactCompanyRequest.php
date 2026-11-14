<?php

namespace App\Http\Requests\ContactDirectory;

use App\Http\Requests\ContactDirectory\Concerns\ValidatesContactMethods;
use App\Models\ContactDirectory\CompanyAddress;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreContactCompanyRequest extends FormRequest
{
    use ValidatesContactMethods {
        prepareForValidation as prepareContactMethods;
    }

    protected function contactMethodOwnerLabel(): string
    {
        return 'company';
    }

    public function authorize(): bool
    {
        return $this->user()->hasPermission('manage-contacts-directory');
    }

    protected function prepareForValidation(): void
    {
        $this->prepareContactMethods();

        if (is_string($this->input('notes'))) {
            $this->merge(['notes' => app(\App\Services\ContactDirectory\EmailTemplateRenderer::class)->sanitize($this->input('notes'))]);
        }

        if (! is_array($this->input('addresses'))) {
            return;
        }

        // Rows left completely blank are dropped instead of saved as empty addresses.
        $this->merge(['addresses' => collect($this->input('addresses'))
            ->filter(fn ($row): bool => is_array($row) && (trim((string) ($row['name'] ?? '')) !== '' || collect(CompanyAddress::FIELDS)->contains(fn (string $field): bool => trim((string) ($row[$field] ?? '')) !== '')))
            ->values()
            ->all()]);
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'website' => ['nullable', 'string', 'max:255', 'url:http,https'],
            'addresses' => ['nullable', 'array', 'max:20'],
            'addresses.*.id' => ['prohibited'],
            'addresses.*.name' => ['nullable', 'string', 'max:255'],
            'addresses.*.address_type_id' => ['nullable', 'integer', Rule::exists('contact_address_types', 'id')],
            'addresses.*.is_headquarters' => ['nullable', 'boolean'],
            ...collect(CompanyAddress::FIELDS)->mapWithKeys(fn (string $field): array => ["addresses.*.{$field}" => ['nullable', 'string', 'max:255']])->all(),
            'addresses.*.postal_code' => ['nullable', 'string', 'max:20', 'regex:/^[0-9-]*$/'],
            'notes' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
            ...$this->contactMethodRules(),
            'phone_numbers.*.id' => ['prohibited'],
            'email_addresses.*.id' => ['prohibited'],
        ];
    }
}
