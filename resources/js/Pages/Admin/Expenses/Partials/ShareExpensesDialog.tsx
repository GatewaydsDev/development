import { Button } from '@/Components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/Components/ui/dialog';
import { useForm } from '@inertiajs/react';
import { useEffect, useState } from 'react';

type ShareExpense = {
    id: number;
    spent_on: string | null;
    person_name: string;
    payee: string;
    description: string;
    category_label: string;
    amount: string;
    notes: string;
    payment_count: number;
    receipt_name: string | null;
    has_receipt: boolean;
};

type ShareContact = {
    id: number;
    name: string;
    email: string;
    company: string;
};

type SharePayload = {
    group: string;
    truncated: boolean;
    expenses: ShareExpense[];
    contacts: ShareContact[];
};

const money = (value: string) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(Number(value || 0));

const displayDate = (value: string | null) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');

    if (!match) {
        return value || '';
    }

    return `${match[2]}/${match[3]}/${match[1]}`;
};

export default function ShareExpensesDialog({
    group,
    onClose,
}: {
    group: string | null;
    onClose: () => void;
}) {
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [expenses, setExpenses] = useState<ShareExpense[]>([]);
    const [contacts, setContacts] = useState<ShareContact[]>([]);
    const [truncated, setTruncated] = useState(false);
    const [contactId, setContactId] = useState('');
    const form = useForm({
        email: '',
        message: '',
        group: '',
        expenses: [] as number[],
        receipts: [] as number[],
    });

    useEffect(() => {
        if (group === null) {
            return;
        }

        const controller = new AbortController();
        setLoading(true);
        setLoadError('');
        setExpenses([]);
        setContacts([]);
        setContactId('');
        form.reset();
        form.clearErrors();

        fetch(route('admin.expenses.share', { group }), {
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
            signal: controller.signal,
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error('The expenses for this group could not be loaded.');
                }

                return response.json() as Promise<SharePayload>;
            })
            .then((payload) => {
                const ids = payload.expenses.map((expense) => expense.id);
                const receipts = payload.expenses
                    .filter((expense) => expense.has_receipt)
                    .map((expense) => expense.id);

                setExpenses(payload.expenses);
                setContacts(payload.contacts);
                setTruncated(payload.truncated);
                form.setData({
                    email: '',
                    message: '',
                    group: payload.group,
                    expenses: ids,
                    receipts,
                });
            })
            .catch((error: Error) => {
                if (error.name !== 'AbortError') {
                    setLoadError(error.message);
                }
            })
            .finally(() => setLoading(false));

        return () => controller.abort();
        // form.reset is stable enough for this open/close fetch.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [group]);

    const toggleExpense = (expense: ShareExpense) => {
        const selected = form.data.expenses.includes(expense.id);
        form.setData({
            ...form.data,
            expenses: selected
                ? form.data.expenses.filter((id) => id !== expense.id)
                : [...form.data.expenses, expense.id],
            receipts: selected
                ? form.data.receipts.filter((id) => id !== expense.id)
                : form.data.receipts,
        });
    };

    const toggleReceipt = (id: number) => {
        form.setData(
            'receipts',
            form.data.receipts.includes(id)
                ? form.data.receipts.filter((item) => item !== id)
                : [...form.data.receipts, id],
        );
    };

    const send = () => {
        form.post(route('admin.expenses.share.store'), {
            preserveScroll: true,
            onSuccess: () => onClose(),
        });
    };

    const title = group ? `Share ${group}` : 'Share expenses';

    return (
        <Dialog open={group !== null} onOpenChange={(open) => { if (!open && !form.processing) { onClose(); } }}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        Send the expense details to a contact. The email lists them in a table and attaches a QuickBooks CSV that can be opened in Excel and imported. Checked receipts and images are attached with that file. Uncheck any document you do not want to share.
                    </DialogDescription>
                </DialogHeader>

                {loading ? <p className="text-sm text-muted-foreground">Loading this group…</p> : null}
                {loadError ? <p className="text-sm text-rose-700">{loadError}</p> : null}

                {!loading && !loadError ? (
                    <div className="flex flex-col gap-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="flex flex-col gap-1 text-sm">
                                <span className="font-medium text-foreground">Contact</span>
                                <select
                                    value={contactId}
                                    onChange={(event) => {
                                        const next = event.target.value;
                                        const contact = contacts.find((item) => String(item.id) === next);
                                        setContactId(next);
                                        form.setData('email', contact?.email ?? form.data.email);
                                    }}
                                    className="h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                                >
                                    <option value="">Choose a contact</option>
                                    {contacts.map((contact) => (
                                        <option key={contact.id} value={contact.id}>
                                            {contact.name}{contact.company ? ` · ${contact.company}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="flex flex-col gap-1 text-sm">
                                <span className="font-medium text-foreground">Email</span>
                                <input
                                    type="email"
                                    value={form.data.email}
                                    onChange={(event) => form.setData('email', event.target.value)}
                                    placeholder="name@example.com"
                                    className="h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                                />
                            </label>
                        </div>
                        {form.errors.email ? <p className="text-sm text-rose-700">{form.errors.email}</p> : null}

                        <label className="flex flex-col gap-1 text-sm">
                            <span className="font-medium text-foreground">Message</span>
                            <textarea
                                value={form.data.message}
                                onChange={(event) => form.setData('message', event.target.value)}
                                rows={3}
                                placeholder="Add a note for the recipient"
                                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                            />
                        </label>

                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => form.setData('expenses', expenses.map((expense) => expense.id))}
                            >
                                Select all expenses
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => form.setData('receipts', expenses.filter((expense) => expense.has_receipt && form.data.expenses.includes(expense.id)).map((expense) => expense.id))}
                            >
                                Select all documents
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => form.setData('receipts', [])}
                            >
                                Clear documents
                            </Button>
                        </div>
                        {truncated ? (
                            <p className="text-sm text-muted-foreground">Only the latest 50 expenses in this group are included.</p>
                        ) : null}
                        {form.errors.expenses ? <p className="text-sm text-rose-700">{form.errors.expenses}</p> : null}
                        {form.errors.receipts ? <p className="text-sm text-rose-700">{form.errors.receipts}</p> : null}

                        <ul className="flex flex-col gap-2">
                            {expenses.length === 0 ? (
                                <li className="text-sm text-muted-foreground">This group has no expenses to share.</li>
                            ) : expenses.map((expense) => {
                                const included = form.data.expenses.includes(expense.id);

                                return (
                                    <li key={expense.id} className="rounded-lg border border-border p-3">
                                        <label className="flex items-start gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                className="mt-1"
                                                checked={included}
                                                onChange={() => toggleExpense(expense)}
                                            />
                                            <span>
                                                <span className="font-medium text-foreground">{expense.description}</span>
                                                <span className="mt-0.5 block text-muted-foreground">
                                                    {[displayDate(expense.spent_on), expense.person_name, expense.payee, expense.category_label, money(expense.amount)].filter(Boolean).join(' · ')}
                                                    {expense.payment_count > 0 ? ` · ${expense.payment_count} ${expense.payment_count === 1 ? 'payment' : 'payments'}` : ''}
                                                </span>
                                                {expense.notes ? <span className="mt-0.5 block text-muted-foreground">{expense.notes}</span> : null}
                                            </span>
                                        </label>
                                        {expense.has_receipt ? (
                                            <label className="mt-2 ml-6 flex items-center gap-2 text-sm">
                                                <input
                                                    type="checkbox"
                                                    checked={included && form.data.receipts.includes(expense.id)}
                                                    disabled={!included}
                                                    onChange={() => toggleReceipt(expense.id)}
                                                />
                                                <span>Include {expense.receipt_name || 'receipt'}</span>
                                            </label>
                                        ) : (
                                            <p className="mt-2 ml-6 text-sm text-muted-foreground">No receipt or image</p>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ) : null}

                <DialogFooter>
                    <Button type="button" variant="outline" disabled={form.processing} onClick={onClose}>
                        Close
                    </Button>
                    <Button
                        type="button"
                        className="border-sky-800 bg-sky-700 text-white hover:bg-sky-800"
                        disabled={form.processing || loading || expenses.length === 0}
                        onClick={send}
                    >
                        {form.processing ? 'Sending…' : 'Send email'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
