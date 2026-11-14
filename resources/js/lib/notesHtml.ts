const escapeHtml = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Notes saved before the rich editor are plain text; show them as paragraphs. */
export function notesToHtml(notes: string | null | undefined): string {
    if (!notes) {
        return '';
    }

    if (/<[a-z][\s\S]*>/i.test(notes)) {
        return notes;
    }

    return notes
        .split(/\n{2,}/)
        .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
        .join('');
}
