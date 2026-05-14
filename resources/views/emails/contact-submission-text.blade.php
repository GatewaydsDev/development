New secure door contact request

A new contact form submission was received from the Gateway Door Systems website.

Name: {{ $submission->name }}
Email: {{ $submission->email }}
Phone: {{ $submission->phone_number ?: 'Not provided' }}
Organization: {{ $submission->organization ?: 'Not provided' }}
Project type: {{ $submission->project_type ?: 'Not provided' }}
Source URL: {{ $submission->source_url ?: 'Not provided' }}

Message:
{{ $submission->message }}
