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

type Props = PageProps<{
    contact: Contact;
    inquiry: Inquiry;
    canSend: boolean;
    mailbox: string;
}>;

export default function EmailCompose({ contact, inquiry, canSend, mailbox }: Props) {
    const page = usePage<Props>();
    const errors = page.props.errors as Record<string, string> | undefined;

    const [recipients, setRecipients] = useState<string[]>(
        contact.email_addresses.filter((email) => email.is_primary).map((email) => email.email_address),
    );
    const [subject, setSubject] = useState(
        inquiry ? `Inquiry: ${inquiry.title}` : '',
    );
    const [body, setBody] = useState('');
    const [manual, setManual] = useState(false);

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
            body,
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
                body,
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
                <Card>
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
                            <textarea
                                value={body}
                                onChange={(event) => setBody(event.target.value)}
                                rows={10}
                                required
                                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:ring-2 focus:ring-ring/40 focus:outline-none"
                            />
                            {errors?.body && (
                                <p className="mt-1 text-xs text-destructive">{errors.body}</p>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {canSend ? (
                                <Button onClick={submitSend} disabled={recipients.length === 0}>
                                    Send and record
                                </Button>
                            ) : (
                                <Badge variant="outline">
                                    Email sending is not configured on this deployment. Use mailto
                                    or log the email manually.
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
