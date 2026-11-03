<?php

namespace App\Http\Requests\ContactDirectory;

use App\Models\ContactDirectory\ContactFollowUp;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreFollowUpRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->hasPermission('manage-follow-ups');
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'assigned_user_id' => ['required', 'integer', Rule::exists('users', 'id')],
            'due_at' => ['required', 'date'],
            'reminder_at' => ['nullable', 'date', 'before_or_equal:due_at'],
            'priority' => ['required', 'string', Rule::in(ContactFollowUp::PRIORITIES)],
        ];
    }
}
