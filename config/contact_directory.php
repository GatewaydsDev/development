<?php

return [
    /*
    |----------------------------------------------------------------------
    | Contacts & Follow-ups thresholds
    |----------------------------------------------------------------------
    */

    // Days without activity before an open inquiry is flagged in Needs Attention.
    'inactivity_days' => (int) env('CONTACT_DIRECTORY_INACTIVITY_DAYS', 7),

    // Days before a quote expires before it is flagged in Needs Attention.
    'quote_expiry_warning_days' => (int) env('CONTACT_DIRECTORY_QUOTE_EXPIRY_WARNING_DAYS', 14),

    // Also email follow-up reminders when a mail provider is configured.
    'email_reminders' => (bool) env('CONTACT_DIRECTORY_EMAIL_REMINDERS', false),
];
