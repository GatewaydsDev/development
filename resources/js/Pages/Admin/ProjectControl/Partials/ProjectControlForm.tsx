import FormActionFab from '@/Components/FormActionFab';
import CreatableSelect, { type CreatableOption } from '@/Components/CreatableSelect';
import InputError from '@/Components/InputError';
import MaskedDecimalInput from '@/Components/MaskedDecimalInput';
import RichTextEditor from '@/Components/RichTextEditor';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/Components/ui/alert-dialog';
import { Button } from '@/Components/ui/button';
import { Link, router, useForm, usePage } from '@inertiajs/react';
import { BellIcon, MailIcon, PlusIcon, RulerIcon, Trash2Icon } from 'lucide-react';
import { FormEvent, ReactNode, useState } from 'react';
import type { ReminderPerson } from './ReminderDialog';

export type BidDraft = {
    name: string;
    quoted_on: string;
    amount: string;
    standing: string;
    count_rule: string;
    document: string;
    notes: string;
};

export type OpeningDraft = {
    id?: number | null;
    category: string;
    category_id: string;
    description: string;
    mark: string;
    size: string;
    quantity: string;
    requirement: string;
    procurement_status: string;
    procurement_status_id: string;
    supplier: string;
    unit_sell: string;
    hardware: string;
    additional_needed: string;
    notes: string;
};

export type ProcurementDraft = {
    assembly: string;
    quantity: string;
    manufacturer: string;
    quote_number: string;
    quoted_on: string;
    supplier_cost: string;
    order_status: string;
    order_status_id: string;
    po_number: string;
    lead_time: string;
    lead_time_id: string;
    next_action: string;
};

export type ControlDraft = {
    uuid?: string;
    job_code: string;
    name: string;
    customer: string;
    location: string;
    bid_date: string;
    current_value: string;
    pipeline_status: string;
    status_note: string;
    award_status: string;
    award_status_id: string;
    probability: string;
    probability_id: string;
    scope_summary: string;
    assembly_count: string;
    pricing_class: string;
    pricing_class_id: string;
    material_cost: string;
    freight_cost: string;
    labor_cost: string;
    other_cost: string;
    deposit_percent: string;
    bid_due_date: string;
    next_follow_up_date: string;
    material_payment_date: string;
    customer_payment_date: string;
    lead_time: string;
    lead_time_id: string;
    bonding_required: string;
    bonding_option_id: string;
    payment_plan: string;
    cash_flag: string;
    cash_flag_id: string;
    next_step: string;
    bid_document: string;
    counts_in_demonstrated: boolean;
    remind_at: string;
    reminder_note: string;
    notify_popup: boolean;
    notify_email: boolean;
    reminder_user_ids: number[];
    bids: BidDraft[];
    openings: OpeningDraft[];
    procurements: ProcurementDraft[];
};

export type ControlTerms = {
    awardStatuses: CreatableOption[];
    pricingClasses: CreatableOption[];
    bondingOptions: CreatableOption[];
    probabilities: CreatableOption[];
    cashFlags: CreatableOption[];
    leadTimes: CreatableOption[];
    openingCategories: CreatableOption[];
    procurementStatuses: CreatableOption[];
    orderStatuses: CreatableOption[];
};

const fieldClass =
    'h-11 w-full rounded-md border border-border bg-background px-3 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm dark:[color-scheme:dark]';

const blankBid = (): BidDraft => ({
    name: '',
    quoted_on: '',
    amount: '',
    standing: 'current',
    count_rule: '',
    document: '',
    notes: '',
});

const blankOpening = (): OpeningDraft => ({
    id: null,
    category: '',
    category_id: '',
    description: '',
    mark: '',
    size: '',
    quantity: '',
    requirement: '',
    procurement_status: '',
    procurement_status_id: '',
    supplier: '',
    unit_sell: '',
    hardware: '',
    additional_needed: '',
    notes: '',
});

const blankProcurement = (): ProcurementDraft => ({
    assembly: '',
    quantity: '',
    manufacturer: '',
    quote_number: '',
    quoted_on: '',
    supplier_cost: '',
    order_status: '',
    order_status_id: '',
    po_number: '',
    lead_time: '',
    lead_time_id: '',
    next_action: '',
});

const amount = (value: string) => {
    if (value.trim() === '') {
        return null;
    }

    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
};

const money = (value: number | null) => {
    if (value === null) {
        return '—';
    }

    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

const addButtonClass = 'bg-emerald-600 text-white hover:bg-emerald-700';
const takeoffButtonClass = 'bg-sky-600 text-white hover:bg-sky-700';

export default function ProjectControlForm({
    action,
    method,
    control,
    people = [],
    terms,
}: {
    action: string;
    method: 'post' | 'patch';
    control: ControlDraft;
    people?: ReminderPerson[];
    terms: ControlTerms;
}) {
    const userId = usePage().props.auth.user.id;
    const form = useForm<ControlDraft>({
        ...control,
        reminder_user_ids: control.reminder_user_ids?.length ? control.reminder_user_ids : [userId],
    });
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const costs = [form.data.material_cost, form.data.freight_cost, form.data.labor_cost, form.data.other_cost]
        .map(amount)
        .filter((value): value is number => value !== null);
    const direct = costs.length === 0 ? null : costs.reduce((sum, value) => sum + value, 0);
    const current = amount(form.data.current_value) ?? 0;
    const profit = direct === null ? null : current - direct;
    const margin = direct === null || current <= 0 ? null : (profit ?? 0) / current * 100;
    const depositPercent = amount(form.data.deposit_percent);
    const deposit = depositPercent === null || depositPercent <= 0 ? null : current * depositPercent / 100;
    const selectedPeople = people.filter((person) => form.data.reminder_user_ids.includes(person.id));
    const reminderActive = form.data.remind_at.trim() !== '';
    const emailBlocked = reminderActive && form.data.notify_email && selectedPeople.some((person) => !person.mailbox || !person.email);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.transform((data) => {
            const remindAt = data.remind_at ? new Date(data.remind_at) : null;

            return {
                ...data,
                remind_at: remindAt && !Number.isNaN(remindAt.getTime()) ? remindAt.toISOString() : '',
            };
        });

        if (method === 'post') {
            form.post(action);

            return;
        }

        form.patch(action);
    };

    const toggleReminderPerson = (id: number) => {
        const ids = form.data.reminder_user_ids.includes(id)
            ? form.data.reminder_user_ids.filter((item) => item !== id)
            : [...form.data.reminder_user_ids, id];

        form.setData('reminder_user_ids', ids);
    };

    const lineError = (prefix: string, index: number) => {
        const key = Object.keys(form.errors).find((name) => name.startsWith(`${prefix}.${index}.`));

        return key ? form.errors[key as keyof typeof form.errors] : undefined;
    };

    const removeJob = () => {
        if (!control.uuid) {
            return;
        }

        setDeleting(true);
        router.delete(route('admin.project-control.destroy', control.uuid), {
            onFinish: () => setDeleting(false),
        });
    };

    return (
        <>
        <form id="project-control-form" onSubmit={submit} className="space-y-6 pb-24">
            <section className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/30 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">Job</h3>
                        <p className="mt-1 text-sm text-muted-foreground">The current value is the only number that enters the pipeline.</p>
                    </div>
                    <div className="w-full max-w-xs sm:text-right">
                        <Field label="Job number" error={form.errors.job_code}>
                            <input
                                value={form.data.job_code}
                                onChange={(event) => form.setData('job_code', event.target.value)}
                                className={`${fieldClass} sm:text-right`}
                                placeholder="Leave blank for the next J-number"
                            />
                        </Field>
                    </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <Field label="Project" error={form.errors.name} className="md:col-span-2">
                        <input value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} className={fieldClass} />
                    </Field>
                    <Field label="Customer / prime" error={form.errors.customer}>
                        <input value={form.data.customer} onChange={(event) => form.setData('customer', event.target.value)} className={fieldClass} />
                    </Field>
                    <Field label="Location" error={form.errors.location}>
                        <input value={form.data.location} onChange={(event) => form.setData('location', event.target.value)} className={fieldClass} />
                    </Field>
                    <Field label="Status" error={form.errors.pipeline_status}>
                        <select value={form.data.pipeline_status} onChange={(event) => form.setData('pipeline_status', event.target.value)} className={fieldClass}>
                            <option value="active">Active</option>
                            <option value="on_hold">On hold</option>
                            <option value="lost">Lost</option>
                        </select>
                    </Field>
                    <TermSelect
                        id="award-status"
                        label="Award / PO"
                        kind="award_status"
                        catalogKey="awardStatuses"
                        value={form.data.award_status_id}
                        options={terms.awardStatuses}
                        error={form.errors.award_status_id || form.errors.award_status}
                        onChange={(id, option) => form.setData({ ...form.data, award_status_id: id, award_status: option?.name ?? '' })}
                    />
                    <Field label="Bid date" error={form.errors.bid_date}>
                        <input type="date" value={form.data.bid_date} onChange={(event) => form.setData('bid_date', event.target.value)} className={fieldClass} />
                    </Field>
                    <TermSelect
                        id="probability"
                        label="Probability"
                        kind="probability"
                        catalogKey="probabilities"
                        value={form.data.probability_id}
                        options={terms.probabilities}
                        error={form.errors.probability_id || form.errors.probability}
                        onChange={(id, option) => form.setData({ ...form.data, probability_id: id, probability: option?.name ?? '' })}
                    />
                    <Field label="Current value" error={form.errors.current_value}>
                        <MaskedDecimalInput id="current_value" value={form.data.current_value} onChange={(value) => form.setData('current_value', value)} prefix="$" className={fieldClass} />
                    </Field>
                    <Field label="Next follow-up" error={form.errors.next_follow_up_date}>
                        <input type="date" value={form.data.next_follow_up_date} onChange={(event) => form.setData('next_follow_up_date', event.target.value)} className={fieldClass} />
                    </Field>
                    <Field label="Next step" error={form.errors.next_step} className="md:col-span-2" asLabel={false}>
                        <RichTextEditor
                            id="next-step"
                            compact
                            showPlaceholders={false}
                            value={form.data.next_step}
                            onChange={(html) => form.setData('next_step', html)}
                            placeholder="What happens next"
                            error={form.errors.next_step}
                        />
                    </Field>
                    <Field label="Status note" error={form.errors.status_note} className="md:col-span-2" asLabel={false}>
                        <RichTextEditor
                            id="status-note"
                            compact
                            showPlaceholders={false}
                            value={form.data.status_note}
                            onChange={(html) => form.setData('status_note', html)}
                            placeholder="Status note"
                            error={form.errors.status_note}
                        />
                    </Field>
                </div>
            </section>

            <section className="rounded-lg border border-sky-200 bg-sky-50/70 p-4 dark:border-sky-900 dark:bg-sky-950/30 sm:p-6">
                <h3 className="text-lg font-semibold text-foreground">Cost, deposit, and cash</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                    Direct cost {money(direct)} · Profit {money(profit)} · Margin {margin === null ? '—' : `${margin.toFixed(2)}%`} · Deposit due {money(deposit)}
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <MoneyField label="Material / supplier" id="material_cost" value={form.data.material_cost} error={form.errors.material_cost} onChange={(value) => form.setData('material_cost', value)} />
                    <MoneyField label="Freight / handling" id="freight_cost" value={form.data.freight_cost} error={form.errors.freight_cost} onChange={(value) => form.setData('freight_cost', value)} />
                    <MoneyField label="Labor" id="labor_cost" value={form.data.labor_cost} error={form.errors.labor_cost} onChange={(value) => form.setData('labor_cost', value)} />
                    <MoneyField label="Other / contingency" id="other_cost" value={form.data.other_cost} error={form.errors.other_cost} onChange={(value) => form.setData('other_cost', value)} />
                    <Field label="Deposit %" error={form.errors.deposit_percent}>
                        <input value={form.data.deposit_percent} onChange={(event) => form.setData('deposit_percent', event.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" className={fieldClass} />
                    </Field>
                    <TermSelect
                        id="pricing-class"
                        label="Pricing class"
                        kind="pricing_class"
                        catalogKey="pricingClasses"
                        value={form.data.pricing_class_id}
                        options={terms.pricingClasses}
                        error={form.errors.pricing_class_id || form.errors.pricing_class}
                        onChange={(id, option) => form.setData({ ...form.data, pricing_class_id: id, pricing_class: option?.name ?? '' })}
                    />
                    <Field label="Bid due" error={form.errors.bid_due_date}>
                        <input type="date" value={form.data.bid_due_date} onChange={(event) => form.setData('bid_due_date', event.target.value)} className={fieldClass} />
                    </Field>
                    <TermSelect
                        id="lead-time"
                        label="Lead time"
                        kind="lead_time"
                        catalogKey="leadTimes"
                        value={form.data.lead_time_id}
                        options={terms.leadTimes}
                        error={form.errors.lead_time_id || form.errors.lead_time}
                        onChange={(id, option) => form.setData({ ...form.data, lead_time_id: id, lead_time: option?.name ?? '' })}
                    />
                    <Field label="Material payment" error={form.errors.material_payment_date}>
                        <input type="date" value={form.data.material_payment_date} onChange={(event) => form.setData('material_payment_date', event.target.value)} className={fieldClass} />
                    </Field>
                    <Field label="Customer payment" error={form.errors.customer_payment_date}>
                        <input type="date" value={form.data.customer_payment_date} onChange={(event) => form.setData('customer_payment_date', event.target.value)} className={fieldClass} />
                    </Field>
                    <TermSelect
                        id="bonding"
                        label="Bonding"
                        kind="bonding"
                        catalogKey="bondingOptions"
                        value={form.data.bonding_option_id}
                        options={terms.bondingOptions}
                        error={form.errors.bonding_option_id || form.errors.bonding_required}
                        onChange={(id, option) => form.setData({ ...form.data, bonding_option_id: id, bonding_required: option?.name ?? '' })}
                    />
                    <TermSelect
                        id="cash-flag"
                        label="Cash flag"
                        kind="cash_flag"
                        catalogKey="cashFlags"
                        value={form.data.cash_flag_id}
                        options={terms.cashFlags}
                        error={form.errors.cash_flag_id || form.errors.cash_flag}
                        onChange={(id, option) => form.setData({ ...form.data, cash_flag_id: id, cash_flag: option?.name ?? '' })}
                    />
                    <Field label="Assemblies" error={form.errors.assembly_count}>
                        <input value={form.data.assembly_count} onChange={(event) => form.setData('assembly_count', event.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" className={fieldClass} />
                    </Field>
                    <label className="flex items-center gap-2 pt-7 text-sm text-foreground">
                        <input
                            type="checkbox"
                            checked={form.data.counts_in_demonstrated}
                            onChange={(event) => form.setData('counts_in_demonstrated', event.target.checked)}
                            className="h-4 w-4 rounded border-border"
                        />
                        Counts in demonstrated value
                    </label>
                    <Field label="Payment plan" error={form.errors.payment_plan} className="md:col-span-2 xl:col-span-4" asLabel={false}>
                        <RichTextEditor
                            id="payment-plan"
                            compact
                            showPlaceholders={false}
                            value={form.data.payment_plan}
                            onChange={(html) => form.setData('payment_plan', html)}
                            placeholder="Payment plan"
                            error={form.errors.payment_plan}
                        />
                    </Field>
                    <Field label="Scope summary" error={form.errors.scope_summary} className="md:col-span-2 xl:col-span-4" asLabel={false}>
                        <RichTextEditor
                            id="scope-summary"
                            compact
                            showPlaceholders={false}
                            value={form.data.scope_summary}
                            onChange={(html) => form.setData('scope_summary', html)}
                            placeholder="Scope summary"
                            error={form.errors.scope_summary}
                        />
                    </Field>
                    <Field label="Current bid document" error={form.errors.bid_document} className="md:col-span-2 xl:col-span-4">
                        <input value={form.data.bid_document} onChange={(event) => form.setData('bid_document', event.target.value)} className={fieldClass} />
                    </Field>
                </div>
            </section>

            <LineSection
                title="Bid versions"
                description="Mark one version Current. A subset or superseded bid is kept here and stays out of the pipeline total."
                className="border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30"
                onAdd={() => form.setData('bids', [...form.data.bids, blankBid()])}
            >
                {form.data.bids.map((bid, index) => (
                    <div key={index} className="grid gap-3 border-t border-border py-4 md:grid-cols-4">
                        <Field label="Version">
                            <input value={bid.name} onChange={(event) => updateBid(form, index, { name: event.target.value })} className={fieldClass} />
                        </Field>
                        <Field label="Date">
                            <input type="date" value={bid.quoted_on} onChange={(event) => updateBid(form, index, { quoted_on: event.target.value })} className={fieldClass} />
                        </Field>
                        <Field label="Amount">
                            <input value={bid.amount} onChange={(event) => updateBid(form, index, { amount: event.target.value.replace(/[^0-9.]/g, '') })} inputMode="decimal" className={fieldClass} />
                        </Field>
                        <Field label="Standing">
                            <select value={bid.standing} onChange={(event) => updateBid(form, index, { standing: event.target.value })} className={fieldClass}>
                                <option value="current">Current</option>
                                <option value="subset">Subset</option>
                                <option value="superseded">Superseded</option>
                                <option value="historical">Historical</option>
                            </select>
                        </Field>
                        <Field label="Double-count rule" className="md:col-span-2">
                            <input value={bid.count_rule} onChange={(event) => updateBid(form, index, { count_rule: event.target.value })} className={fieldClass} />
                        </Field>
                        <Field label="Document" className="md:col-span-2">
                            <input value={bid.document} onChange={(event) => updateBid(form, index, { document: event.target.value })} className={fieldClass} />
                        </Field>
                        <Field label="Notes" className="md:col-span-3">
                            <input value={bid.notes} onChange={(event) => updateBid(form, index, { notes: event.target.value })} className={fieldClass} />
                        </Field>
                        <div className="flex items-end">
                            <Button type="button" variant="destructive" onClick={() => form.setData('bids', form.data.bids.filter((_, item) => item !== index))}>
                                <Trash2Icon className="h-4 w-4" />
                                Remove
                            </Button>
                        </div>
                        <InputError message={lineError('bids', index)} className="md:col-span-4" />
                    </div>
                ))}
            </LineSection>

            <LineSection
                title="Openings"
                description="Every opening on the project takeoff is listed here and stays linked. A saved line opens that takeoff. These prices do not change the pipeline value."
                className="border-violet-200 bg-violet-50/70 dark:border-violet-900 dark:bg-violet-950/30"
                onAdd={() => form.setData('openings', [...form.data.openings, blankOpening()])}
            >
                {form.data.openings.map((opening, index) => (
                    <div key={index} className="grid gap-3 border-t border-border py-4 md:grid-cols-4">
                        <Field label="Description" className="md:col-span-2">
                            <input value={opening.description} onChange={(event) => updateOpening(form, index, { description: event.target.value })} className={fieldClass} />
                        </Field>
                        <TermSelect
                            id={`opening-category-${index}`}
                            label="Category"
                            kind="opening_category"
                            catalogKey="openingCategories"
                            value={opening.category_id}
                            options={terms.openingCategories}
                            onChange={(id, option) => updateOpening(form, index, { category_id: id, category: option?.name ?? '' })}
                        />
                        <Field label="Mark / building">
                            <input value={opening.mark} onChange={(event) => updateOpening(form, index, { mark: event.target.value })} className={fieldClass} />
                        </Field>
                        <Field label="Size">
                            <input value={opening.size} onChange={(event) => updateOpening(form, index, { size: event.target.value })} className={fieldClass} />
                        </Field>
                        <Field label="Qty">
                            <input value={opening.quantity} onChange={(event) => updateOpening(form, index, { quantity: event.target.value.replace(/[^0-9.]/g, '') })} inputMode="decimal" className={fieldClass} />
                        </Field>
                        <Field label="Requirement">
                            <input value={opening.requirement} onChange={(event) => updateOpening(form, index, { requirement: event.target.value })} className={fieldClass} />
                        </Field>
                        <TermSelect
                            id={`opening-procurement-${index}`}
                            label="Procurement status"
                            kind="procurement_status"
                            catalogKey="procurementStatuses"
                            value={opening.procurement_status_id}
                            options={terms.procurementStatuses}
                            onChange={(id, option) => updateOpening(form, index, { procurement_status_id: id, procurement_status: option?.name ?? '' })}
                        />
                        <Field label="Supplier">
                            <input value={opening.supplier} onChange={(event) => updateOpening(form, index, { supplier: event.target.value })} className={fieldClass} />
                        </Field>
                        <Field label="Unit sell">
                            <input value={opening.unit_sell} onChange={(event) => updateOpening(form, index, { unit_sell: event.target.value.replace(/[^0-9.]/g, '') })} inputMode="decimal" className={fieldClass} />
                        </Field>
                        <Field label="Hardware" className="md:col-span-2">
                            <input value={opening.hardware} onChange={(event) => updateOpening(form, index, { hardware: event.target.value })} className={fieldClass} />
                        </Field>
                        <Field label="Still needed" className="md:col-span-2">
                            <input value={opening.additional_needed} onChange={(event) => updateOpening(form, index, { additional_needed: event.target.value })} className={fieldClass} />
                        </Field>
                        <Field label="Notes" className="md:col-span-3">
                            <input value={opening.notes} onChange={(event) => updateOpening(form, index, { notes: event.target.value })} className={fieldClass} />
                        </Field>
                        <div className="flex flex-wrap items-end gap-2 md:col-span-4">
                            {opening.id && control.uuid ? (
                                <Button asChild className={`${takeoffButtonClass} min-h-11 w-full sm:w-auto`}>
                                    <Link href={route('admin.project-control.openings.takeoff', [control.uuid, opening.id])}>
                                        <RulerIcon className="h-4 w-4" />
                                        Takeoff
                                    </Link>
                                </Button>
                            ) : (
                                <Button type="button" disabled className="min-h-11 w-full bg-sky-600/50 text-white sm:w-auto">
                                    <RulerIcon className="h-4 w-4" />
                                    Save to open takeoff
                                </Button>
                            )}
                            <Button type="button" variant="destructive" className="min-h-11 w-full sm:w-auto" onClick={() => form.setData('openings', form.data.openings.filter((_, item) => item !== index))}>
                                <Trash2Icon className="h-4 w-4" />
                                Remove
                            </Button>
                        </div>
                        <InputError message={lineError('openings', index)} className="md:col-span-4" />
                    </div>
                ))}
            </LineSection>

            <LineSection
                title="Procurement"
                description="Supplier quotes and purchase orders. A line with no PO stays on the unordered list."
                className="border-orange-200 bg-orange-50/70 dark:border-orange-900 dark:bg-orange-950/30"
                onAdd={() => form.setData('procurements', [...form.data.procurements, blankProcurement()])}
            >
                {form.data.procurements.map((procurement, index) => (
                    <div key={index} className="grid gap-3 border-t border-border py-4 md:grid-cols-4">
                        <Field label="Assembly" className="md:col-span-2">
                            <input value={procurement.assembly} onChange={(event) => updateProcurement(form, index, { assembly: event.target.value })} className={fieldClass} />
                        </Field>
                        <Field label="Qty">
                            <input value={procurement.quantity} onChange={(event) => updateProcurement(form, index, { quantity: event.target.value.replace(/[^0-9.]/g, '') })} inputMode="decimal" className={fieldClass} />
                        </Field>
                        <Field label="Manufacturer">
                            <input value={procurement.manufacturer} onChange={(event) => updateProcurement(form, index, { manufacturer: event.target.value })} className={fieldClass} />
                        </Field>
                        <Field label="Quote number">
                            <input value={procurement.quote_number} onChange={(event) => updateProcurement(form, index, { quote_number: event.target.value })} className={fieldClass} />
                        </Field>
                        <Field label="Quote date">
                            <input type="date" value={procurement.quoted_on} onChange={(event) => updateProcurement(form, index, { quoted_on: event.target.value })} className={fieldClass} />
                        </Field>
                        <Field label="Supplier cost">
                            <input value={procurement.supplier_cost} onChange={(event) => updateProcurement(form, index, { supplier_cost: event.target.value.replace(/[^0-9.]/g, '') })} inputMode="decimal" className={fieldClass} />
                        </Field>
                        <TermSelect
                            id={`procurement-order-${index}`}
                            label="Order status"
                            kind="order_status"
                            catalogKey="orderStatuses"
                            value={procurement.order_status_id}
                            options={terms.orderStatuses}
                            onChange={(id, option) => updateProcurement(form, index, { order_status_id: id, order_status: option?.name ?? '' })}
                        />
                        <Field label="PO number">
                            <input value={procurement.po_number} onChange={(event) => updateProcurement(form, index, { po_number: event.target.value })} className={fieldClass} />
                        </Field>
                        <TermSelect
                            id={`procurement-lead-${index}`}
                            label="Lead time"
                            kind="lead_time"
                            catalogKey="leadTimes"
                            value={procurement.lead_time_id}
                            options={terms.leadTimes}
                            onChange={(id, option) => updateProcurement(form, index, { lead_time_id: id, lead_time: option?.name ?? '' })}
                        />
                        <Field label="Next action" className="md:col-span-3">
                            <input value={procurement.next_action} onChange={(event) => updateProcurement(form, index, { next_action: event.target.value })} className={fieldClass} />
                        </Field>
                        <div className="flex items-end">
                            <Button type="button" variant="destructive" onClick={() => form.setData('procurements', form.data.procurements.filter((_, item) => item !== index))}>
                                <Trash2Icon className="h-4 w-4" />
                                Remove
                            </Button>
                        </div>
                        <InputError message={lineError('procurements', index)} className="md:col-span-4" />
                    </div>
                ))}
            </LineSection>

            <section className="rounded-lg border border-rose-200 bg-rose-50/70 p-4 dark:border-rose-900 dark:bg-rose-950/30 sm:p-6">
                <h3 className="text-lg font-semibold text-foreground">Follow-up reminder</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                    Leave the date blank to save the job without a new reminder. A filled date is sent to the people you choose.
                </p>
                <div className="mt-4 grid gap-4">
                    <Field label="When" error={form.errors.remind_at}>
                        <input
                            type="datetime-local"
                            value={form.data.remind_at}
                            onChange={(event) => form.setData('remind_at', event.target.value)}
                            className={fieldClass}
                        />
                    </Field>
                    <Field label="Reminder note" error={form.errors.reminder_note}>
                        <input
                            value={form.data.reminder_note}
                            onChange={(event) => form.setData('reminder_note', event.target.value)}
                            className={fieldClass}
                            placeholder="What should they remember?"
                        />
                    </Field>
                    <fieldset>
                        <legend className="text-sm font-medium text-foreground">How should they be notified?</legend>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <NotifyChoice
                                pressed={form.data.notify_popup}
                                icon={<BellIcon className="size-4" />}
                                title="Popup in Gateway"
                                detail="Shows while they are signed in."
                                onClick={() => form.setData('notify_popup', !form.data.notify_popup)}
                            />
                            <NotifyChoice
                                pressed={form.data.notify_email}
                                icon={<MailIcon className="size-4" />}
                                title="Personal email"
                                detail="Sent from each person's Microsoft 365 mailbox."
                                onClick={() => form.setData('notify_email', !form.data.notify_email)}
                            />
                        </div>
                        <InputError message={form.errors.notify_popup || form.errors.notify_email} className="mt-1" />
                    </fieldset>
                    <fieldset>
                        <legend className="text-sm font-medium text-foreground">Who</legend>
                        <div className="mt-2 max-h-40 space-y-2 overflow-auto rounded-md border border-rose-200 bg-background p-2 dark:border-rose-900">
                            {people.map((person) => (
                                <label key={person.id} className="flex items-start gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={form.data.reminder_user_ids.includes(person.id)}
                                        onChange={() => toggleReminderPerson(person.id)}
                                        className="mt-1 h-4 w-4 rounded border-border"
                                    />
                                    <span>
                                        <span className="font-medium text-foreground">{person.name}</span>
                                        <span className="block text-muted-foreground">
                                            {person.email || 'No personal email'}
                                            {person.mailbox ? ' · Microsoft 365 ready' : ' · No Microsoft 365 mailbox'}
                                        </span>
                                    </span>
                                </label>
                            ))}
                        </div>
                        <InputError message={form.errors.reminder_user_ids} className="mt-1" />
                        {emailBlocked ? (
                            <p className="mt-1 text-sm text-destructive">
                                Email needs a personal address and a Microsoft 365 mailbox for every person selected.
                            </p>
                        ) : null}
                    </fieldset>
                </div>
            </section>

            {control.uuid ? (
                <div>
                    <Button type="button" variant="destructive" onClick={() => setConfirmingDelete(true)}>
                        <Trash2Icon className="h-4 w-4" />
                        Remove job
                    </Button>
                </div>
            ) : null}

            <FormActionFab cancelHref={route('admin.project-control.index')} form="project-control-form" disabled={form.processing || emailBlocked} />
        </form>

            <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove this job?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This removes the job, its bid versions, openings, and procurement lines from project control.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Close</AlertDialogCancel>
                        <AlertDialogAction onClick={removeJob} disabled={deleting}>
                            Remove job
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

function Field({
    label,
    error,
    className,
    asLabel = true,
    children,
}: {
    label: string;
    error?: string;
    className?: string;
    asLabel?: boolean;
    children: ReactNode;
}) {
    const Tag = asLabel ? 'label' : 'div';

    return (
        <Tag className={`block text-sm font-medium text-foreground ${className ?? ''}`}>
            {label}
            <div className="mt-1 font-normal">{children}</div>
            <InputError message={error} className="mt-1" />
        </Tag>
    );
}

function MoneyField({
    label,
    id,
    value,
    error,
    onChange,
}: {
    label: string;
    id: string;
    value: string;
    error?: string;
    onChange: (value: string) => void;
}) {
    return (
        <Field label={label} error={error}>
            <MaskedDecimalInput id={id} value={value} onChange={onChange} prefix="$" className={fieldClass} />
        </Field>
    );
}

function LineSection({
    title,
    description,
    className,
    onAdd,
    children,
}: {
    title: string;
    description: string;
    className: string;
    onAdd: () => void;
    children: ReactNode;
}) {
    return (
        <section className={`rounded-lg border p-4 sm:p-6 ${className}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                </div>
                <Button type="button" className={`${addButtonClass} min-h-11 w-full sm:w-auto`} onClick={onAdd}>
                    <PlusIcon className="h-4 w-4" />
                    Add
                </Button>
            </div>
            <div>{children}</div>
        </section>
    );
}

function NotifyChoice({
    pressed,
    icon,
    title,
    detail,
    onClick,
}: {
    pressed: boolean;
    icon: ReactNode;
    title: string;
    detail: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            aria-pressed={pressed}
            onClick={onClick}
            className={
                pressed
                    ? 'rounded-xl border border-rose-700 bg-rose-100 p-3 text-left dark:bg-rose-950/50'
                    : 'rounded-xl border border-border bg-background p-3 text-left hover:bg-muted'
            }
        >
            <span className="flex items-center gap-2 font-medium text-foreground">
                {icon}
                {title}
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">{detail}</span>
        </button>
    );
}

function TermSelect({
    id,
    label,
    kind,
    catalogKey,
    value,
    options,
    error,
    onChange,
}: {
    id: string;
    label: string;
    kind: string;
    catalogKey: keyof ControlTerms;
    value: string;
    options: CreatableOption[];
    error?: string;
    onChange: (id: string, option?: CreatableOption) => void;
}) {
    return (
        <CreatableSelect
            id={id}
            label={label}
            compact
            value={value}
            options={options}
            createRoute={route('admin.project-control.terms.store')}
            optionsProp="terms"
            catalogKey={catalogKey}
            createExtras={{ kind }}
            entityLabel={label.toLowerCase()}
            placeholder="Type to search or add"
            error={error}
            onChange={onChange}
        />
    );
}

function updateBid(
    form: { data: ControlDraft; setData: (key: 'bids', value: BidDraft[]) => void },
    index: number,
    patch: Partial<BidDraft>,
) {
    form.setData('bids', form.data.bids.map((bid, item) => (item === index ? { ...bid, ...patch } : bid)));
}

function updateOpening(
    form: { data: ControlDraft; setData: (key: 'openings', value: OpeningDraft[]) => void },
    index: number,
    patch: Partial<OpeningDraft>,
) {
    form.setData('openings', form.data.openings.map((opening, item) => (item === index ? { ...opening, ...patch } : opening)));
}

function updateProcurement(
    form: { data: ControlDraft; setData: (key: 'procurements', value: ProcurementDraft[]) => void },
    index: number,
    patch: Partial<ProcurementDraft>,
) {
    form.setData('procurements', form.data.procurements.map((procurement, item) => (item === index ? { ...procurement, ...patch } : procurement)));
}
