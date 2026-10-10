import { getDocument, GlobalWorkerOptions, OPS, Util } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { LayoutElement } from '@/Pages/Admin/DocumentSettings/LayoutElements';
import { PRINT_LAYOUT_WIDTH } from './printLayoutGeometry';
import { groupPdfText, type PdfTextFragment, type PdfTextRegion } from './pdfTextBlocks';
import { detectPdfTables, editablePdfTables, pdfPathLines, type PdfTableLine, type PdfTableFill } from './pdfTables';

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
type PendingPage = { background: Blob; elements: LayoutElement[] };
type PdfImport = { pages: PendingPage[]; fonts: Map<string, Uint8Array>; notes: string[] };
const uid = () => `pdf-${crypto.randomUUID().replaceAll('-', '').slice(0, 24)}`;
const normalize = (text: string) => text.replace(/\s+/g, '');

export async function readPdfLayout(file: File): Promise<PdfImport> {
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
                if (op === OPS.constructPath && args[1]?.[0] && args[2]) {
                    const closed = [OPS.closeStroke, OPS.closeFillStroke, OPS.closeEOFillStroke].includes(args[0]);
                    const stroked = [OPS.stroke, OPS.closeStroke, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke].includes(args[0]);
                    const filled = [OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke].includes(args[0]);
                    const path = pdfPathLines(closed ? [...args[1][0], 4] : args[1][0], transform, strokeColor,
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
                    ...base, id: uid(), type: 'text', x: x / PRINT_LAYOUT_WIDTH * 100, y,
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
            const editable = editablePdfTables(grids, fragments, { ...base, id: uid(), type: 'table' }, (x, y) => {
                const pixel = context.getImageData(Math.max(0, Math.min(canvas.width - 1, Math.round(x * resolution))),
                    Math.max(0, Math.min(canvas.height - 1, Math.round(y * resolution))), 1, 1).data;
                return '#' + Array.from(pixel.slice(0, 3)).map(value => value.toString(16).padStart(2, '0')).join('');
            });
            // Remove table artwork from the raster so resized cells never leave the original grid underneath.
            context.fillStyle = '#ffffff';
            for (const grid of grids) {
                const border = Math.max(1, ...grid.lines.map(line => line.width)) / 2;
                context.fillRect((grid.xs[0] - border) * resolution, (grid.ys[0] - border) * resolution,
                    (grid.xs.at(-1)! - grid.xs[0] + border * 2) * resolution,
                    (grid.ys.at(-1)! - grid.ys[0] + border * 2) * resolution);
            }
            const background = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
                (blob) => blob ? resolve(blob) : reject(new Error(`Could not render page ${number}.`)), 'image/png'));
            canvas.width = canvas.height = 0;
            elements.push(...editable.tables, ...groupPdfText(editable.remaining, regions));
            count += elements.length;
            if (count > 1000) throw new Error('This PDF requires more than 1,000 components. Split it into smaller PDFs before importing.');
            pages.push({ background, elements });
            page.cleanup();
        }
        notes.add('PDF tables with vector borders or adjoining colored cells are imported automatically as editable tables, with original column proportions, row heights, merged cells, cell colors and borders. Table text stays blank and retains its original casing. Other graphics remain page backgrounds. Review detected tables and paragraph grouping before saving. Reimport older PDF layouts to create editable tables.');
        notes.add('Embedded PDF fonts may contain only the original characters. Review replacement text for missing glyphs; choose a standard font if needed.');
        notes.add('Text baked into images or vector outlines cannot be detected or cleared. Review every imported background before saving.');
        return { pages, fonts, notes: [...notes] };
    } finally {
        await task.destroy();
    }
}
