<?php

namespace App\Http\Requests\ContactDirectory;

use App\Models\ContactDirectory\EmailTemplate;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateEmailTemplateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->hasPermission('manage-email-templates');
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'category' => ['required', 'string', Rule::in(EmailTemplate::CATEGORIES)],
            'subject' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string'],
            'is_active' => ['nullable', 'boolean'],
            'visibility' => ['required', 'string', Rule::in(EmailTemplate::VISIBILITIES)],
        ];
    }
}
