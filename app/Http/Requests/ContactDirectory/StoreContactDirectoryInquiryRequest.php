<?php

namespace App\Http\Requests\ContactDirectory;

use App\Models\ContactDirectory\ContactDirectoryContact;
use App\Models\ContactDirectory\ContactDirectoryInquiry;
use App\Models\ContactDirectory\PriceRequest;
use App\Models\Project;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreContactDirectoryInquiryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->hasPermission('manage-contacts-directory');
    }

    public function rules(): array
    {
        return [
            'contact_id' => ['required', 'integer', Rule::exists('contact_directory_contacts', 'id')],
            'price_request_id' => ['nullable', 'integer', Rule::exists('contact_directory_price_requests', 'id')],
            'project_id' => ['nullable', 'integer', Rule::exists('projects', 'id')],
            'assigned_user_id' => ['nullable', 'integer', Rule::exists('users', 'id')],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'priority' => ['required', 'string', Rule::in(ContactDirectoryInquiry::PRIORITIES)],
            'status' => ['required', 'string', Rule::in(ContactDirectoryInquiry::STATUSES)],
            'requested_date' => ['nullable', 'date'],
            'response_due_date' => ['nullable', 'date'],
            'supplier_reference_number' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            $contactId = (int) $this->input('contact_id');
            $priceRequestId = $this->input('price_request_id');
            $projectId = $this->input('project_id');

            if ($contactId && ! ContactDirectoryContact::whereKey($contactId)->exists()) {
                $validator->errors()->add('contact_id', 'This contact could not be found.');
            }

            if ($priceRequestId) {
                $priceRequest = PriceRequest::find((int) $priceRequestId);

                if (! $priceRequest) {
                    $validator->errors()->add('price_request_id', 'This price request could not be found.');
                } elseif ($projectId && (int) $projectId !== (int) $priceRequest->project_id) {
                    $validator->errors()->add(
                        'project_id',
                        'This inquiry must use the same project as its price request, or leave the project blank.'
                    );
                }
            }
        });
    }
}
