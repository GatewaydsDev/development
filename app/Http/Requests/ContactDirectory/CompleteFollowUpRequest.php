<?php

namespace App\Http\Requests\ContactDirectory;

use Illuminate\Foundation\Http\FormRequest;

class CompleteFollowUpRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->hasPermission('manage-follow-ups');
    }

    public function rules(): array
    {
        return [
            'notes' => ['nullable', 'string'],
        ];
    }
}
