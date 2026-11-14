import { AsYouType, parsePhoneNumberFromString } from 'libphonenumber-js/min';

export const phoneCountries = [
    { code: 'US', name: 'USA', dial: '1', nationalDigits: 10 },
    { code: 'CA', name: 'Canada', dial: '1', nationalDigits: 10 },
    { code: 'MX', name: 'Mexico', dial: '52', nationalDigits: 10 },
    { code: 'GB', name: 'UK', dial: '44', nationalDigits: 11 },
    { code: 'PR', name: 'Puerto Rico', dial: '1', nationalDigits: 10 },
    { code: 'DO', name: 'Dominican Republic', dial: '1', nationalDigits: 10 },
    { code: 'BR', name: 'Brazil', dial: '55', nationalDigits: 11 },
    { code: 'ES', name: 'Spain', dial: '34', nationalDigits: 9 },
    { code: 'FR', name: 'France', dial: '33', nationalDigits: 9 },
    { code: 'DE', name: 'Germany', dial: '49', nationalDigits: 11 },
    { code: 'AU', name: 'Australia', dial: '61', nationalDigits: 9 },
    { code: 'IN', name: 'India', dial: '91', nationalDigits: 10 },
    { code: 'PH', name: 'Philippines', dial: '63', nationalDigits: 10 },
] as const;

export type PhoneCountryCode = (typeof phoneCountries)[number]['code'];
export const nanpCountries = new Set(['US', 'CA', 'PR', 'DO']);
const trunkCountries = new Set(['GB', 'FR', 'DE', 'AU']);

export function phoneCountry(code?: string | null) {
    return phoneCountries.find((country) => country.code === code) ?? phoneCountries[0];
}

export function getPhoneDigits(value: string, maxDigits = 10): string {
    return value.replace(/\D/g, '').slice(0, maxDigits);
}

function nanpMask(digits: string): string {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Mask the national input; the country code remains in its separate selector. */
export function formatPhoneNumber(value: string, countryCode?: string | null): string {
    const country = phoneCountry(countryCode);
    let digits = value.replace(/\D/g, '');
    if (value.trim().startsWith('+')) {
        // Never reinterpret an explicitly different international code.
        if (!digits.startsWith(country.dial)) return value;
        digits = digits.slice(country.dial.length);
        if (['GB', 'DE'].includes(country.code) && digits && !digits.startsWith('0')) digits = `0${digits}`;
    } else if (nanpCountries.has(country.code) && digits.length === 11 && digits.startsWith('1')) {
        digits = digits.slice(1);
    }
    const hasTrunk = trunkCountries.has(country.code) && digits.startsWith('0');
    const extraTrunk = hasTrunk && ['FR', 'AU'].includes(country.code) ? 1 : 0;
    digits = digits.slice(0, country.nationalDigits + extraTrunk);
    if (!digits) return '';
    if (nanpCountries.has(country.code)) return nanpMask(digits);
    const national = hasTrunk ? digits.slice(1) : digits;
    if (!national) return '0';
    const international = new AsYouType().input(`+${country.dial}${national}`);
    return `${hasTrunk ? '0' : ''}${international.slice(country.dial.length + 1).trimStart()}`;
}

/** Presentation only: do not replace stored values or tel: destinations. */
export function formatPhoneDisplay(value: string, countryCode?: string | null): string {
    if (!value.trim()) return value;
    const country = phoneCountries.find((item) => item.code === countryCode);
    const digits = value.replace(/\D/g, '');
    const inferNanp = !country && !value.trim().startsWith('+') && (digits.length === 10 || (digits.length === 11 && digits.startsWith('1')));
    const number = parsePhoneNumberFromString(value, { defaultCountry: country?.code ?? (inferNanp ? 'US' : undefined), extract: false });
    // Unknown/incomplete legacy values must remain visible, without truncation.
    if (!number?.isPossible()) return value;
    if (number.countryCallingCode === '1' && number.nationalNumber.length === 10) {
        return `+1 ${nanpMask(number.nationalNumber)}${number.ext ? ` ext. ${number.ext}` : ''}`;
    }
    return number.formatInternational();
}
