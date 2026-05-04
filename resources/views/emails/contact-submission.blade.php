<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>New contact request</title>
</head>
<body style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
    <h1 style="font-size: 22px; margin-bottom: 16px;">New secure door contact request</h1>

    <p>A new contact form submission was received from the Gateway Door Systems website.</p>

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
            <th align="left" style="border-bottom: 1px solid #e5e7eb;">Project type</th>
            <td style="border-bottom: 1px solid #e5e7eb;">{{ $submission->project_type ?: 'Not provided' }}</td>
        </tr>
        <tr>
            <th align="left" style="border-bottom: 1px solid #e5e7eb;">Source URL</th>
            <td style="border-bottom: 1px solid #e5e7eb;">{{ $submission->source_url ?: 'Not provided' }}</td>
        </tr>
    </table>

    <h2 style="font-size: 18px; margin-top: 24px;">Message</h2>
    <p style="white-space: pre-line;">{{ $submission->message }}</p>
</body>
</html>
