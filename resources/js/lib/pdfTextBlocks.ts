import type { LayoutElement } from '@/Pages/Admin/DocumentSettings/LayoutElements';
import { PRINT_LAYOUT_WIDTH } from './printLayoutGeometry';

type PositionedText = LayoutElement & { x: number; y: number };
export type PdfTextFragment = { text: string; element: PositionedText };
export type PdfTextRegion = { left: number; top: number; right: number; bottom: number };
const bullet = /^\s*[•●▪◦‣⁃∙·]\s*/u;
const px = (percent: number) => percent * PRINT_LAYOUT_WIDTH / 100;
const sameStyle = (a: LayoutElement, b: LayoutElement) =>
    a.pdf_font_src === b.pdf_font_src && a.font_family === b.font_family &&
    Math.abs(a.font_size - b.font_size) < 0.2 && a.color === b.color &&
    a.bold === b.bold && a.italic === b.italic;
const sameParagraphStyle = (a: LayoutElement, b: LayoutElement) =>
    a.font_family === b.font_family && Math.abs(a.font_size - b.font_size) < 0.2 && a.color === b.color;

function paragraphCase(text: string): LayoutElement['text_case'] {
    if (text.toUpperCase() === text.toLowerCase()) return 'original';
    if (text === text.toUpperCase()) return 'uppercase';
    if (text === text.toLowerCase()) return 'lowercase';
    return 'original';
}

export function groupPdfText(fragments: PdfTextFragment[], regions: PdfTextRegion[] = []): LayoutElement[] {
    const sorted = [...fragments].sort((a, b) =>
        Math.abs(a.element.y - b.element.y) < 1 ? a.element.x - b.element.x : a.element.y - b.element.y);
    const lines: Array<{ text: string; fragments: PdfTextFragment[]; element: PositionedText; bullet: boolean; blocked: boolean; marker?: 'disc' | 'circle' | 'square' }> = [];
    for (let index = 0; index < sorted.length; index++) {
        const fragment = sorted[index];
        let element = { ...fragment.element };
        let text = fragment.text;
        const hasBullet = bullet.test(fragment.text);
        const symbol = fragment.text.trim()[0];
        const marker = hasBullet ? (symbol === '▪' ? 'square' : symbol === '◦' ? 'circle' : 'disc') : undefined;
        if (hasBullet && fragment.text.replace(bullet, '').trim() === '') {
            const next = sorted[index + 1];
            if (next && Math.abs(next.element.y - element.y) <= Math.max(2, element.font_size * 0.3) &&
                next.element.x > element.x && px(next.element.x - element.x) < element.font_size * 4) {
                const left = element.x;
                element = { ...next.element, x: left, width: next.element.x + next.element.width - left };
                text += next.text;
                index++;
            }
        }
        const blocked = regions.some(region => px(element.x) >= region.left - 1 &&
            px(element.x) < region.right && element.y >= region.top - 1 && element.y < region.bottom);
        const previous = lines.at(-1);
        const separated = previous && regions.some(region =>
            region.left >= px(previous.element.x + previous.element.width) - 1 &&
            region.right <= px(element.x) + 1 &&
            region.top <= element.y + element.height && region.bottom >= element.y);
        if (!hasBullet && previous && !blocked && !previous.blocked &&
            !separated &&
            Math.abs(previous.element.y - element.y) < Math.max(1, element.font_size * 0.15) &&
            sameParagraphStyle(previous.element, element) &&
            px(element.x - previous.element.x - previous.element.width) < element.font_size * 1.5 &&
            element.x >= previous.element.x) {
            previous.element.width = Math.max(previous.element.width, element.x + element.width - previous.element.x);
            previous.text += text;
            previous.fragments.push({ text, element });
        } else {
            lines.push({ text, fragments: [{ text, element: { ...element } }], element, bullet: hasBullet, blocked, marker });
        }
    }
    const output: LayoutElement[] = [];
    for (let index = 0; index < lines.length;) {
        const first = lines[index];
        const block = [first];
        let spacing = 0;
        for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex++) {
            if (block.length >= 200) break;
            const next = lines[nextIndex];
            const previous = block.at(-1)!;
            const gap = next.element.y - previous.element.y;
            const indent = px(next.element.x - first.element.x);
            const separator = regions.some(region =>
                region.top >= previous.element.y + previous.element.height - 1 && region.bottom <= next.element.y + 1 &&
                region.left <= px(first.element.x + first.element.width) && region.right >= px(first.element.x));
            if (first.blocked || next.blocked || !(first.bullet ? sameStyle(first.element, next.element) : sameParagraphStyle(first.element, next.element)) ||
                separator ||
                (first.bullet && !next.bullet
                    ? indent < 0 || indent > first.element.font_size * 4
                    : Math.abs(indent) > first.element.font_size * 0.5) ||
                gap < first.element.font_size * 0.8 || gap > Math.min(400, first.element.font_size * 2.2) ||
                (spacing && Math.abs(gap - spacing) > first.element.font_size * 0.3) ||
                (next.bullet && next.marker !== first.marker) ||
                (!first.bullet && next.bullet)) break;
            spacing ||= gap;
            block.push(next);
        }
        const isList = first.bullet;
        if (!isList && block.length < 3) {
            output.push(...first.fragments.map(fragment => fragment.element));
            index++;
            continue;
        }
        const left = Math.min(...block.flatMap(line => line.fragments.map(fragment => fragment.element.x)));
        const top = Math.min(...block.flatMap(line => line.fragments.map(fragment => fragment.element.y)));
        const listLines: number[] = [];
        for (const line of block) {
            if (line.bullet || !listLines.length) listLines.push(1);
            else listLines[listLines.length - 1]++;
        }
        output.push({
            ...first.element,
            x: left, y: top,
            width: Math.max(...block.map(line => line.element.x + line.element.width)) - left,
            height: Math.max(...block.flatMap(line => line.fragments.map(fragment => fragment.element.y + fragment.element.height))) - top,
            content: '\n'.repeat((isList ? listLines.length : block.length) - 1),
            pdf_line_count: block.length,
            pdf_line_spacing: spacing || first.element.font_size,
            ...(!isList ? {
                text_case: paragraphCase(block.map(line => line.text).join('\n')),
                pdf_text_runs: block.flatMap((line, lineIndex) => {
                    let offset = 0;
                    return line.fragments.map(fragment => {
                        const run = {
                            line: lineIndex, offset, length: [...fragment.text].length,
                            x: px(fragment.element.x - left),
                            y: fragment.element.y - top,
                            width: px(fragment.element.width), height: fragment.element.height,
                            font_size: fragment.element.font_size, font_family: fragment.element.font_family,
                            pdf_font_src: fragment.element.pdf_font_src, pdf_font_name: fragment.element.pdf_font_name,
                            bold: fragment.element.bold, italic: fragment.element.italic, color: fragment.element.color,
                        };
                        offset += run.length;
                        return run;
                    });
                }),
            } : {}),
            ...(isList ? { list_style: 'bullet', pdf_list_lines: listLines, pdf_bullet_style: first.marker } : {}),
        });
        index += block.length;
    }
    return output;
}
