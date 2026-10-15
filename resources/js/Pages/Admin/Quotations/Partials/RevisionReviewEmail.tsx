import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import { Button } from '@/Components/ui/button';
import { useForm, usePage } from '@inertiajs/react';
import { MailIcon } from 'lucide-react';
import type { QuotationRevisionReviewPayload } from '../types';

type RevisionReviewEmailProps = {
    quotationUuid: string;
    revisionId?: string | number | null;
    revisionNumber?: string | null;
    reviews?: QuotationRevisionReviewPayload[];
    enabled?: boolean;
};

const fieldClassName =
    'w-full border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring';

export default function RevisionReviewEmail({
    quotationUuid,
    revisionId,
    revisionNumber,
    reviews = [],
    enabled = true,
}: RevisionReviewEmailProps) {
    const { reviewMailbox } = usePage<{ reviewMailbox?: string | null }>().props;
    const form = useForm({
        email: '',
        message: '',
    });

    if (!enabled) {
        return null;
    }

    if (!quotationUuid || !revisionId) {
        return (
            <p className="text-sm text-muted-foreground">
                Save the quotation before sending this revision for review.
            </p>
        );
    }

    const send = () => {
        form.post(
            route('admin.quotations.revisions.review-email', {
                quotation: quotationUuid,
                revision: revisionId,
            }),
            {
                preserveScroll: true,
                onSuccess: () => form.reset(),
            },
        );
    };

    return (
        <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/70 dark:bg-emerald-950/20">
            <div>
                <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <MailIcon className="size-4 text-emerald-700 dark:text-emerald-300" />
                    Send revision {revisionNumber || ''} for review
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                    {reviewMailbox
                        ? `This email leaves from ${reviewMailbox} and includes the quotation PDF.`
                        : 'Assign a Microsoft 365 mailbox to your account before sending a revision for review.'}
                </p>
            </div>

            {reviewMailbox ? (
                <div className="grid gap-3 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_auto] sm:items-end">
                    <div className="flex flex-col gap-2">
                        <InputLabel
                            htmlFor={`revision-review-email-${revisionId}`}
                            value="Reviewer email"
                        />
                        <TextInput
                            id={`revision-review-email-${revisionId}`}
                            type="email"
                            value={form.data.email}
                            className={`${fieldClassName} h-11`}
                            placeholder="sales@gateway-ds.com"
                            onChange={(event) =>
                                form.setData('email', event.target.value)
                            }
                        />
                        <InputError message={form.errors.email} />
                    </div>
                    <div className="flex flex-col gap-2">
                        <InputLabel
                            htmlFor={`revision-review-message-${revisionId}`}
                            value="Note"
                        />
                        <TextInput
                            id={`revision-review-message-${revisionId}`}
                            value={form.data.message}
                            className={`${fieldClassName} h-11`}
                            placeholder="Please review this revision"
                            onChange={(event) =>
                                form.setData('message', event.target.value)
                            }
                        />
                        <InputError message={form.errors.message} />
                    </div>
                    <Button
                        type="button"
                        className="h-11"
                        disabled={form.processing}
                        onClick={send}
                    >
                        {form.processing ? 'Sending…' : 'Send for review'}
                    </Button>
                </div>
            ) : null}

            {reviews.length > 0 ? (
                <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                    {reviews.map((review) => (
                        <li key={review.id}>
                            Sent to {review.recipient_email}
                            {review.sender_name
                                ? ` by ${review.sender_name}`
                                : ''}
                            {review.sent_at
                                ? ` on ${new Date(review.sent_at).toLocaleString()}`
                                : ''}
                            {review.message ? ` — ${review.message}` : ''}
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}
