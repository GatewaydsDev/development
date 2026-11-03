<?php

namespace App\Http\Requests\ContactDirectory;

use Illuminate\Foundation\Http\FormRequest;

class SnoozeFollowUpRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->hasPermission('manage-follow-ups');
    }

    public function rules(): array
    {
        return [
            'snoozed_until' => ['required', 'date', 'after:now'],
            'reason' => ['nullable', 'string', 'max:255'],
        ];
    }
}
