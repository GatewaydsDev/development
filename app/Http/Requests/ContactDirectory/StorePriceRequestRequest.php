<?php

namespace App\Http\Requests\ContactDirectory;

use App\Models\ContactDirectory\PriceRequest;
use App\Models\Project;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePriceRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->hasPermission('manage-price-requests');
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'project_id' => ['nullable', 'integer', Rule::exists('projects', 'id')],
            'owner_id' => ['required', 'integer', Rule::exists('users', 'id')],
            'currency' => ['required', 'string', 'size:3'],
            'required_by' => ['nullable', 'date'],
            'status' => ['required', 'string', Rule::in(PriceRequest::STATUSES)],
            'items' => ['nullable', 'array', 'max:100'],
            'items.*.description' => ['required', 'string', 'max:255'],
            'items.*.quantity' => ['nullable', 'numeric', 'min:0', 'not_in:0'],
            'items.*.unit_of_measure' => ['nullable', 'string', 'max:20'],
            'items.*.specifications' => ['nullable', 'string'],
            'items.*.notes' => ['nullable', 'string'],
        ];
    }
}
