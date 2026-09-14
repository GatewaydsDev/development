import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PhoneInput from '@/Components/PhoneInput';
import TextInput from '@/Components/TextInput';
import { cn } from '@/lib/utils';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

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

export type CustomerContactFields = {
    customer_id: string;
    company_name: string;
    email: string;
    phone_number: string;
};

type CustomerSelectProps = {
    customers: CustomerSelectOption[];
    value: CustomerContactFields;
    onChange: (value: CustomerContactFields) => void;
    errors?: {
        customer_id?: string;
        company_name?: string;
        email?: string;
        phone_number?: string;
    };
    disabled?: boolean;
};

export function customerCompanyName(customer: CustomerSelectOption): string {
    return customer.company_name?.trim() || customer.name?.trim() || '';
}

export function customerEmail(customer: CustomerSelectOption): string {
    const primary =
        customer.contacts.find((contact) => contact.is_primary) ??
        customer.contacts[0];

    return primary?.email?.trim() || customer.email?.trim() || '';
}

export function customerPhone(customer: CustomerSelectOption): string {
    const primary =
        customer.contacts.find((contact) => contact.is_primary) ??
        customer.contacts[0];

    return primary?.phone_number?.trim() || customer.phone_number?.trim() || '';
}

export default function CustomerSelect({
    customers,
    value,
    onChange,
    errors,
    disabled = false,
}: CustomerSelectProps) {
    const listboxId = useId();
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const selectedCustomer = customers.find(
        (customer) => String(customer.id) === value.customer_id,
    );
    const selectedCompany = selectedCustomer
        ? customerCompanyName(selectedCustomer)
        : value.company_name;
    const [query, setQuery] = useState(selectedCompany);
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    const normalizedQuery = query.trim();

    const filteredCustomers = useMemo(() => {
        const isFiltering =
            normalizedQuery !== '' &&
            normalizedQuery.toLowerCase() !== selectedCompany.toLowerCase();

        return customers
            .filter((customer) => {
                if (!isFiltering) {
                    return true;
                }

                return customerCompanyName(customer)
                    .toLowerCase()
                    .includes(normalizedQuery.toLowerCase());
            })
            .sort((left, right) =>
                customerCompanyName(left).localeCompare(
                    customerCompanyName(right),
                ),
            );
    }, [customers, normalizedQuery, selectedCompany]);

    useEffect(() => {
        setQuery(selectedCompany);
    }, [selectedCompany, value.customer_id]);

    useEffect(() => {
        setHighlightedIndex(0);
    }, [query, isOpen]);

    const applyCustomer = (customer: CustomerSelectOption) => {
        onChange({
            customer_id: String(customer.id),
            company_name: customerCompanyName(customer),
            email: customerEmail(customer),
            phone_number: customerPhone(customer),
        });
        setQuery(customerCompanyName(customer));
        setIsOpen(false);
    };

    const applyCompanyName = (companyName: string) => {
        const match = customers.find(
            (customer) =>
                customerCompanyName(customer).toLowerCase() ===
                companyName.trim().toLowerCase(),
        );

        if (match) {
            applyCustomer(match);
            return;
        }

        onChange({
            ...value,
            customer_id: '',
            company_name: companyName,
        });
        setQuery(companyName);
    };

    useEffect(() => {
        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node | null;

            if (target && containerRef.current?.contains(target)) {
                return;
            }

            setIsOpen(false);
        };

        document.addEventListener('pointerdown', handlePointerDown);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
        };
    }, []);

    const highlightOption = (index: number) => {
        if (filteredCustomers.length === 0) {
            return;
        }

        const nextIndex =
            (index + filteredCustomers.length) % filteredCustomers.length;
        setHighlightedIndex(nextIndex);
        document
            .getElementById(`${listboxId}-option-${nextIndex}`)
            ?.scrollIntoView({ block: 'nearest' });
    };

    return (
        <div className="grid gap-4 md:grid-cols-2">
            <div ref={containerRef} className="flex flex-col gap-2">
                <InputLabel
                    htmlFor="customer-company-name"
                    value="Company name"
                    className="text-emerald-700 dark:text-emerald-300"
                />
                <div className="relative">
                    <TextInput
                        ref={inputRef}
                        id="customer-company-name"
                        role="combobox"
                        aria-autocomplete="list"
                        aria-expanded={isOpen}
                        aria-controls={listboxId}
                        aria-activedescendant={
                            isOpen && filteredCustomers.length > 0
                                ? `${listboxId}-option-${highlightedIndex}`
                                : undefined
                        }
                        value={query}
                        disabled={disabled}
                        autoComplete="off"
                        placeholder="Type a company name"
                        className="h-11 w-full border-border bg-background pr-10 text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
                        onFocus={() => {
                            setIsOpen(true);
                            window.requestAnimationFrame(() => {
                                inputRef.current?.select();
                            });
                        }}
                        onChange={(event) => {
                            const nextValue = event.target.value;
                            setQuery(nextValue);
                            setIsOpen(true);
                            applyCompanyName(nextValue);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'ArrowDown') {
                                event.preventDefault();
                                setIsOpen(true);
                                highlightOption(
                                    isOpen ? highlightedIndex + 1 : 0,
                                );
                                return;
                            }

                            if (event.key === 'ArrowUp') {
                                event.preventDefault();
                                setIsOpen(true);
                                highlightOption(highlightedIndex - 1);
                                return;
                            }

                            if (event.key === 'Enter') {
                                event.preventDefault();
                                const customer =
                                    filteredCustomers[highlightedIndex];

                                if (isOpen && customer) {
                                    applyCustomer(customer);
                                }

                                setIsOpen(false);
                                return;
                            }

                            if (event.key === 'Escape') {
                                event.preventDefault();
                                setIsOpen(false);
                                setQuery(selectedCompany);
                            }
                        }}
                    />
                    <ChevronDownIcon
                        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden
                    />
                    {isOpen && (
                        <div
                            id={listboxId}
                            role="listbox"
                            className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-background py-1 shadow-lg"
                        >
                            {filteredCustomers.map((customer, index) => {
                                const company = customerCompanyName(customer);
                                const isSelected =
                                    String(customer.id) === value.customer_id;

                                return (
                                    <button
                                        key={customer.id}
                                        id={`${listboxId}-option-${index}`}
                                        type="button"
                                        role="option"
                                        aria-selected={isSelected}
                                        className={cn(
                                            'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-foreground',
                                            highlightedIndex === index &&
                                                'bg-emerald-50 dark:bg-emerald-950/40',
                                        )}
                                        onMouseEnter={() =>
                                            setHighlightedIndex(index)
                                        }
                                        onMouseDown={(event) => {
                                            event.preventDefault();
                                        }}
                                        onClick={() => applyCustomer(customer)}
                                    >
                                        <span className="min-w-0 truncate">
                                            {company || 'Untitled company'}
                                        </span>
                                        {isSelected ? (
                                            <CheckIcon className="size-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                                        ) : null}
                                    </button>
                                );
                            })}
                            {filteredCustomers.length === 0 ? (
                                <p className="px-3 py-2 text-sm text-muted-foreground">
                                    {normalizedQuery
                                        ? `“${normalizedQuery}” will be saved as a new company.`
                                        : 'No saved companies yet.'}
                                </p>
                            ) : null}
                        </div>
                    )}
                </div>
                <InputError
                    message={errors?.company_name || errors?.customer_id}
                />
            </div>

            <div className="flex flex-col gap-2">
                <InputLabel
                    htmlFor="customer-phone-number"
                    value="Phone number"
                    className="text-emerald-700 dark:text-emerald-300"
                />
                <PhoneInput
                    id="customer-phone-number"
                    value={value.phone_number}
                    disabled={disabled}
                    className="h-11 w-full border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
                    onValueChange={(phoneNumber) =>
                        onChange({
                            ...value,
                            phone_number: phoneNumber,
                        })
                    }
                />
                <InputError message={errors?.phone_number} />
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
                <InputLabel
                    htmlFor="customer-email"
                    value="Email address"
                    className="text-emerald-700 dark:text-emerald-300"
                />
                <TextInput
                    id="customer-email"
                    type="email"
                    value={value.email}
                    disabled={disabled}
                    autoComplete="email"
                    placeholder="name@company.com"
                    className="h-11 w-full border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
                    onChange={(event) =>
                        onChange({
                            ...value,
                            email: event.target.value,
                        })
                    }
                />
                <InputError message={errors?.email} />
            </div>
        </div>
    );
}
