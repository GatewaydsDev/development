import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Link, router, usePage } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import SimpleSelect from '@/Components/ContactDirectory/SimpleSelect';
import TextInput from '@/Components/TextInput';
import RichTextEditor from '@/Components/RichTextEditor';
import type { PageProps } from '@/types';

type Contact = {
    id: number;
    uuid: string;
    first_name: string;
    last_name: string | null;
    email_addresses: Array<{ id: number; email_address: string; label: string; is_primary: boolean }>;
    phone_numbers: Array<{ id: number; phone_number: string; label: string }>;
};

type Inquiry = {
    id: number;
    uuid: string;
    title: string;
} | null;

type MailTemplate = {
    uuid: string;
    name: string;
    category: string;
    subject: string;
    body: string;
    unresolved: string[];
};

const htmlToText = (html: string) => {
    const element = document.createElement('div');
    element.innerHTML = html.replace(/<\/(p|div|h[1-6]|li)>|<br\s*\/?>/gi, '$&\n');

    return (element.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
};

type Props = PageProps<{
    contact: Contact;
    inquiry: Inquiry;
    canSend: boolean;
    mailbox: string;
    templates: MailTemplate[];
}>;

export default function EmailCompose({ contact, inquiry, canSend, mailbox, templates }: Props) {
    const page = usePage<Props>();
    const errors = page.props.errors as Record<string, string> | undefined;

    const [recipients, setRecipients] = useState<string[]>(
        contact.email_addresses.filter((email) => email.is_primary).map((email) => email.email_address),
    );
    const [subject, setSubject] = useState(
        inquiry ? `Inquiry: ${inquiry.title}` : '',
    );
    const [body, setBody] = useState('');
    const [templateId, setTemplateId] = useState('');
    const selectedTemplate = templates.find((template) => template.uuid === templateId);
    const leftover = [...(body + subject).matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]);

    const applyTemplate = (uuid: string) => {
        setTemplateId(uuid);
        const template = templates.find((item) => item.uuid === uuid);

        if (template) {
            setSubject(template.subject);
            setBody(template.body);
        }
    };

    const toggleRecipient = (email: string) => {
        setRecipients((current) =>
            current.includes(email)
                ? current.filter((item) => item !== email)
                : [...current, email],
        );
    };

    const mailtoHref = () => {
        const params = new URLSearchParams({
            subject,
            body: htmlToText(body),
        });

        return `mailto:${recipients.join(',')}?${params.toString()}`;
    };

    const submitSend = (event: FormEvent) => {
        event.preventDefault();

        router.post(
            route('contact-directory.contacts.email.send', contact.uuid),
            {
                inquiry_id: inquiry?.id ?? null,
                recipients,
                subject,
                body,
            },
            { preserveScroll: true },
        );
    };

    const submitManualLog = (event: FormEvent) => {
        event.preventDefault();

        router.post(
            route('contact-directory.contacts.email.log', contact.uuid),
            {
                inquiry_id: inquiry?.id ?? null,
                recipients,
                subject,
                body: htmlToText(body),
                direction: 'outgoing',
            },
            { preserveScroll: true },
        );
    };

    return (
        <AuthenticatedLayout
            stickyTitle={`Email ${contact.first_name} ${contact.last_name ?? ''}`}
        >
            <div className="space-y-6 px-4 py-6 lg:px-8">
                <Card className="border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30">
                    <CardHeader>
                        <CardTitle className="text-base">Compose email</CardTitle>
                        <CardDescription>
                            Recipients must be one of this contact's saved email addresses.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-foreground">Recipients</p>
                            {contact.email_addresses.map((email) => (
                                <label
                                    key={email.id}
                                    className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                                >
                                    <input
                                        type="checkbox"
                                        checked={recipients.includes(email.email_address)}
                                        onChange={() => toggleRecipient(email.email_address)}
                                    />
                                    <span className="min-w-0">{email.email_address}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {email.label}
                                        {email.is_primary ? ' · primary' : ''}
                                    </span>
                                </label>
                            ))}
                            {errors?.recipients && (
                                <p className="text-xs text-destructive">{errors.recipients}</p>
                            )}
                        </div>

                        {templates.length > 0 && (
                            <div>
                                <label className="mb-1 block text-sm font-medium text-foreground">
                                    Start from a template
                                </label>
                                <select
                                    value={templateId}
                                    onChange={(event) => applyTemplate(event.target.value)}
                                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
                                >
                                    <option value="">No template</option>
                                    {templates.map((template) => (
                                        <option key={template.uuid} value={template.uuid}>
                                            {template.name}
                                        </option>
                                    ))}
                                </select>
                                {selectedTemplate && selectedTemplate.unresolved.length > 0 && (
                                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                                        Missing details for this contact:{' '}
                                        {selectedTemplate.unresolved.join(', ')}. Fill them in before sending.
                                    </p>
                                )}
                            </div>
                        )}

                        <div>
                            <label className="mb-1 block text-sm font-medium text-foreground">
                                Subject
                            </label>
                            <TextInput
                                value={subject}
                                onChange={(event) => setSubject(event.target.value)}
                                required
                            />
                            {errors?.subject && (
                                <p className="mt-1 text-xs text-destructive">{errors.subject}</p>
                            )}
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-foreground">
                                Message
                            </label>
                            <RichTextEditor
                                key={templateId}
                                id="contact-email-body"
                                compact
                                showPlaceholders={false}
                                value={body}
                                onChange={setBody}
                                error={errors?.body}
                            />
                            {errors?.body && (
                                <p className="mt-1 text-xs text-destructive">{errors.body}</p>
                            )}
                            {leftover.length > 0 && (
                                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                                    Replace these placeholders before sending:{' '}
                                    {[...new Set(leftover)].map((key) => `{{${key}}}`).join(', ')}
                                </p>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {canSend ? (
                                <Button onClick={submitSend} disabled={recipients.length === 0}>
                                    Send and record
                                </Button>
                            ) : (
                                <Badge variant="outline">
                                    Your account has no Microsoft 365 mailbox assigned. Ask an admin
                                    to set it, or use mailto / log the email manually.
                                </Badge>
                            )}
                            <Button asChild variant="outline">
                                <a href={mailtoHref()}>Open in your email client</a>
                            </Button>
                            <Button variant="outline" onClick={submitManualLog}>
                                Log this email manually
                            </Button>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            Messages are sent from your own Microsoft 365 mailbox with your signature.
                            Opening in your email client starts a draft in your own mail app. It
                            cannot confirm whether the message was sent or delivered. Logging
                            manually records the content you typed, without sending it.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
