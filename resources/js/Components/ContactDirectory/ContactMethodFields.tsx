import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import { phoneCountries, formatPhoneNumber } from '@/Components/PhoneInput';
import UserContactFields, { type UserContactRow } from '@/Pages/Admin/Users/Partials/UserContactFields';

export type PhoneRecord = { id: number; country: string | null; phone_number: string; label: string; extension: string | null; is_primary: boolean };
export type EmailRecord = { id: number; email_address: string; label: string; is_primary: boolean };
type MethodField = 'phones' | 'emails';

export function phoneRow(phone: PhoneRecord): UserContactRow {
    if (!phone.country) return { id: phone.id, value: phone.phone_number, country: '', label: phone.label, extension: phone.extension ?? '', is_primary: phone.is_primary };
    const country = phoneCountries.find((item) => item.code === phone.country);
    let value = phone.phone_number.replace(/\D/g, '');
    if (country && phone.phone_number.startsWith('+') && value.startsWith(country.dial)) {
        value = value.slice(country.dial.length);
        if (['GB', 'DE'].includes(country.code)) value = `0${value}`;
    }
    return { id: phone.id, value: formatPhoneNumber(value, phone.country), country: phone.country, label: phone.label, extension: phone.extension ?? '', is_primary: phone.is_primary };
}

export function withPrimary(rows: UserContactRow[]): UserContactRow[] {
    const selected = Math.max(0, rows.findIndex((row) => row.is_primary));
    return rows.map((row, index) => ({ ...row, is_primary: index === selected }));
}

export function emailRows(emails: EmailRecord[]): UserContactRow[] {
    return withPrimary(emails.map((email) => ({ id: email.id, value: email.email_address, label: email.label, is_primary: email.is_primary })));
}

function normalizePhoneRows(rows: UserContactRow[]): UserContactRow[] {
    return rows.map((row) => {
        if (!row.country || !row.value.startsWith('+')) return row;
        const country = phoneCountries.find((item) => item.code === row.country);
        if (!country) return row;
        let digits = row.value.replace(/\D/g, '');
        // Adopt legacy international values only after an explicit country choice.
        if (!digits.startsWith(country.dial)) return { ...row, value: '' };
        digits = digits.slice(country.dial.length);
        if (['GB', 'DE'].includes(country.code)) digits = `0${digits}`;
        return { ...row, value: formatPhoneNumber(digits, country.code) };
    });
}

export function contactMethodsPayload(phones: UserContactRow[], emails: UserContactRow[]) {
    return {
        phone_numbers: phones.map((phone) => ({
            id: phone.id, phone_number: phone.value.trim(), country: phone.country || null,
            label: phone.label || 'office', extension: phone.extension || null, is_primary: phone.is_primary,
        })),
        email_addresses: emails.map((email) => ({
            id: email.id, email_address: email.value.trim(), label: email.label || 'main', is_primary: email.is_primary,
        })),
    };
}

export default function ContactMethodFields({ phones, emails, setRows, errors }: {
    phones: UserContactRow[]; emails: UserContactRow[];
    setRows: (field: MethodField, rows: UserContactRow[]) => void;
    errors: Record<string, string | undefined>;
}) {
    const contactErrors: Record<string, string | undefined> = {};
    Object.entries(errors).forEach(([key, value]) => {
        contactErrors[key.replace(/^phone_numbers/, 'phones').replace(/\.phone_number$/, '.value').replace(/^email_addresses/, 'emails').replace(/\.email_address$/, '.value')] = value;
    });
    const inputClass = 'h-11 w-full min-w-0 border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring';
    const rowDetails = (field: MethodField, row: UserContactRow, index: number) => {
        const rows = field === 'phones' ? phones : emails;
        return <div className="grid min-w-0 gap-3 pb-2 sm:grid-cols-2">
            <div className="space-y-1">
                <InputLabel htmlFor={`${field}-label-${index}`} value="Label" />
                <TextInput id={`${field}-label-${index}`} value={row.label ?? (field === 'phones' ? 'office' : 'main')} maxLength={255} className={inputClass} onChange={(event) => setRows(field, rows.map((item, i) => i === index ? { ...item, label: event.target.value } : item))} />
                <InputError message={contactErrors[`${field}.${index}.label`]} />
            </div>
            {field === 'phones' && <div className="space-y-1">
                <InputLabel htmlFor={`phone-extension-${index}`} value="Extension (optional)" />
                <TextInput id={`phone-extension-${index}`} inputMode="numeric" maxLength={10} value={row.extension ?? ''} className={inputClass} onChange={(event) => setRows('phones', phones.map((item, i) => i === index ? { ...item, extension: event.target.value.replace(/\D/g, '') } : item))} />
                <InputError message={contactErrors[`phones.${index}.extension`]} />
            </div>}
            <InputError message={contactErrors[`${field}.${index}.country`] || contactErrors[`${field}.${index}.id`] || contactErrors[`${field}.${index}.is_primary`]} />
        </div>;
    };
    return <section className="grid min-w-0 gap-5 xl:grid-cols-2">
        <UserContactFields legend="Phone numbers" description="Select the country code first, enter the national number, then choose a primary phone." addLabel="Add phone" placeholder="Phone number" inputType="tel" field="phones" rows={phones} onChange={(rows) => setRows('phones', normalizePhoneRows(rows))} errors={contactErrors} maxRows={10} preserveLegacyPhone stackPhonesOnMobile renderDetails={(row, index) => rowDetails('phones', row, index)} />
        <UserContactFields legend="Email addresses" description="Add addresses and select the primary address used by default for email." addLabel="Add email" placeholder="name@example.com" inputType="email" field="emails" rows={emails} onChange={(rows) => setRows('emails', rows)} errors={contactErrors} maxRows={10} renderDetails={(row, index) => rowDetails('emails', row, index)} />
    </section>;
}
