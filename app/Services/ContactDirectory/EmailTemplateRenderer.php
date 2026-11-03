<?php

namespace App\Services\ContactDirectory;

use App\Models\ContactDirectory\EmailTemplate;
use App\Models\User;
use InvalidArgumentException;

class EmailTemplateRenderer
{
    /**
     * Render a template subject and body with an explicit placeholder allowlist.
     *
     * Only tokens listed in EmailTemplate::PLACEHOLDERS are replaced. Any other
     * text, including unrecognized tokens and code-like syntax, is left as-is,
     * so no template content is ever evaluated as code.
     */
    public function render(EmailTemplate $template, array $values): array
    {
        $allowed = array_keys(EmailTemplate::PLACEHOLDERS);

        $subject = $template->subject;
        $body = $template->body;

        foreach ($allowed as $key) {
            $value = $values[$key] ?? null;

            if ($value === null || trim((string) $value) === '') {
                continue;
            }

            $token = '{{' . $key . '}}';

            $subject = str_replace($token, (string) $value, $subject);
            $body = str_replace($token, (string) $value, $body);
        }

        return [
            'subject' => $subject,
            'body' => $body,
            'unresolved' => $this->unresolvedPlaceholders($subject, $body, $values),
        ];
    }

    /**
     * Return placeholder keys still present after rendering.
     *
     * @return list<string>
     */
    public function unresolvedPlaceholders(string $subject, string $body, array $values): array
    {
        $allowed = array_keys(EmailTemplate::PLACEHOLDERS);
        $unresolved = [];

        $text = $subject . "\n" . $body;

        foreach ($allowed as $key) {
            $token = '{{' . $key . '}}';

            if (str_contains($text, $token) && (empty($values[$key]) || trim((string) $values[$key]) === '')) {
                $unresolved[] = $key;
            }
        }

        return $unresolved;
    }

    public function previewValues(User $actor, array $context = []): array
    {
        return [
            'contact_first_name' => $context['contact_first_name'] ?? 'Sam',
            'company_name' => $context['company_name'] ?? 'Acme Supply',
            'inquiry_title' => $context['inquiry_title'] ?? 'Steel door frames',
            'price_request_title' => $context['price_request_title'] ?? 'Main entrance hardware',
            'project_name' => $context['project_name'] ?? 'Riverside Tower',
            'response_due_date' => $context['response_due_date'] ?? now()->addDays(5)->format('M j, Y'),
            'current_user_name' => $actor->name,
            'user_email_signature' => $context['user_email_signature'] ?? '',
        ];
    }
}
