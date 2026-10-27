export type MailSignature = {
    id: string;
    name: string;
    html: string;
};

export type MailStationeryData = {
    header: string;
    footer: string;
    signatures: MailSignature[];
    newSignatureId: string | null;
    replySignatureId: string | null;
    logoUrl?: string;
};

export type MailLayoutId = 'blank' | 'letter' | 'note' | 'announcement' | 'project' | 'followUp';

export const emptyStationery: MailStationeryData = {
    header: '',
    footer: '',
    signatures: [],
    newSignatureId: null,
    replySignatureId: null,
    logoUrl: '/images/Gateway_Door_Systems_Logo.png',
};

export function signatureHtml(stationery: MailStationeryData, kind: 'new' | 'reply'): string {
    const id = kind === 'reply' ? stationery.replySignatureId : stationery.newSignatureId;
    const chosen = stationery.signatures.find((signature) => signature.id === id) ?? stationery.signatures[0];

    return chosen?.html ?? '';
}

function section(name: 'header' | 'signature' | 'footer', html: string): string {
    const trimmed = html.trim();

    if (trimmed === '') {
        return '';
    }

    return `<div data-mail-section="${name}">${trimmed}</div>`;
}

function writingRoom(): string {
    return '<p></p><p></p>';
}

function blockHtml(html: string): string[] {
    return [...html.matchAll(/<(p|ul|ol|blockquote)\b[^>]*>[\s\S]*?<\/\1>/gi)].map((match) => match[0]);
}

export function keptWriting(currentHtml: string, baselineHtml: string): string {
    if (baselineHtml.trim() === '' || currentHtml.trim() === baselineHtml.trim()) {
        return '';
    }

    const baseline = new Set(blockHtml(baselineHtml));
    const kept = blockHtml(currentHtml).filter((block) => !baseline.has(block));
    const text = kept
        .join(' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return text === '' ? '' : kept.join('');
}

export function applyLayout(
    layout: MailLayoutId,
    stationery: MailStationeryData,
    currentHtml: string,
    baselineHtml: string,
): string {
    const next = buildLayout(layout, stationery);
    const writing = keptWriting(currentHtml, baselineHtml);

    if (writing === '') {
        return next;
    }

    return next.replace(writingRoom(), writing);
}

function layoutLabel(layout: MailLayoutId): string {
    if (layout === 'announcement') {
        return '<p style="margin:14px 0 0;text-align:center;font-family:Calibri,Arial,sans-serif;font-size:22px;font-weight:700;color:#06281c;">Announcement</p>';
    }

    if (layout === 'project') {
        return '<p style="margin:12px 0 0;font-family:Calibri,Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.14em;color:#047857;">PROJECT UPDATE</p>';
    }

    if (layout === 'followUp') {
        return '<p style="margin:12px 0 0;font-family:Calibri,Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.14em;color:#047857;">FOLLOWING UP</p>';
    }

    return '';
}

export function buildLayout(layout: MailLayoutId, stationery: MailStationeryData): string {
    const signature = section('signature', signatureHtml(stationery, 'new'));
    const hasHeader = stationery.header.trim() !== '';
    const hasFooter = stationery.footer.trim() !== '';
    const label = layoutLabel(layout);
    const header = hasHeader || label !== ''
        ? section('header', `${hasHeader ? stationery.header : ''}${label}`)
        : '';
    const footer = hasFooter ? section('footer', stationery.footer) : '';

    if (layout === 'blank' || layout === 'note') {
        return `<div data-gateway-mail="${layout}">${writingRoom()}${signature}</div>`;
    }

    return `<div data-gateway-mail="${layout}">${header}${writingRoom()}${signature}${footer}</div>`;
}

export function placeReplySignature(body: string, signature: string): string {
    if (body.includes('data-mail-section') || signature.trim() === '') {
        return body;
    }

    const block = section('signature', signature);

    if (body.includes('<hr')) {
        return body.replace('<hr', `${block}<hr`);
    }

    return `${body}${block}`;
}

export function withoutStationery(html: string): string {
    return html.replace(
        /<div\b[^>]*data-mail-section="(?:header|signature|footer)"[^>]*>[\s\S]*?<\/div>/gi,
        ' ',
    );
}
