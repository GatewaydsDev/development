<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Reset your password</title>
</head>
<body style="margin: 0; background: #f3f4f6; color: #111827; font-family: Arial, Helvetica, sans-serif; line-height: 1.5;">
    <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">
        Use this secure link to reset your {{ $appName }} password. The link expires in {{ $expiresInMinutes }} minutes.
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background: #f3f4f6; margin: 0; padding: 24px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 620px; overflow: hidden; border-radius: 16px; background: #ffffff; border: 1px solid #e5e7eb;">
                    <tr>
                        <td style="padding: 28px 32px 18px;">
                            <p style="margin: 0 0 8px; color: #047857; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">
                                {{ $appName }}
                            </p>
                            <h1 style="margin: 0; color: #111827; font-size: 24px; line-height: 1.25;">
                                Reset your password
                            </h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 32px 28px;">
                            <p style="margin: 0 0 16px; color: #374151; font-size: 15px;">
                                We received a request to reset the password for {{ $userEmail }}.
                            </p>
                            <p style="margin: 0 0 24px; color: #374151; font-size: 15px;">
                                If you made this request, use the secure button below. This link expires in {{ $expiresInMinutes }} minutes.
                            </p>

                            <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
                                <tr>
                                    <td style="border-radius: 999px; background: #047857;">
                                        <a href="{{ $resetUrl }}" style="display: inline-block; padding: 12px 22px; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none;">
                                            Reset password
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 0 0 10px; color: #374151; font-size: 14px;">
                                If the button does not work, copy and paste this link into your browser:
                            </p>
                            <p style="margin: 0 0 24px; overflow-wrap: break-word; word-break: break-word; color: #047857; font-size: 13px;">
                                <a href="{{ $resetUrl }}" style="color: #047857;">{{ $resetUrl }}</a>
                            </p>

                            <p style="margin: 0; color: #6b7280; font-size: 13px;">
                                If you did not request a password reset, you can safely ignore this email. Your password will not change unless this link is used.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="border-top: 1px solid #e5e7eb; padding: 18px 32px; color: #6b7280; font-size: 12px;">
                            This message was sent by {{ $appName }} for account security.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
