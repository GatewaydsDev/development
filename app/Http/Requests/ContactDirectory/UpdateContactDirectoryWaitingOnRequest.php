<?php

namespace App\Http\Requests\ContactDirectory;

use App\Models\ContactDirectory\ContactDirectoryInquiry;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateContactDirectoryWaitingOnRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->hasPermission('manage-contacts-directory');
    }

    public function rules(): array
    {
        return [
            'waiting_on' => ['required', 'string', Rule::in(ContactDirectoryInquiry::WAITING_ON)],
            'waiting_on_user_id' => [
                'nullable',
                'integer',
                Rule::exists('users', 'id'),
                Rule::requiredIf(fn (): bool => $this->input('waiting_on') === 'internal_team'),
            ],
            'expected_response_date' => ['nullable', 'date'],
            'waiting_explanation' => ['nullable', 'string'],
        ];
    }
}
