<?php

namespace App\Http\Requests\ContactDirectory;

use App\Models\ContactDirectory\ContactFollowUp;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateFollowUpRequest extends FormRequest
{
    use NormalizesFollowUpTimes;

    public function authorize(): bool
    {
        return $this->user()->hasPermission('manage-follow-ups');
    }

    protected function prepareForValidation(): void
    {
        $this->normalizeTimes('due_at', 'reminder_at');

        if (is_string($this->input('description'))) {
            $this->merge(['description' => app(\App\Services\ContactDirectory\EmailTemplateRenderer::class)->sanitize($this->input('description'))]);
        }
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'assigned_user_id' => ['required', 'integer', Rule::exists('users', 'id')],
            'due_at' => ['required', 'date'],
            'reminder_at' => ['nullable', 'date', 'before_or_equal:due_at'],
            'tasks' => ['nullable', 'array', 'max:50'],
            'tasks.*.title' => ['required', 'string', 'max:255'],
            'priority' => ['required', 'string', Rule::in(ContactFollowUp::PRIORITIES)],
        ];
    }
}
