<?php

namespace App\Support;

use App\Models\DailyTaskCompletion;
use Illuminate\Validation\Rule;

class DailyTaskProgressRules
{
    /**
     * @return array<string, mixed>
     */
    public static function rules(): array
    {
        return [
            'schedule_uuid' => ['nullable', 'string'],
            'performed_by_employee_uuid' => ['nullable', 'string'],
            'performed_by_employee_uuids' => ['nullable', 'array'],
            'performed_by_employee_uuids.*' => ['string'],
            'status' => ['required', Rule::in(array_keys(DailyTaskCompletion::STATUSES))],
            'progress' => ['nullable', 'integer', 'between:0,100'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'photos' => ['nullable', 'array', 'max:10'],
            'photos.*' => ['image', 'max:15360'],
        ];
    }
}
