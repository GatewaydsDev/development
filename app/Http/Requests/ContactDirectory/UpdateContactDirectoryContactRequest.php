<?php

namespace App\Http\Requests\ContactDirectory;

use Illuminate\Validation\Rule;

class UpdateContactDirectoryContactRequest extends StoreContactDirectoryContactRequest
{
    public function rules(): array
    {
        $rules = parent::rules();

        $rules['phone_numbers.*.id'] = [
            'nullable',
            'integer',
            'distinct',
            Rule::exists('contact_directory_contact_phone_numbers', 'id'),
        ];

        $rules['email_addresses.*.id'] = [
            'nullable',
            'integer',
            'distinct',
            Rule::exists('contact_directory_contact_email_addresses', 'id'),
        ];

        return $rules;
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            $contact = $this->route('contactDirectoryContact') ?? $this->route('contact');

            if ($contact) {
                $this->validateExistingOwnership('phone_numbers', 'id', $contact, 'phoneNumbers', $validator);
                $this->validateExistingOwnership('email_addresses', 'id', $contact, 'emailAddresses', $validator);
            }

            $this->validatePrimaryUniqueness('phone_numbers', 'phone_number', 'phone number', $validator);
            $this->validatePrimaryUniqueness('email_addresses', 'email_address', 'email address', $validator);
            $this->validateDuplicates('phone_numbers', 'phone_number', 'phone number', $validator);
            $this->validateDuplicates('email_addresses', 'email_address', 'email address', $validator);
            $this->validatePhoneCountries($validator);
        });
    }

    private function validateExistingOwnership(string $arrayKey, string $idField, $contact, string $relation, $validator): void
    {
        $rows = (array) $this->input($arrayKey, []);
        $existingIds = $contact->{$relation}()->pluck('id')->all();

        foreach ($rows as $index => $row) {
            if (empty($row[$idField])) {
                continue;
            }

            if (! in_array((int) $row[$idField], $existingIds, true)) {
                $validator->errors()->add(
                    "{$arrayKey}.{$index}.{$idField}",
                    'This record does not belong to this contact.'
                );
            }
        }
    }
}
