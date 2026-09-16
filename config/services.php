<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
        'webhook_token' => env('POSTMARK_WEBHOOK_TOKEN'),
    ],

    'mailgun' => [
        'domain' => env('MAILGUN_DOMAIN'),
        'secret' => env('MAILGUN_SECRET'),
        'endpoint' => env('MAILGUN_ENDPOINT', 'api.mailgun.net'),
        'scheme' => 'https',
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY', env('RESEND_KEY')),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'twilio' => [
        'sid' => env('TWILIO_SID'),
        'token' => env('TWILIO_AUTH_TOKEN', env('TWILIO_TOKEN')),
        'from' => env('TWILIO_FROM'),
        'to' => env('TWILIO_TO'),
    ],

    'microsoft' => [
        'tenant_id' => env('MICROSOFT_TENANT_ID'),
        'client_id' => env('MICROSOFT_CLIENT_ID'),
        'client_secret' => env('MICROSOFT_CLIENT_SECRET', env('Entra_ID')),
        'client_secret_id' => env('MICROSOFT_CLIENT_SECRET_ID', env('Entra_SECRET_ID')),
        'mail_from' => env('MICROSOFT_MAIL_FROM', 'sales@gateway-ds.com'),
        'mail_from_name' => env(
            'MICROSOFT_MAIL_FROM_NAME',
            'Gateway Door Systems'
        ),
        'mail_username' => env(
            'MICROSOFT_MAIL_USERNAME',
            env('MICROSOFT_MAIL_FROM', 'sales@gateway-ds.com')
        ),
        'mail_password' => env('MICROSOFT_MAIL_PASSWORD'),
        'mail_host' => env('MICROSOFT_MAIL_HOST', 'smtp.office365.com'),
        'mail_port' => env('MICROSOFT_MAIL_PORT', 587),
    ],

];
