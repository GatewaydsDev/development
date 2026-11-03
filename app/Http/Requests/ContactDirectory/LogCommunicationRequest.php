<?php

namespace App\Http\Requests\ContactDirectory;

use App\Models\ContactDirectory\ContactActivity;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class LogCommunicationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->hasPermission('log-communications');
    }

    public function rules(): array
    {
        return [
            'activity_type' => ['required', 'string', Rule::in(ContactActivity::TYPES)],
            'direction' => ['required', 'string', Rule::in(ContactActivity::DIRECTIONS)],
            'subject' => ['required', 'string', 'max:255'],
            'content' => ['nullable', 'string'],
            'occurred_at' => ['required', 'date'],
        ];
    }
}
