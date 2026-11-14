const pad = (value: number) => String(value).padStart(2, '0');

/** Server instant (ISO) -> "YYYY-MM-DDTHH:mm" in the browser timezone, for the date/time inputs. */
export function toInputValue(iso: string | null | undefined): string {
    if (!iso) {
        return '';
    }

    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "YYYY-MM-DDTHH:mm" entered in the browser timezone -> absolute ISO instant. */
export function toIsoInstant(local: string): string {
    if (!local) {
        return '';
    }

    const date = new Date(local);

    return Number.isNaN(date.getTime()) ? local : date.toISOString();
}

export const deviceTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
