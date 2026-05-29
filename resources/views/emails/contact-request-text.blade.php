@if (! empty($recipientName))Hi {{ $recipientName }},

@endif
@if (! empty($body)){{ $body }}

@endif
Contact request details

Name: {{ $submission->name }}
Email: {{ $submission->email }}
Phone: {{ $submission->phone_number ?: 'Not provided' }}
Organization: {{ $submission->organization ?: 'Not provided' }}
Service location: {{ $submission->address ?: 'Not provided' }}
State: {{ $submission->state ?: 'Not provided' }}
Country: {{ $submission->country ?: 'Not provided' }}
Project type: {{ $submission->project_type ?: 'Not provided' }}

Message:
{{ $submission->message }}
