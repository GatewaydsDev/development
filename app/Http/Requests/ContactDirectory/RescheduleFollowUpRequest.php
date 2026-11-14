<?php

namespace App\Http\Requests\ContactDirectory;

use Illuminate\Foundation\Http\FormRequest;

class RescheduleFollowUpRequest extends FormRequest
{
    use NormalizesFollowUpTimes;

    public function authorize(): bool
    {
        return $this->user()->hasPermission('manage-follow-ups');
    }

    protected function prepareForValidation(): void
    {
        $this->normalizeTimes('due_at', 'reminder_at');
    }

    public function rules(): array
    {
        return [
            'due_at' => ['required', 'date'],
            'reminder_at' => ['nullable', 'date', 'before_or_equal:due_at'],
        ];
    }
}
