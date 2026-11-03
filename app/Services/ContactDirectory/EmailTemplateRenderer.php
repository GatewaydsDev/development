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
            $token = '{{' . $key . '}}';

            if ($value === null || trim((string) $value) === '') {
                // The signature is optional: the mailbox adds the user's own one.
                if ($key === 'user_email_signature') {
                    $subject = str_replace($token, '', $subject);
                    $body = str_replace($token, '', $body);
                }

                continue;
            }

            // Values are plain text everywhere except the signature, which is saved HTML.
            $bodyValue = $key === 'user_email_signature' ? (string) $value : e((string) $value);

            $subject = str_replace($token, (string) $value, $subject);
            $body = str_replace($token, $bodyValue, $body);
        }

        return [
            'subject' => $subject,
            'body' => $body,
            'unresolved' => $this->unresolvedPlaceholders($subject, $body, $values),
        ];
    }

    /**
     * Templates written before the rich editor are plain text; show them as HTML paragraphs.
     */
    public function toHtml(string $body): string
    {
        if ($body === strip_tags($body)) {
            return nl2br(e($body));
        }

        return $body;
    }

    /**
     * Remove active content from template HTML before it is stored or sent.
     */
    public function sanitize(string $html): string
    {
        $html = preg_replace('#<(script|style|iframe|object|embed)\b[^>]*>.*?</\1>#is', '', $html) ?? $html;
        $html = preg_replace('#<(script|style|iframe|object|embed)\b[^>]*/?>#is', '', $html) ?? $html;
        $html = preg_replace('/\s+on[a-z]+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)/i', '', $html) ?? $html;

        return preg_replace('/(href|src)\s*=\s*("|\')\s*javascript:[^"\']*\2/i', '$1=$2#$2', $html) ?? $html;
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

            if ($key !== 'user_email_signature' && str_contains($text, $token) && (empty($values[$key]) || trim((string) $values[$key]) === '')) {
                $unresolved[] = $key;
            }
        }

        return $unresolved;
    }

    /**
     * Placeholder values known from the sender alone.
     *
     * @return array<string, string>
     */
    public function senderValues(User $user): array
    {
        return [
            'current_user_name' => $user->name,
            'user_email_signature' => (string) ($user->mail_signature ?? ''),
        ];
    }

    /**
     * Templates the user may send, filled in with everything known about the sender and context.
     *
     * @param  array<string, string|null>  $context
     * @return list<array<string, mixed>>
     */
    public function availableFor(User $user, array $context = []): array
    {
        $values = [...$context, ...$this->senderValues($user)];

        return EmailTemplate::query()
            ->availableTo($user)
            ->orderBy('name')
            ->get()
            ->map(function (EmailTemplate $template) use ($values): array {
                $rendered = $this->render($template, $values);
                $body = $this->toHtml($rendered['body']);

                return [
                    'uuid' => $template->uuid,
                    'name' => $template->name,
                    'category' => $template->category,
                    'subject' => $rendered['subject'],
                    'body' => $body,
                    'unresolved' => $rendered['unresolved'],
                ];
            })
            ->all();
    }

    /**
     * Placeholder keys still left in text about to be sent.
     *
     * @return list<string>
     */
    public function leftoverPlaceholders(string $text): array
    {
        return collect(array_keys(EmailTemplate::PLACEHOLDERS))
            ->filter(fn (string $key): bool => $key !== 'user_email_signature' && str_contains($text, '{{'.$key.'}}'))
            ->values()
            ->all();
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
