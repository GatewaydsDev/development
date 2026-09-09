import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import { Badge } from '@/Components/ui/badge';

export type CustomerSelectOption = {
    id: number;
    name: string;
    company_name: string | null;
    email: string | null;
    phone_number: string | null;
    address_line_1: string | null;
    address_line_2: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    country: string | null;
    contacts: Array<{
        id: number;
        name: string;
        title: string | null;
        email: string | null;
        phone_number: string | null;
        is_primary: boolean;
    }>;
};

type CustomerSelectProps = {
    customers: CustomerSelectOption[];
    value: string;
    onChange: (value: string) => void;
    error?: string;
    disabled?: boolean;
};

function DetailItem({
    label,
    value,
}: {
    label: string;
    value?: string | null;
}) {
    return (
        <div className="min-w-0">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
            </dt>
            <dd className="mt-0.5 truncate text-sm font-medium text-foreground">
                {value || 'Not added yet'}
            </dd>
        </div>
    );
}

export default function CustomerSelect({
    customers,
    value,
    onChange,
    error,
    disabled = false,
}: CustomerSelectProps) {
    const selectedCustomer = customers.find(
        (customer) => String(customer.id) === value,
    );
    const primaryContact =
        selectedCustomer?.contacts.find((contact) => contact.is_primary) ??
        selectedCustomer?.contacts[0];
    const address = selectedCustomer
        ? [
              selectedCustomer.address_line_1,
              selectedCustomer.address_line_2,
              selectedCustomer.city,
              selectedCustomer.state,
              selectedCustomer.postal_code,
              selectedCustomer.country,
          ]
              .filter(Boolean)
              .join(', ')
        : null;

    return (
        <section className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
            <div className="flex flex-col gap-2">
                <InputLabel
                    htmlFor="customer-id"
                    value="Customer name"
                    className="text-emerald-700 dark:text-emerald-300"
                />
                <select
                    id="customer-id"
                    value={value}
                    disabled={disabled}
                    onChange={(event) => onChange(event.target.value)}
                    className="h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-70"
                >
                    <option value="">Select a customer</option>
                    {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                            {customer.name}
                            {customer.company_name
                                ? ` - ${customer.company_name}`
                                : ''}
                        </option>
                    ))}
                </select>
                <InputError message={error} />
            </div>

            {selectedCustomer ? (
                <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-background/80 p-3 dark:border-emerald-900/70">
                    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
                        <DetailItem
                            label="Customer"
                            value={selectedCustomer.name}
                        />
                        <DetailItem
                            label="Company"
                            value={selectedCustomer.company_name}
                        />
                        <DetailItem
                            label="Primary email"
                            value={
                                primaryContact?.email ?? selectedCustomer.email
                            }
                        />
                        <DetailItem
                            label="Primary phone"
                            value={
                                primaryContact?.phone_number ??
                                selectedCustomer.phone_number
                            }
                        />
                        <DetailItem label="Address" value={address} />
                    </dl>

                    <div className="flex flex-col gap-2 border-t border-border pt-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Customer contacts
                        </h3>
                        {selectedCustomer.contacts.length > 0 ? (
                            <div className="grid gap-2 lg:grid-cols-2">
                                {selectedCustomer.contacts.map((contact) => (
                                    <div
                                        key={contact.id}
                                        className="rounded-md border border-border bg-muted/30 px-3 py-2"
                                    >
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                            <p className="text-sm font-medium text-foreground">
                                                {contact.name}
                                            </p>
                                            {contact.is_primary && (
                                                <Badge
                                                    variant="outline"
                                                    className="h-5 px-1.5 text-[11px]"
                                                >
                                                    Primary
                                                </Badge>
                                            )}
                                            {contact.title && (
                                                <span className="text-xs text-muted-foreground">
                                                    {contact.title}
                                                </span>
                                            )}
                                        </div>
                                        <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                                            <DetailItem
                                                label="Email"
                                                value={contact.email}
                                            />
                                            <DetailItem
                                                label="Phone"
                                                value={contact.phone_number}
                                            />
                                        </dl>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                                This customer does not have contacts yet.
                            </p>
                        )}
                    </div>
                </div>
            ) : (
                <p className="rounded-lg border border-emerald-200 bg-background p-4 text-sm text-muted-foreground dark:border-emerald-900/70">
                    Customer is optional. Select one to review contact
                    information before saving the project.
                </p>
            )}
        </section>
    );
}

