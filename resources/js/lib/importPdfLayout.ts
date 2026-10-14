import { getDocument, GlobalWorkerOptions, OPS, Util } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { LayoutElement } from '@/Pages/Admin/DocumentSettings/LayoutElements';
import { PRINT_LAYOUT_WIDTH } from './printLayoutGeometry';
import { groupPdfText, type PdfTextFragment, type PdfTextRegion } from './pdfTextBlocks';
import { detectPdfTables, pdfPathLines, pdfTableColorBands, type PdfTableLine, type PdfTableFill } from './pdfTables';

GlobalWorkerOptions.workerSrc = worker;
const standardFonts = import.meta.glob('/node_modules/pdfjs-dist/standard_fonts/*', { eager: true, query: '?url', import: 'default' });
class LocalStandardFonts {
    async fetch({ filename }: { filename: string }) {
        const url = standardFonts[`/node_modules/pdfjs-dist/standard_fonts/${filename}`];
        if (typeof url !== 'string') throw new Error(`Missing PDF font: ${filename}`);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Could not load PDF font: ${filename}`);
        return new Uint8Array(await response.arrayBuffer());
    }
}
function pdfBandKey(content: string): string {
    return content.replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().toLowerCase();
}

function placePdfHeaderAndFooter(pages: Array<{ elements: LayoutElement[] }>): { headers: number; footers: number } {
    const pageHeight = (elements: LayoutElement[]) =>
        elements.find((element) => element.pdf_background)?.pdf_page_height
        ?? elements.find((element) => element.pdf_page_height)?.pdf_page_height
        ?? 0;
    const share = 0.14;
    const keysIn = (edge: 'top' | 'bottom') => {
        const seen = new Map<string, number>();
        for (const page of pages) {
            const height = pageHeight(page.elements);
            if (!height) continue;
            const keys = new Set<string>();
            for (const element of page.elements) {
                if (element.pdf_background || element.type !== 'text') continue;
                const key = pdfBandKey(element.content);
                if (key.length < 2) continue;
                const y = element.y ?? 0;
                const bottom = y + (element.height || element.font_size || 16);
                const inBand = edge === 'top'
                    ? bottom <= height * 0.22 && y < height * share + 8
                    : y >= height * (1 - share) - 8 && y > height * 0.78;
                if (inBand) keys.add(key);
            }
            keys.forEach((key) => seen.set(key, (seen.get(key) ?? 0) + 1));
        }
        const need = pages.length >= 2 ? Math.max(2, Math.ceil(pages.length * 0.6)) : 1;
        return new Set([...seen.entries()].filter(([, count]) => count >= need).map(([key]) => key));
    };
    const headerKeys = pages.length >= 2 ? keysIn('top') : new Set<string>();
    const footerKeys = pages.length >= 2 ? keysIn('bottom') : new Set<string>();
    let headers = 0;
    let footers = 0;
    for (const page of pages) {
        const height = pageHeight(page.elements);
        if (!height) continue;
        const margin = Math.min(120, Math.max(48, height * share));
        const footerOrigin = height - margin;
        for (const element of page.elements) {
            if (element.pdf_background || element.type !== 'text') continue;
            const key = pdfBandKey(element.content);
            const y = element.y ?? 0;
            const bottom = y + (element.height || element.font_size || 16);
            const inHeader = headerKeys.size > 0
                ? headerKeys.has(key) && bottom < height * 0.28
                : bottom <= margin && y < height * 0.22;
            const inFooter = footerKeys.size > 0
                ? footerKeys.has(key) && y > height * 0.72
                : y >= footerOrigin && y > height * 0.78;
            if (inHeader && !inFooter) {
                element.layout_band = 'header';
                headers += 1;
            } else if (inFooter && !inHeader) {
                element.layout_band = 'footer';
                footers += 1;
            }
        }
    }
    return { headers, footers };
}

const cmaps = import.meta.glob('/node_modules/pdfjs-dist/cmaps/*.bcmap', { eager: true, query: '?url', import: 'default' });
class LocalCMaps {
    async fetch({ name }: { name: string }) {
        const url = cmaps[`/node_modules/pdfjs-dist/cmaps/${name}.bcmap`];
        if (typeof url !== 'string') throw new Error(`Missing PDF character map: ${name}`);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Could not load PDF character map: ${name}`);
        return { cMapData: new Uint8Array(await response.arrayBuffer()), compressionType: 1 };
    }
}
const wasmFiles = import.meta.glob('/node_modules/pdfjs-dist/wasm/*.wasm', { eager: true, query: '?url', import: 'default' });
class LocalWasm {
    async fetch({ filename }: { filename: string }) {
        const url = wasmFiles[`/node_modules/pdfjs-dist/wasm/${filename}`];
        if (typeof url !== 'string') throw new Error(`Missing PDF decoder: ${filename}`);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Could not load PDF decoder: ${filename}`);
        return new Uint8Array(await response.arrayBuffer());
    }
}
type PdfFont = { name?: string; data?: Uint8Array; bold?: boolean; italic?: boolean; ascent?: number; isType3Font?: boolean };
type PendingPage = { background: Blob; elements: LayoutElement[]; artwork: Array<{ id: string; blob: Blob }> };
type PdfImport = { pages: PendingPage[]; fonts: Map<string, Uint8Array>; notes: string[] };
const uid = () => `pdf-${crypto.randomUUID().replaceAll('-', '').slice(0, 24)}`;
const canvasBlob = (source: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => {
    source.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not store a page image.')), 'image/png');
});

/** Pull the logo and other art in the header or footer off the locked page background so it can be selected. */
async function liftPageArtwork(
    context: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    resolution: number,
    band: 'header' | 'footer',
    base: Partial<LayoutElement>,
): Promise<{ element: LayoutElement; blob: Blob } | null> {
    const margin = Math.round(Math.min(120, Math.max(48, canvas.height / resolution * 0.14)) * resolution);
    const top = band === 'header' ? 0 : Math.max(0, canvas.height - margin);
    const height = Math.min(margin, canvas.height - top);
    if (height < 4 || canvas.width < 4) return null;
    const pixels = context.getImageData(0, top, canvas.width, height).data;
    let minX = canvas.width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3] < 20 || (pixels[index] > 250 && pixels[index + 1] > 250 && pixels[index + 2] > 250)) continue;
        const pixel = index / 4;
        const x = pixel % canvas.width;
        const y = Math.floor(pixel / canvas.width);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
    }
    if (maxX - minX < 8 || maxY - minY < 4) return null;
    const pad = 2;
    const x = Math.max(0, minX - pad);
    const y = Math.max(0, minY - pad);
    const width = Math.min(canvas.width - x, maxX - minX + 1 + pad * 2);
    const cropHeight = Math.min(height - y, maxY - minY + 1 + pad * 2);
    const crop = document.createElement('canvas');
    crop.width = width;
    crop.height = cropHeight;
    const cropContext = crop.getContext('2d');
    if (!cropContext) return null;
    cropContext.drawImage(canvas, x, top + y, width, cropHeight, 0, 0, width, cropHeight);
    context.fillStyle = '#ffffff';
    context.fillRect(x, top + y, width, cropHeight);
    const blob = await canvasBlob(crop);
    crop.width = crop.height = 0;
    return {
        blob,
        element: {
            ...base,
            id: uid(),
            type: 'image',
            layout_band: band,
            x: x / canvas.width * 100,
            y: (top + y) / resolution,
            width: width / canvas.width * 100,
            height: cropHeight / resolution,
        } as LayoutElement,
    };
}
const normalize = (text: string) => text.replace(/\s+/g, '');

export type PdfImportText = 'keep' | 'clean';

function withoutPdfWording(element: LayoutElement): LayoutElement {
    if (element.pdf_background || element.type === 'image') return element;
    if (element.type === 'table') {
        return { ...element, cells: (element.cells ?? []).map((row) => row.map(() => '')) };
    }
    if (element.type !== 'text') return element;
    return {
        ...element,
        content: '',
        pdf_text_runs: undefined,
        pdf_line_count: element.pdf_line_count && element.pdf_line_count > 0 ? element.pdf_line_count : 1,
    };
}

export async function readPdfLayout(file: File, options?: { text?: PdfImportText }): Promise<PdfImport> {
    if (file.size > 10 * 1024 * 1024) throw new Error('Choose a PDF smaller than 10 MB.');
    const task = getDocument({
        data: new Uint8Array(await file.arrayBuffer()), fontExtraProperties: true,
        isEvalSupported: false, StandardFontDataFactory: LocalStandardFonts, CMapReaderFactory: LocalCMaps,
        useSystemFonts: false, WasmFactory: LocalWasm, stopAtErrors: true,
    });
    const pages: PendingPage[] = [];
    const fonts = new Map<string, Uint8Array>();
    const notes = new Set<string>();
    try {
        const pdf = await task.promise;
        if (pdf.numPages > 20) throw new Error('This PDF has more than 20 pages. Split it into smaller PDFs before importing.');
        let count = 0;
        for (let number = 1; number <= pdf.numPages; number++) {
            const page = await pdf.getPage(number);
            const scale = PRINT_LAYOUT_WIDTH / page.getViewport({ scale: 1 }).width;
            const viewport = page.getViewport({ scale });
            if (viewport.height > 4000 || viewport.height < 60) throw new Error(`Page ${number} has an unsupported aspect ratio.`);
            const text = await page.getTextContent();
            const items = text.items.filter((item): item is TextItem => 'str' in item && item.str.trim() !== '');
            if (!items.length) throw new Error(`Page ${number} has no selectable text. Scanned pages and text converted to outlines cannot be cleared safely. Import a PDF with selectable text.`);
            const ops = await page.getOperatorList();
            const textOps = new Set([OPS.showText, OPS.showSpacedText, OPS.nextLineShowText, OPS.nextLineSetSpacingShowText]);
            let color = '#000000';
            let strokeColor = '#000000';
            let lineWidth = 1;
            const stack: Array<{ color: string; strokeColor: string; lineWidth: number }> = [];
            const runs: Array<{ text: string; color: string }> = [];
            let transform = [...viewport.transform];
            const transforms: number[][] = [];
            const regions: PdfTextRegion[] = [];
            const tableLines: PdfTableLine[] = [];
            const tableFills: PdfTableFill[] = [];
            ops.fnArray.forEach((op, index) => {
                const args = ops.argsArray[index];
                if (op === OPS.save) { stack.push({ color, strokeColor, lineWidth }); transforms.push([...transform]); }
                if (op === OPS.restore) {
                    const state = stack.pop();
                    color = state?.color ?? '#000000'; strokeColor = state?.strokeColor ?? '#000000'; lineWidth = state?.lineWidth ?? 1;
                    transform = transforms.pop() ?? [...viewport.transform];
                }
                if (op === OPS.transform) transform = Util.transform(transform, args);
                if (op === OPS.setStrokeRGBColor && typeof args[0] === 'string') strokeColor = args[0];
                if (op === OPS.setLineWidth) lineWidth = args[0];
                if (op === OPS.constructPath && args[2]) {
                    const closed = [OPS.closeStroke, OPS.closeFillStroke, OPS.closeEOFillStroke].includes(args[0]);
                    const stroked = [OPS.stroke, OPS.closeStroke, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke].includes(args[0]);
                    const filled = [OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke].includes(args[0]);
                    const chunks = Array.isArray(args[1]) ? args[1] : args[1] ? [args[1]] : [];
                    for (const chunk of chunks) {
                        if (!chunk || typeof chunk.length !== 'number' || chunk.length < 2) continue;
                        const path = pdfPathLines(closed ? [...chunk, 4] : chunk, transform, strokeColor,
                            lineWidth * Math.hypot(transform[0], transform[1]));
                        if (stroked) tableLines.push(...path.lines);
                        for (const rect of filled ? path.rectangles : []) {
                            tableFills.push({ ...rect, color });
                            if (rect.right - rect.left <= 3 || rect.bottom - rect.top <= 3) {
                                tableLines.push({ x1: rect.right - rect.left <= 3 ? (rect.left + rect.right) / 2 : rect.left,
                                    x2: rect.right - rect.left <= 3 ? (rect.left + rect.right) / 2 : rect.right,
                                    y1: rect.bottom - rect.top <= 3 ? (rect.top + rect.bottom) / 2 : rect.top,
                                    y2: rect.bottom - rect.top <= 3 ? (rect.top + rect.bottom) / 2 : rect.bottom,
                                    color, width: Math.min(rect.right - rect.left, rect.bottom - rect.top) });
                            }
                        }
                    }
                }
                if (op === OPS.constructPath && args[2]?.length === 4) {
                    const start: [number, number] = [args[2][0], args[2][1]];
                    const end: [number, number] = [args[2][2], args[2][3]];
                    Util.applyTransform(start, transform);
                    Util.applyTransform(end, transform);
                    const [left, top] = start;
                    const [right, bottom] = end;
                    if (Math.abs(right - left) <= 3 || Math.abs(bottom - top) <= 3 ||
                        [OPS.stroke, OPS.closeStroke, OPS.fillStroke, OPS.eoFillStroke].includes(args[0])) {
                        regions.push({ left: Math.min(left, right), top: Math.min(top, bottom), right: Math.max(left, right), bottom: Math.max(top, bottom) });
                    }
                }
                if (op === OPS.setFillRGBColor && typeof args[0] === 'string') color = args[0];
                if (op === OPS.setTextRenderingMode && args[0] >= 4) throw new Error(`Page ${number} uses text as a clipping mask. Its graphics cannot be preserved while clearing text.`);
                if (textOps.has(op)) {
                    const glyphs: unknown[] = args.find((arg: unknown) => Array.isArray(arg)) ?? [];
                    const value = glyphs.map((glyph) => typeof glyph === 'object' && glyph !== null && 'unicode' in glyph ? String(glyph.unicode) : '').join('');
                    if (normalize(value)) runs.push({ text: normalize(value), color });
                }
            });
            const canvas = document.createElement('canvas');
            const resolution = Math.min(3, 8000 / viewport.height);
            const raster = page.getViewport({ scale: scale * resolution });
            canvas.width = Math.ceil(raster.width);
            canvas.height = Math.ceil(raster.height);
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Your browser cannot render this PDF.');
            await page.render({
                canvas, canvasContext: context, viewport: raster, annotationMode: 0,
                operationsFilter: (index) => !textOps.has(ops.fnArray[index]),
                background: '#ffffff',
            }).promise;
            const pageId = uid();
            const base = {
                zone: 'header', content: '', src: '', align: 'left', width: 100, height: 16,
                font_size: 12, bold: false, italic: false, text_case: 'original', color: '#000000',
                x: 0, y: 0, pdf_page: pageId, pdf_page_height: viewport.height,
            } satisfies Partial<LayoutElement>;
            const elements: LayoutElement[] = [{ ...base, id: uid(), type: 'image', pdf_background: true, height: viewport.height }];
            let runIndex = 0;
            let consumed = 0;
            const fragments: PdfTextFragment[] = [];
            for (const item of items) {
                const matrix = Util.transform(viewport.transform, item.transform);
                if (Math.abs(matrix[1]) > 0.01 || Math.abs(matrix[2]) > 0.01 || item.dir === 'ttb') {
                    throw new Error(`Page ${number} contains rotated or vertical text. It cannot yet be recreated as editable fields without changing its formatting.`);
                }
                const font: PdfFont = page.commonObjs.get(item.fontName);
                if (font.isType3Font) throw new Error(`Page ${number} uses a Type 3 font that cannot be recreated as editable text.`);
                const size = Math.hypot(matrix[2], matrix[3]);
                if (size < 1 || size > 200) throw new Error(`Page ${number} has text outside the supported 1–200px font-size range.`);
                const width = item.width * scale;
                const x = Math.max(0, matrix[4]);
                const textAscent = text.styles[item.fontName].ascent;
                const ascent = Number.isFinite(font.ascent) ? font.ascent! : Number.isFinite(textAscent) ? textAscent : 0.8;
                const y = Math.max(0, matrix[5] - size * ascent);
                if (![size, width, x, y].every(Number.isFinite)) throw new Error(`Page ${number} contains invalid text geometry.`);
                let remaining = normalize(item.str).length;
                const colors = new Set<string>();
                while (remaining > 0 && runIndex < runs.length) {
                    const run = runs[runIndex];
                    colors.add(run.color);
                    const used = Math.min(remaining, run.text.length - consumed);
                    remaining -= used;
                    consumed += used;
                    if (consumed === run.text.length) { runIndex++; consumed = 0; }
                }
                if (colors.size > 1) throw new Error(`Page ${number} has multiple text colors inside one text run. Split those runs in the source PDF before importing.`);
                if (font.data?.length) fonts.set(item.fontName, new Uint8Array(font.data));
                else notes.add(`Font "${font.name ?? text.styles[item.fontName].fontFamily}" has no reusable embedded font. Its nearest available font is used; review replacements before printing.`);
                const name = font.name ?? text.styles[item.fontName].fontFamily;
                const family = /times|serif/i.test(name) ? 'times' : /courier|mono/i.test(name) ? 'courier' : 'arial';
                fragments.push({ text: item.str, element: {
                    ...base, content: item.str, id: uid(), type: 'text', x: x / PRINT_LAYOUT_WIDTH * 100, y,
                    width: Math.max(0.1, Math.min(100 - x / PRINT_LAYOUT_WIDTH * 100, width / PRINT_LAYOUT_WIDTH * 100)),
                    height: size, font_size: size, font_family: family, line_height: 1,
                    bold: !!font.bold || /bold/i.test(name), italic: !!font.italic || /italic|oblique/i.test(name),
                    color: [...colors][0] ?? '#000000', pdf_font_name: name.slice(0, 120),
                    // This temporary key is replaced with a stored font URL before applying the import.
                    pdf_font_src: fonts.has(item.fontName) ? item.fontName : undefined,
                } });
            }
            // Filled neighboring cells can define borderless tables as well as stroked grids.
            for (const fill of tableFills.filter(fill => fill.right - fill.left > 3 && fill.bottom - fill.top > 3 &&
                !(fill.right - fill.left > viewport.width * 0.95 && fill.bottom - fill.top > viewport.height * 0.7))) {
                tableLines.push(
                    { x1: fill.left, y1: fill.top, x2: fill.right, y2: fill.top, color: fill.color, width: 0 },
                    { x1: fill.left, y1: fill.bottom, x2: fill.right, y2: fill.bottom, color: fill.color, width: 0 },
                    { x1: fill.left, y1: fill.top, x2: fill.left, y2: fill.bottom, color: fill.color, width: 0 },
                    { x1: fill.right, y1: fill.top, x2: fill.right, y2: fill.bottom, color: fill.color, width: 0 },
                );
            }
            const grids = detectPdfTables(tableLines);
            const editable = pdfTableColorBands(grids, fragments, { ...base, id: uid(), type: 'table' }, (x, y) => {
                const pixel = context.getImageData(Math.max(0, Math.min(canvas.width - 1, Math.round(x * resolution))),
                    Math.max(0, Math.min(canvas.height - 1, Math.round(y * resolution))), 1, 1).data;
                return '#' + Array.from(pixel.slice(0, 3)).map(value => value.toString(16).padStart(2, '0')).join('');
            });
            // Remove the original table artwork. Only the header and footer color bars are kept.
            context.fillStyle = '#ffffff';
            for (const table of editable.bounds) {
                const x = (table.x ?? 0) / 100 * PRINT_LAYOUT_WIDTH;
                const y = table.y ?? 0;
                const width = (table.width ?? 0) / 100 * PRINT_LAYOUT_WIDTH;
                const height = table.height ?? 0;
                const pad = 2;
                context.fillRect((x - pad) * resolution, (y - pad) * resolution, (width + pad * 2) * resolution, (height + pad * 2) * resolution);
            }
            const artwork: PendingPage['artwork'] = [];
            for (const band of ['header', 'footer'] as const) {
                const lifted = await liftPageArtwork(context, canvas, resolution, band, base);
                if (!lifted) continue;
                artwork.push({ id: lifted.element.id, blob: lifted.blob });
                elements.splice(1, 0, lifted.element);
            }
            const background = await canvasBlob(canvas);
            canvas.width = canvas.height = 0;
            elements.push(...editable.bands, ...groupPdfText(editable.remaining, regions));
            if (options?.text === 'clean') {
                for (let index = 0; index < elements.length; index++) elements[index] = withoutPdfWording(elements[index]);
            }
            count += elements.length;
            if (count > 1000) throw new Error('This PDF requires more than 1,000 components. Split it into smaller PDFs before importing.');
            pages.push({ background, elements, artwork });
            page.cleanup();
        }
        const bands = placePdfHeaderAndFooter(pages);
        notes.add(bands.headers + bands.footers > 0
            ? `The PDF header (${bands.headers} item${bands.headers === 1 ? '' : 's'}) and footer (${bands.footers} item${bands.footers === 1 ? '' : 's'}) stay on the imported page. Header and footer artwork is its own image, so it can be selected.`
            : 'No separate header or footer text was found on the imported page.');
        notes.add(options?.text === 'clean'
            ? 'Original PDF wording was removed. Each table leaves its header color, and its footer color when the last row is a separate band. Add the columns and rows yourself. Other graphics remain page backgrounds.'
            : 'PDF tables are not copied. Each table leaves a header color bar, and a footer color bar when the last row has its own color. Add the columns and rows yourself. Lists stay lists. Other graphics remain page backgrounds.');
        notes.add('Embedded PDF fonts may contain only the original characters. Review replacement text for missing glyphs; choose a standard font if needed.');
        notes.add('Text baked into images or vector outlines cannot be detected or cleared. Review every imported background before saving.');
        return { pages, fonts, notes: [...notes] };
    } finally {
        await task.destroy();
    }
}
