<?php

namespace App\Http\Requests\ContactDirectory;

use Illuminate\Foundation\Http\FormRequest;

class RescheduleFollowUpRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->hasPermission('manage-follow-ups');
    }

    public function rules(): array
    {
        return [
            'due_at' => ['required', 'date'],
            'reminder_at' => ['nullable', 'date', 'before_or_equal:due_at'],
        ];
    }
}
