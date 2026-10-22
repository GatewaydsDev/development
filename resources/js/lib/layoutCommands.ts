export type CommandElementType =
    | 'text'
    | 'image'
    | 'divider'
    | 'spacer'
    | 'date'
    | 'validity'
    | 'company'
    | 'table';

export type CommandZone = 'header' | 'footer' | 'top';

export type LayoutCommand =
    | {
        kind: 'add';
        element: CommandElementType;
        zone: CommandZone;
        grid: boolean;
        patch: Record<string, unknown>;
        message: string;
    }
    | { kind: 'rows'; count: number; message: string }
    | { kind: 'columns'; count: number; message: string }
    | { kind: 'header-row'; message: string; color?: string };

const NUMBER_WORDS: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
};

const VERB = /\b(add|insert|put|place|include|create|make|set|change)\b/;

const amount = (value: string) => {
    const word = NUMBER_WORDS[value.toLowerCase()];

    return word ?? (Number(value) || 1);
};

const countOf = (text: string, noun: string) => {
    const match = text.match(new RegExp(`(\\d+|${Object.keys(NUMBER_WORDS).join('|')})\\s+${noun}`, 'i'));

    return match ? Math.min(20, Math.max(1, amount(match[1]))) : 1;
};

const zoneFor = (text: string, element: string): CommandZone => {
    if (element === 'footer') {
        return 'footer';
    }

    if (element === 'header') {
        return 'top';
    }

    if (/\bfooter\b/.test(text)) {
        return 'footer';
    }

    if (/\bheader\b/.test(text) && !/\bheader row\b/.test(text)) {
        return 'top';
    }

    return 'header';
};

const where = (zone: CommandZone) => (zone === 'top' ? 'header' : zone === 'footer' ? 'footer' : 'page');

const textBody = (command: string) => {
    const quoted = command.match(/["“]([^"”]+)["”]/);

    if (quoted?.[1]?.trim()) {
        return quoted[1].trim();
    }

    const saying = command.match(/\b(?:saying|that says|with text|with the words|reads)\s+(.+)$/i);
    const raw = saying?.[1] ?? command.match(/\b(?:text|paragraph|wording)\b\s+(.+)$/i)?.[1] ?? '';

    return raw
        .replace(/\b(?:in|on|to|into) the (header|footer|page)\b/gi, '')
        .replace(/^(?:a|an|the|box|field|block)\b\s*/i, '')
        .trim();
};

const saved = (label: string, zone: CommandZone) => `${label} was added to the ${where(zone)}. Save the page to keep it.`;

const blankCells = (rows: number, columns: number) => Array.from({ length: rows }, () => Array.from({ length: columns }, () => ''));

const COLORS: Array<[string, string]> = [
    ['dark navy', '#0a2540'],
    ['dark navi', '#0a2540'],
    ['navy', '#0a2540'],
    ['navi', '#0a2540'],
    ['dark blue', '#1e3a8a'],
    ['dark green', '#14532d'],
    ['dark red', '#7f1d1d'],
    ['dark gray', '#334155'],
    ['dark grey', '#334155'],
    ['black', '#111827'],
    ['white', '#ffffff'],
    ['gold', '#a16207'],
    ['yellow', '#facc15'],
    ['green', '#166534'],
    ['blue', '#1d4ed8'],
    ['red', '#b91c1c'],
    ['gray', '#64748b'],
    ['grey', '#64748b'],
];

const namedColor = (text: string) => {
    const found = COLORS.find(([name]) => text.includes(name));

    return found?.[1] ?? text.match(/#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/i)?.[0] ?? null;
};

const lightText = (color: string) => !['#ffffff', '#facc15'].includes(color.toLowerCase());

const FIELD_TOKENS: Array<[RegExp, string]> = [
    [/company legal name/, '{{company_legal_name}}'],
    [/company specialit|company specialty/, '{{company_speciality}}'],
    [/company name/, '{{company_name}}'],
    [/company address/, '{{company_address}}'],
    [/company phone/, '{{company_phone}}'],
    [/company email/, '{{company_email}}'],
    [/company website/, '{{company_website}}'],
];

const fieldLine = (value: string) => value.split('|').map((part) => {
    const trimmed = part.trim();
    const known = FIELD_TOKENS.find(([pattern]) => pattern.test(trimmed));

    return known?.[1] ?? trimmed;
}).filter(Boolean).join(' | ');

const clauses = (command: string) => command
    .split(/\s*,\s*|\s+\band\s+(?=add\b)/i)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (VERB.test(part) ? part : `add ${part}`));

const zoneWords = (text: string) => text
    .replace(/\b(?:column|row)\s+headers?\b/g, '')
    .replace(/\bheader rows?\b/g, '');

const parseClause = (clause: string): LayoutCommand[] => {
    const text = clause.toLowerCase().replace(/\s+/g, ' ').trim();
    const placement = zoneWords(text);
    const piece = String.raw`(?:add|insert|put|place|include|create|make)\s+(?:(?:a|an|the|another)\s+)?`;
    const headerPiece = new RegExp(String.raw`\b${piece}headers?(?!\s+rows?)\b`).test(text);
    const footerPiece = new RegExp(String.raw`\b${piece}footers?\b`).test(text);
    const withLogo = /\blogo\b/.test(text);

    if ((headerPiece || footerPiece) && withLogo) {
        const zone: CommandZone = footerPiece && !headerPiece ? 'footer' : 'top';

        return [{
            kind: 'add',
            element: 'image',
            zone,
            grid: false,
            patch: { src: '__LOGO__', width: 26, height: 64 },
            message: saved('The company logo', zone),
        }];
    }

    if (headerPiece || footerPiece) {
        const zone: CommandZone = footerPiece && !headerPiece ? 'footer' : 'top';
        const afterWith = clause.match(/\bwith\b\s+(.+)$/i)?.[1] ?? '';
        const content = fieldLine(afterWith) || (zone === 'footer' ? 'Footer' : 'Header');

        return [{
            kind: 'add',
            element: 'text',
            zone,
            grid: false,
            patch: {
                content,
                width: 94,
                height: Math.min(120, Math.max(36, content.split('\n').length * 18 + 12)),
            },
            message: zone === 'footer'
                ? 'A footer was added. Save the page to keep it.'
                : 'A header was added. Save the page to keep it.',
        }];
    }

    const createsTable = /\b(?:add|insert|put|place|include|create|make)\s+(?:(?:a|an|the|another|\d+)\s+)?(?:info\s+)?tables?\b/.test(text);

    if (createsTable) {
        const rows = /\brows?\b/.test(text) ? countOf(text, 'rows?') : 4;
        const columns = /\bcolumns?\b/.test(text) ? countOf(text, 'columns?') : 2;
        const headerColor = /\b(?:column\s+)?headers?\b/.test(text) ? namedColor(text) : null;
        const zone = zoneFor(placement, 'table');

        return [{
            kind: 'add',
            element: 'table',
            zone,
            grid: true,
            patch: {
                cells: blankCells(rows, columns),
                columns,
                width: 94,
                height: rows * 28,
                border: true,
                ...(headerColor ? {
                    header_row: true,
                    label_bg: headerColor,
                    header_color: lightText(headerColor) ? '#ffffff' : '#111827',
                } : {}),
            },
            message: headerColor
                ? `A ${rows} by ${columns} table was added with a colored column header. Save the page to keep it.`
                : saved('A table', zone),
        }];
    }

    if (/\bheader row\b/.test(text) || /\bcolumn headers?\b/.test(text)) {
        const headerColor = namedColor(text);

        return [{
            kind: 'header-row',
            color: headerColor ?? undefined,
            message: headerColor
                ? 'The column header color was updated. Save the page to keep it.'
                : 'The table now has a header row. Save the page to keep it.',
        }];
    }

    const addsRow = /\brows?\b/.test(text);
    const addsColumn = /\bcolumns?\b/.test(text);

    if (addsRow || addsColumn) {
        const actions: LayoutCommand[] = [];

        if (addsRow) {
            const count = countOf(text, 'rows?');
            actions.push({
                kind: 'rows',
                count,
                message: count === 1
                    ? 'A row was added to the table. Save the page to keep it.'
                    : `${count} rows were added to the table. Save the page to keep it.`,
            });
        }

        if (addsColumn) {
            const count = countOf(text, 'columns?');
            actions.push({
                kind: 'columns',
                count,
                message: count === 1
                    ? 'A column was added to the table. Save the page to keep it.'
                    : `${count} columns were added to the table. Save the page to keep it.`,
            });
        }

        return actions;
    }

    let element: CommandElementType | null = null;

    if (withLogo) {
        element = 'image';
    } else if (/\bcompan(?:y|ies)\b/.test(text)) {
        element = 'company';
    } else if (/\bvalidity\b/.test(text)) {
        element = 'validity';
    } else if (/\bdates?\b/.test(text)) {
        element = 'date';
    } else if (/\b(dividers?|horizontal lines?|vertical lines?)\b/.test(text) || (/\blines?\b/.test(text) && !/\btext\b/.test(text))) {
        element = 'divider';
    } else if (/\b(spacers?|spaces?)\b/.test(text)) {
        element = 'spacer';
    } else if (/\bimages?\b/.test(text)) {
        element = 'image';
    } else if (/\b(texts?|paragraphs?|wording)\b/.test(text)) {
        element = 'text';
    }

    if (!element) {
        return [];
    }

    const zone = zoneFor(placement, element);
    const patch: Record<string, unknown> = {};

    if (element === 'text') {
        const body = textBody(clause);
        patch.content = body || 'New text';
        patch.width = 94;
        patch.height = Math.min(320, Math.max(36, String(patch.content).split('\n').length * 18 + 12));
    }

    if (element === 'image' && withLogo) {
        patch.src = '__LOGO__';
        patch.width = 26;
        patch.height = 64;
    }

    if (element === 'divider') {
        const vertical = /\bvertical\b/.test(text);
        patch.orientation = vertical ? 'vertical' : 'horizontal';
        patch.width = vertical ? 2 : 94;
        patch.height = vertical ? 80 : 2;
    }

    if (element === 'spacer') {
        patch.height = 32;
        patch.width = 94;
    }

    const label = element === 'image' && withLogo
        ? 'The company logo'
        : element === 'company'
            ? 'Company info'
            : element === 'text'
                ? 'A text block'
                : `A ${element}`;

    return [{
        kind: 'add',
        element,
        zone,
        grid: false,
        patch,
        message: saved(label, zone),
    }];
};

export function parseLayoutCommand(command: string): LayoutCommand[] | null {
    const text = command.toLowerCase().replace(/\s+/g, ' ').trim();

    if (!VERB.test(text)) {
        return null;
    }

    const actions = clauses(command).flatMap(parseClause);

    return actions.length > 0 ? actions : null;
}
