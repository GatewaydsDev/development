import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = worker;

const standardFonts = import.meta.glob('/node_modules/pdfjs-dist/standard_fonts/*', {
    eager: true,
    query: '?url',
    import: 'default',
});

class LocalStandardFonts {
    async fetch({ filename }: { filename: string }) {
        const url = standardFonts[`/node_modules/pdfjs-dist/standard_fonts/${filename}`];

        if (typeof url !== 'string') {
            throw new Error(`Missing PDF font: ${filename}`);
        }

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Could not load PDF font: ${filename}`);
        }

        return new Uint8Array(await response.arrayBuffer());
    }
}

const cmaps = import.meta.glob('/node_modules/pdfjs-dist/cmaps/*.bcmap', {
    eager: true,
    query: '?url',
    import: 'default',
});

class LocalCMaps {
    async fetch({ name }: { name: string }) {
        const url = cmaps[`/node_modules/pdfjs-dist/cmaps/${name}.bcmap`];

        if (typeof url !== 'string') {
            throw new Error(`Missing PDF character map: ${name}`);
        }

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Could not load PDF character map: ${name}`);
        }

        return { cMapData: new Uint8Array(await response.arrayBuffer()), compressionType: 1 };
    }
}

const wasmFiles = import.meta.glob('/node_modules/pdfjs-dist/wasm/*.wasm', {
    eager: true,
    query: '?url',
    import: 'default',
});

class LocalWasm {
    async fetch({ filename }: { filename: string }) {
        const url = wasmFiles[`/node_modules/pdfjs-dist/wasm/${filename}`];

        if (typeof url !== 'string') {
            throw new Error(`Missing PDF decoder: ${filename}`);
        }

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Could not load PDF decoder: ${filename}`);
        }

        return new Uint8Array(await response.arrayBuffer());
    }
}

type PlacedText = { x: number; y: number; text: string; width: number };
type TextLine = { y: number; parts: PlacedText[] };

function linesFromItems(items: TextItem[]): string {
    const placed: PlacedText[] = items
        .filter((item) => item.str.trim() !== '')
        .map((item) => ({
            x: item.transform[4] ?? 0,
            y: item.transform[5] ?? 0,
            text: item.str,
            width: item.width || item.str.length * 4,
        }));

    if (placed.length === 0) {
        return '';
    }

    const lines: TextLine[] = [];

    for (const item of [...placed].sort((left, right) => right.y - left.y || left.x - right.x)) {
        const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= 3);

        if (line) {
            line.parts.push(item);
        } else {
            lines.push({ y: item.y, parts: [item] });
        }
    }

    return [...lines]
        .sort((left, right) => right.y - left.y)
        .map((line) => joinLine(line.parts))
        .join('\n');
}

function joinLine(parts: PlacedText[]): string {
    const ordered = [...parts].sort((left, right) => left.x - right.x);
    let line = '';
    let cursor = Number.NEGATIVE_INFINITY;

    for (const part of ordered) {
        if (cursor !== Number.NEGATIVE_INFINITY && part.x - cursor > Math.max(2, part.width * 0.2)) {
            line += ' ';
        }

        line += part.text;
        cursor = part.x + part.width;
    }

    return line;
}

export async function addendumPdfText(file: File): Promise<string> {
    const task = getDocument({
        data: new Uint8Array(await file.arrayBuffer()),
        isEvalSupported: false,
        useSystemFonts: false,
        stopAtErrors: false,
        StandardFontDataFactory: LocalStandardFonts,
        CMapReaderFactory: LocalCMaps,
        WasmFactory: LocalWasm,
    });

    try {
        const pdf = await task.promise;
        const chunks: string[] = [];
        const pageCount = Math.min(pdf.numPages, 2);

        for (let number = 1; number <= pageCount; number += 1) {
            const page = await pdf.getPage(number);
            const content = await page.getTextContent();
            const items = content.items.filter((item): item is TextItem => 'str' in item);
            const text = linesFromItems(items);

            if (text.trim() !== '') {
                chunks.push(text);
            }

            if (chunks.join('\n').length >= 12000) {
                break;
            }
        }

        const meta = await pdf.getMetadata().catch(() => null);
        const info = (meta?.info ?? {}) as Record<string, unknown>;

        for (const key of ['Title', 'Subject', 'Keywords']) {
            const value = info[key];

            if (typeof value === 'string' && value.trim() !== '') {
                chunks.push(value);
            }
        }

        return chunks.join('\n\n').slice(0, 20000);
    } finally {
        await task.destroy();
    }
}
