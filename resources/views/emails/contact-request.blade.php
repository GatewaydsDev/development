<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>{{ $subject ?? 'Contact request' }}</title>
</head>
<body style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
    <p style="margin: 0 0 16px;">
        <img src="{{ asset('images/App-Logo.png') }}" alt="Gateway Door Systems" width="220" style="display: block; width: 220px; max-width: 100%; height: auto;">
    </p>

    @if (! empty($recipientName))
        <p style="margin: 0 0 16px;">Hi {{ $recipientName }},</p>
    @endif

    @if (! empty($body))
        <div style="white-space: pre-line; margin-bottom: 24px;">{{ $body }}</div>
    @endif

    <h2 style="font-size: 18px; margin: 24px 0 12px;">Contact request details</h2>

    <table cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; max-width: 720px;">
        <tr>
            <th align="left" style="border-bottom: 1px solid #e5e7eb; width: 180px;">Name</th>
            <td style="border-bottom: 1px solid #e5e7eb;">{{ $submission->name }}</td>
        </tr>
        <tr>
            <th align="left" style="border-bottom: 1px solid #e5e7eb;">Email</th>
            <td style="border-bottom: 1px solid #e5e7eb;">{{ $submission->email }}</td>
        </tr>
        <tr>
            <th align="left" style="border-bottom: 1px solid #e5e7eb;">Phone</th>
            <td style="border-bottom: 1px solid #e5e7eb;">{{ $submission->phone_number ?: 'Not provided' }}</td>
        </tr>
        <tr>
            <th align="left" style="border-bottom: 1px solid #e5e7eb;">Organization</th>
            <td style="border-bottom: 1px solid #e5e7eb;">{{ $submission->organization ?: 'Not provided' }}</td>
        </tr>
        <tr>
            <th align="left" style="border-bottom: 1px solid #e5e7eb;">Service location</th>
            <td style="border-bottom: 1px solid #e5e7eb;">{{ $submission->address ?: 'Not provided' }}</td>
        </tr>
        <tr>
            <th align="left" style="border-bottom: 1px solid #e5e7eb;">State</th>
            <td style="border-bottom: 1px solid #e5e7eb;">{{ $submission->state ?: 'Not provided' }}</td>
        </tr>
        <tr>
            <th align="left" style="border-bottom: 1px solid #e5e7eb;">Country</th>
            <td style="border-bottom: 1px solid #e5e7eb;">{{ $submission->country ?: 'Not provided' }}</td>
        </tr>
        <tr>
            <th align="left" style="border-bottom: 1px solid #e5e7eb;">Project type</th>
            <td style="border-bottom: 1px solid #e5e7eb;">{{ $submission->project_type ?: 'Not provided' }}</td>
        </tr>
    </table>

    <h2 style="font-size: 18px; margin-top: 24px;">Message</h2>
    <p style="white-space: pre-line;">{{ $submission->message }}</p>
</body>
</html>
