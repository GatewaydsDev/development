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

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('body'))) {
            $this->merge(['body' => app(\App\Services\ContactDirectory\EmailTemplateRenderer::class)->sanitize($this->input('body'))]);
        }
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'category' => ['required', 'string', Rule::in(EmailTemplate::CATEGORIES)],
            'subject' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string', 'max:50000'],
            'is_active' => ['nullable', 'boolean'],
            'visibility' => ['required', 'string', Rule::in(EmailTemplate::VISIBILITIES)],
        ];
    }
}
