import AiDraftButton from '@/Components/AiDraftButton';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import FormActionFab from '@/Components/FormActionFab';
import StickyDocumentToolbar from '@/Components/StickyDocumentToolbar';
import TextInput from '@/Components/TextInput';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { cn } from '@/lib/utils';
import { DownloadIcon, DraftingCompassIcon, GitBranchIcon, ListIcon, PlusIcon } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { countMark } from './pinLabels';
import OpeningEditor from './Partials/OpeningEditor';
import PdfWorkspace, { type PdfPoint } from './Partials/PdfWorkspace';
import {
    marginLabel,
    money,
    statusLabel,
    type AssemblyTemplate,
    type ConversionLine,
    type TakeoffAbilities,
    type TakeoffDetail,
} from './types';

type Props = {
    takeoff: TakeoffDetail;
    templates: AssemblyTemplate[];
    quotations: { id: number; number: string; title: string; status: string }[];
    can: TakeoffAbilities;
};

const sections = [
    { id: 'workspace', label: 'Scope' },
    { id: 'assemblies', label: 'Assemblies' },
    { id: 'review', label: 'Review' },
    { id: 'convert', label: 'Convert' },
    { id: 'history', label: 'History' },
] as const;

function openingSpecs(opening: TakeoffDetail['openings'][number]): string {
    return [
        opening.frame_type ? `Frame ${opening.frame_type}` : null,
        opening.hardware_set ? `Hardware ${opening.hardware_set}` : null,
        opening.finish,
        opening.glazing,
        opening.acoustic_requirement,
        opening.fire_requirement ? `Fire ${opening.fire_requirement}` : null,
    ].filter(Boolean).join(' · ') || '—';
}

export default function Show({ takeoff, templates, quotations, can }: Props) {
    const countedOpeningId = usePage<{ flash: { counted_opening_id?: number | null } }>().props.flash.counted_opening_id;
    const [section, setSection] = useState<(typeof sections)[number]['id']>('workspace');
    const [selectedOpeningId, setSelectedOpeningId] = useState<number | null>(null);
    const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(() => {
        try {
            const saved = Number(localStorage.getItem(`gateway.takeoff-drawing.${takeoff.uuid}`));

            if (takeoff.documents.some((item) => item.id === saved)) {
                return saved;
            }
        } catch {
            // Keep the first drawing when stored choices cannot be read.
        }

        return takeoff.documents[0]?.id ?? null;
    });

    useEffect(() => {
        if (!selectedDocumentId) {
            return;
        }

        try {
            localStorage.setItem(`gateway.takeoff-drawing.${takeoff.uuid}`, String(selectedDocumentId));
        } catch {
            // The drawing still stays selected for this visit.
        }
    }, [selectedDocumentId, takeoff.uuid]);
    const [uploadingPdf, setUploadingPdf] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const documentIds = useRef(takeoff.documents.map((document) => document.id));
    const workspaceRef = useRef<HTMLDivElement>(null);
    const [creating, setCreating] = useState(false);
    const [pendingMarker, setPendingMarker] = useState<PdfPoint | null>(null);
    const [dirty, setDirty] = useState(false);
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('');
    const [location, setLocation] = useState('');
    const [scope, setScope] = useState('');
    const [review, setReview] = useState('');
    const [groupName, setGroupName] = useState('Assembly');
    const [checked, setChecked] = useState<number[]>([]);
    const [quotationId, setQuotationId] = useState(quotations[0] ? String(quotations[0].id) : '');
    const [lines, setLines] = useState<ConversionLine[]>([]);
    const [chosen, setChosen] = useState<string[]>([]);
    const [replace, setReplace] = useState(false);
    const [previewError, setPreviewError] = useState('');
    const [importFile, setImportFile] = useState<File | null>(null);
    const [duplicateMode, setDuplicateMode] = useState<'reject' | 'flag'>('reject');
    const [importPreview, setImportPreview] = useState<{ errors: { row: number; messages: string[] }[]; duplicates: string[]; rows: unknown[] } | null>(null);
    const details = useForm({
        title: takeoff.title,
        notes: takeoff.notes ?? '',
        status: takeoff.status,
        pricing_method: takeoff.pricing_method,
        markup_percent: takeoff.markup_percent ?? '',
        margin_percent: takeoff.margin_percent ?? '',
    });
    const selected = takeoff.openings.find((opening) => opening.id === selectedOpeningId) ?? null;

    useEffect(() => {
        if (!dirty) {
            return;
        }

        const warn = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', warn);

        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    useEffect(() => {
        if (!countedOpeningId) {
            return;
        }

        const opening = takeoff.openings.find((item) => item.id === Number(countedOpeningId));

        if (!opening) {
            return;
        }

        setSelectedOpeningId(opening.id);
        setCreating(false);
        setSection('workspace');
    }, [countedOpeningId, takeoff.openings]);

    useEffect(() => {
        const ids = takeoff.documents.map((document) => document.id);
        const added = ids.find((id) => !documentIds.current.includes(id));
        documentIds.current = ids;

        if (added) {
            setSelectedDocumentId(added);
        }
    }, [takeoff.documents]);

    const uploadPdf = (file: File) => {
        const data = new FormData();
        data.append('file', file);
        data.append('document_type', 'drawing');
        setUploadError(null);
        setUploadingPdf(true);
        router.post(route('admin.takeoffs.documents.store', takeoff.uuid), data, {
            forceFormData: true,
            preserveScroll: true,
            onError: (errors) => setUploadError(errors.file ?? 'The PDF could not be uploaded.'),
            onFinish: () => setUploadingPdf(false),
        });
    };

    const lineByOpening = useMemo(
        () => new Map(takeoff.openings.map((opening, index) => [opening.id, index + 1])),
        [takeoff.openings],
    );
    const filtered = useMemo(() => takeoff.openings.filter((opening) => {
        const haystack = `${opening.tag ?? ''} ${opening.label}`.toLowerCase();

        if (query && !haystack.includes(query.toLowerCase())) {
            return false;
        }

        if (category && (opening.product_category ?? '') !== category) {
            return false;
        }

        if (location && (opening.location ?? '') !== location) {
            return false;
        }

        if (scope && opening.scope !== scope) {
            return false;
        }

        if (review === 'flagged' && opening.flags.length === 0) {
            return false;
        }

        if (review === 'clear' && opening.flags.length > 0) {
            return false;
        }

        return !review || review === 'flagged' || review === 'clear' || opening.disposition === review;
    }), [takeoff.openings, query, category, location, scope, review]);

    const openOpening = (id: number) => {
        const opening = takeoff.openings.find((item) => item.id === id);
        if (dirty && id !== selectedOpeningId && !window.confirm('This opening still has changes to save. Leave them and open the other one?')) {
            return;
        }

        setSelectedOpeningId(id);
        setCreating(false);
        const marker = opening?.markers[0];

        if (marker) {
            setSelectedDocumentId(marker.document_id);
        }
    };

    const countOpening = (point: PdfPoint, tool: 'door' | 'window') => {
        if (!can.update || takeoff.status === 'archived') {
            return;
        }

        router.post(route('admin.takeoffs.counts.store', takeoff.uuid), {
            opening_type: tool,
            document_id: point.documentId,
            page: point.page,
            x: point.x,
            y: point.y,
        }, { preserveScroll: true });
    };

    const csrf = () => decodeURIComponent(document.cookie.split('; ').find((row) => row.startsWith('XSRF-TOKEN='))?.split('=')[1] ?? '');

    const loadPreview = async () => {
        setPreviewError('');
        const body = new FormData();
        body.append('quotation_id', quotationId);
        const response = await fetch(route('admin.takeoffs.convert.preview', takeoff.uuid), {
            method: 'POST',
            headers: { Accept: 'application/json', 'X-XSRF-TOKEN': csrf(), 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'same-origin',
            body,
        });
        const payload = await response.json();

        if (!response.ok) {
            setPreviewError(payload?.errors?.quotation_id?.[0] ?? payload?.message ?? 'The preview could not be loaded.');
            setLines([]);

            return;
        }

        setLines(payload.lines ?? []);
        setChosen([]);
    };

    const previewImport = async (event: FormEvent) => {
        event.preventDefault();

        if (!importFile) {
            return;
        }

        const body = new FormData();
        body.append('file', importFile);
        const response = await fetch(route('admin.takeoffs.import.preview', takeoff.uuid), {
            method: 'POST',
            headers: { Accept: 'application/json', 'X-XSRF-TOKEN': csrf(), 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'same-origin',
            body,
        });
        setImportPreview(await response.json());
    };

    const saveDetails = (event: FormEvent) => {
        event.preventDefault();
        details.patch(route('admin.takeoffs.update', takeoff.uuid), { preserveScroll: true });
    };

        const editable = can.update && takeoff.status !== 'archived';
    const openingSummary = takeoff.openings.slice(0, 40).map((opening) => {
        const size = [opening.width, opening.height, opening.depth].filter(Boolean).join(' x ');

        return [
            opening.tag || opening.label,
            opening.opening_type,
            opening.quantity && opening.quantity !== '1' ? `qty ${opening.quantity}` : null,
            size ? `${size} ${opening.dimension_unit}` : null,
            opening.location,
        ].filter(Boolean).join(' · ');
    }).join('\n');

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-gray-100">{takeoff.title}</h2>}>
            <Head title={takeoff.title} />
            <div className="space-y-4 px-4 py-6 pb-28 sm:px-6 lg:px-8">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="text-sm text-muted-foreground">{takeoff.project?.project_number} {takeoff.project?.name} · Revision {takeoff.revision_number}</p>
                        <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-100">
                            Scope of work: {takeoff.openings.length === 0 ? 'mark each opening on the drawing' : `${takeoff.openings.length} ${takeoff.openings.length === 1 ? 'opening' : 'openings'} marked on the drawing`}
                        </p>
                        <Badge variant="outline">{statusLabel[takeoff.status] ?? takeoff.status}</Badge>
                        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Estimates are internal. Approval means this takeoff was reviewed inside Gateway. It does not certify that a product meets the specification.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                        {editable ? (
                            <Button type="button" variant="outline" size="sm" onClick={() => router.post(route('admin.takeoffs.revise', takeoff.uuid))}>
                                <GitBranchIcon data-icon="inline-start" />
                                New revision
                            </Button>
                        ) : null}
                        {can.export ? (
                            <Button type="button" variant="outline" size="sm" asChild>
                                <a href={route('admin.takeoffs.export', takeoff.uuid)}>
                                    <DownloadIcon data-icon="inline-start" />
                                    Export CSV
                                </a>
                            </Button>
                        ) : null}
                    </div>
                </div>
                {takeoff.show_pricing && takeoff.estimate ? (
                    <div className="grid gap-3 sm:grid-cols-4">
                        <Estimate label="Estimated cost" value={money(takeoff.estimate.cost)} />
                        <Estimate label="Estimated selling price" value={money(takeoff.estimate.selling)} />
                        <Estimate label="Estimated gross profit" value={money(takeoff.estimate.profit)} />
                        <Estimate label="Estimated gross margin" value={marginLabel(takeoff.estimate.margin)} />
                    </div>
                ) : null}
                <form id="takeoff-details" onSubmit={saveDetails} className="grid gap-3 rounded-lg border p-3 md:grid-cols-4">
                    <FormActionFab
                        form="takeoff-details"
                        cancelHref={route('admin.takeoffs.index')}
                        saveLabel="Save takeoff"
                        disabled={!editable || details.processing}
                    />
                    <AiDraftButton
                        surface="takeoff"
                        facts={{
                            title: takeoff.title,
                            project: takeoff.project?.name ?? '',
                            project_number: takeoff.project?.project_number ?? '',
                            status: statusLabel[takeoff.status] ?? takeoff.status,
                            revision: String(takeoff.revision_number),
                            openings: String(takeoff.openings.length),
                        }}
                        currentText={[details.data.notes, openingSummary].filter(Boolean).join('\n')}
                        onDraft={(text) => {
                            const plain = text
                                .replace(/<br\s*\/?>/gi, '\n')
                                .replace(/<\/p>/gi, '\n')
                                .replace(/<[^>]+>/g, '')
                                .replace(/\n{3,}/g, '\n\n')
                                .trim();

                            if (plain === '') {
                                return;
                            }

                            const notes = details.data.notes.trim();
                            details.setData('notes', notes === '' ? plain : `${notes}\n\n${plain}`);
                        }}
                    />
                    <label className="text-sm">Title<TextInput className="mt-1 w-full" value={details.data.title} onChange={(event) => details.setData('title', event.target.value)} /></label>
                    <label className="text-sm">Status
                        <select className="mt-1 w-full rounded-md border-gray-300 shadow-sm" value={details.data.status} onChange={(event) => details.setData('status', event.target.value)}>
                            {Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value} disabled={value === 'approved' && !can.approve}>{label}</option>)}
                        </select>
                    </label>
                    {can.pricing ? (
                        <>
                            <label className="text-sm">Pricing method
                                <select className="mt-1 w-full rounded-md border-gray-300 shadow-sm" value={details.data.pricing_method} onChange={(event) => details.setData('pricing_method', event.target.value as 'markup' | 'margin')}>
                                    <option value="markup">Markup</option>
                                    <option value="margin">Target gross margin</option>
                                </select>
                            </label>
                            {details.data.pricing_method === 'markup'
                                ? <label className="text-sm">Markup percent<TextInput className="mt-1 w-full" value={details.data.markup_percent} onChange={(event) => details.setData('markup_percent', event.target.value)} /></label>
                                : <label className="text-sm">Target margin percent<TextInput className="mt-1 w-full" value={details.data.margin_percent} onChange={(event) => details.setData('margin_percent', event.target.value)} /></label>}
                        </>
                    ) : null}
                    <label className="text-sm md:col-span-4">
                        Notes
                        <textarea
                            className="mt-1 w-full rounded-md border-gray-300 shadow-sm"
                            rows={3}
                            value={details.data.notes}
                            onChange={(event) => details.setData('notes', event.target.value)}
                        />
                    </label>
                    <div className="md:col-span-4 flex gap-2">
                        {details.errors.pricing_method ? <p className="text-sm text-destructive">{details.errors.pricing_method}</p> : null}
                        {details.errors.margin_percent ? <p className="text-sm text-destructive">{details.errors.margin_percent}</p> : null}
                    </div>
                </form>
                <div data-section-stack className="z-30 flex flex-col gap-2 bg-background pb-2 lg:sticky lg:top-[7.25rem]">
                <nav aria-label="Takeoff sections" data-document-toolbar data-pinned="true" className="rounded-xl border border-[#c5d0dc] bg-[#eef3f8] p-1.5 text-[#0a2540] shadow-sm">
                    <div className="flex gap-1 overflow-x-auto">
                        {sections.map((item, index) => {
                            const active = section === item.id;

                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    aria-current={active ? 'location' : undefined}
                                    className={cn(
                                        'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
                                        active ? 'bg-emerald-600 text-white' : 'bg-white text-[#0a2540] hover:bg-[#d6e6f8]',
                                    )}
                                    onClick={() => setSection(item.id)}
                                >
                                    <span className={cn(
                                        'flex size-5 items-center justify-center rounded-full text-[11px] font-semibold',
                                        active ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
                                    )}>
                                        {index + 1}
                                    </span>
                                    {item.label}
                                    {item.id === 'review' && takeoff.flags.length > 0 ? ` (${takeoff.flags.length})` : ''}
                                </button>
                            );
                        })}
                    </div>
                </nav>
                {section === 'workspace' ? (
                    <div className="flex flex-wrap gap-2 rounded-xl border border-[#c5d0dc] bg-[#eef3f8] p-1.5 shadow-sm">
                        <a href="#takeoff-openings" className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                            <ListIcon className="size-4" />
                            Openings
                        </a>
                        <a href="#takeoff-drawing" className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-800">
                            <DraftingCompassIcon className="size-4" />
                            Drawing
                        </a>
                    </div>
                ) : null}
                </div>

                {section === 'workspace' ? (
                    <div ref={workspaceRef} className="flex flex-col gap-3">
                        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_28rem]">
                            <div className="flex min-w-0 flex-col gap-4">
                            <div id="takeoff-drawing" className="min-w-0">
                                <PdfWorkspace
                                    documents={takeoff.documents}
                                    openings={takeoff.openings}
                                    selectedDocumentId={selectedDocumentId}
                                    selectedOpeningId={selectedOpeningId}
                                    selectedMarkerId={selected?.markers[0]?.id ?? null}
                                    canEdit={editable}
                                    onSelectDocument={setSelectedDocumentId}
                                    onSelectOpening={openOpening}
                                    onCount={countOpening}
                                    onDelete={(openingId) => {
                                        if (selectedOpeningId === openingId) {
                                            setSelectedOpeningId(null);
                                        }

                                        router.delete(route('admin.takeoffs.openings.destroy', [takeoff.uuid, openingId]), { preserveScroll: true });
                                    }}
                                    onPlace={(markerId, point) => router.patch(route('admin.takeoffs.markers.update', [takeoff.uuid, markerId]), {
                                        x: point.x,
                                        y: point.y,
                                        page: point.page,
                                        label_x: point.labelX,
                                        label_y: point.labelY,
                                    }, { preserveScroll: true })}
                                    onRename={(openingId, callout) => router.patch(route('admin.takeoffs.openings.callout', [takeoff.uuid, openingId]), { callout }, { preserveScroll: true })}
                                    onRemove={(markerId) => router.delete(route('admin.takeoffs.markers.destroy', [takeoff.uuid, markerId]), { preserveScroll: true })}
                                    onUpload={editable ? uploadPdf : undefined}
                                    onScan={editable && selectedDocumentId ? () => router.post(route('admin.takeoffs.documents.scan', [takeoff.uuid, selectedDocumentId]), {}, { preserveScroll: true }) : undefined}
                                    uploading={uploadingPdf}
                                    uploadError={uploadError}
                                />
                            </div>
                            <div id="takeoff-openings" className="flex flex-col gap-3">
                                <div>
                                    <h3 className="flex items-center gap-2 text-base font-semibold text-indigo-800">
                                        <ListIcon className="size-4" />
                                        Scope of work
                                    </h3>
                                    <p className="text-sm text-muted-foreground">Every door and window found on the drawing is listed once, with its specs. Remove any row you will not use.</p>
                                </div>
                                <div className="grid gap-2 md:grid-cols-2">
                                    <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Opening tag" />
                                    <TextInput value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Category" />
                                    <TextInput value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Location" />
                                    <select className="rounded-md border-gray-300 text-sm" value={scope} onChange={(event) => setScope(event.target.value)}>
                                        <option value="">All scopes</option>
                                        <option value="supply">Supply only</option>
                                        <option value="installation">Installation only</option>
                                        <option value="both">Supply and installation</option>
                                    </select>
                                    <select className="rounded-md border-gray-300 text-sm" value={review} onChange={(event) => setReview(event.target.value)}>
                                        <option value="">All review states</option>
                                        <option value="flagged">Has review flags</option>
                                        <option value="clear">No flags</option>
                                        <option value="active">Active</option>
                                        <option value="excluded">Excluded</option>
                                        <option value="not_applicable">Not applicable</option>
                                    </select>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    {editable ? (
                                        <Button type="button" variant="create" size="sm" onClick={() => { setCreating(true); setSelectedOpeningId(null); }}>
                                            <PlusIcon data-icon="inline-start" />
                                            Add opening
                                        </Button>
                                    ) : null}
                                    {dirty ? <p className="text-sm text-amber-700 dark:text-amber-300">Save opening to keep the location and the other fields on this tag.</p> : null}
                                </div>
                                <div className="max-h-[32rem] overflow-auto rounded-md border">
                                    <table className="min-w-full text-sm">
                                        <thead className="sticky top-0 text-left text-white">
                                            <tr>
                                                <th className="bg-[#16324F] px-2 py-2 text-right">#</th>
                                                <th className="bg-[#16324F] px-2 py-2">Tag</th>
                                                <th className="bg-[#16324F] px-2 py-2">Type</th>
                                                <th className="bg-[#16324F] px-2 py-2">Qty</th>
                                                <th className="bg-[#16324F] px-2 py-2">Size</th>
                                                <th className="bg-[#16324F] px-2 py-2">Location</th>
                                                <th className="bg-[#16324F] px-2 py-2">Specs</th>
                                                <th className="bg-[#16324F] px-2 py-2">Flags</th>
                                                {editable ? <th className="bg-[#16324F] px-2 py-2"> </th> : null}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.length === 0 ? (
                                                <tr>
                                                    <td className="px-2 py-4 text-muted-foreground" colSpan={editable ? 9 : 8}>No openings yet. Choose Count door or Count window, then click a door on the sheet.</td>
                                                </tr>
                                            ) : null}
                                            {filtered.map((opening) => (
                                                <tr key={opening.id} className={`cursor-pointer border-t ${selectedOpeningId === opening.id ? 'bg-[#3FCF8E]/20' : ''}`} onClick={() => openOpening(opening.id)}>
                                                    <td className="px-2 py-2 text-right font-semibold tabular-nums">{countMark(opening.callout, lineByOpening.get(opening.id) ?? 1)}</td>
                                                    <td className="px-2 py-2">{opening.is_bulk ? `Bulk ${opening.tag ?? ''}`.trim() : opening.tag}</td>
                                                    <td className="px-2 py-2">{opening.opening_type}</td>
                                                    <td className="px-2 py-2">{opening.quantity}</td>
                                                    <td className="px-2 py-2">{[opening.width, opening.height, opening.depth].filter(Boolean).join(' x ')} {opening.dimension_unit}</td>
                                                    <td className={`px-2 py-2 ${selectedOpeningId === opening.id ? 'font-medium' : ''}`}>{opening.location || '—'}</td>
                                                    <td className="px-2 py-2">{openingSpecs(opening)}</td>
                                                    <td className="px-2 py-2">{opening.flags.length || '—'}</td>
                                                    {editable ? (
                                                        <td className="px-2 py-2">
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={(event) => {
                                                                    event.stopPropagation();

                                                                    if (selectedOpeningId === opening.id) {
                                                                        setSelectedOpeningId(null);
                                                                    }

                                                                    router.delete(route('admin.takeoffs.openings.destroy', [takeoff.uuid, opening.id]), { preserveScroll: true });
                                                                }}
                                                            >
                                                                Remove
                                                            </Button>
                                                        </td>
                                                    ) : null}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {editable ? (
                                    <form className="space-y-2 rounded-md border p-3" onSubmit={previewImport}>
                                        <p className="text-sm font-medium">Spreadsheet import</p>
                                        <a className="text-sm text-indigo-700" href={route('admin.takeoffs.import-template')}>Download the import template</a>
                                        <input type="file" accept=".csv,text/csv" onChange={(event) => setImportFile(event.target.files?.[0] ?? null)} />
                                        <label className="block text-sm">Duplicate tags
                                            <select className="mt-1 w-full rounded-md border-gray-300" value={duplicateMode} onChange={(event) => setDuplicateMode(event.target.value as 'reject' | 'flag')}>
                                                <option value="reject">Reject the file</option>
                                                <option value="flag">Import and keep them flagged</option>
                                            </select>
                                        </label>
                                        <Button type="submit" variant="outline" size="sm">Preview import</Button>
                                        {importPreview ? (
                                            <div className="space-y-1 text-sm">
                                                <p>{importPreview.rows?.length ?? 0} valid row(s). {importPreview.errors?.length ?? 0} error row(s).</p>
                                                {importPreview.errors?.map((error) => <p key={error.row} className="text-destructive">Row {error.row}: {error.messages.join(' ')}</p>)}
                                                {importPreview.duplicates?.map((message) => <p key={message}>{message}</p>)}
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="create"
                                                    disabled={!importFile || (importPreview.errors?.length ?? 0) > 0 || (duplicateMode === 'reject' && (importPreview.duplicates?.length ?? 0) > 0)}
                                                    onClick={() => {
                                                        if (!importFile) {
                                                            return;
                                                        }

                                                        const data = new FormData();
                                                        data.append('file', importFile);
                                                        data.append('duplicate_mode', duplicateMode);
                                                        router.post(route('admin.takeoffs.import', takeoff.uuid), data, { forceFormData: true, preserveScroll: true });
                                                    }}
                                                >
                                                    Import
                                                </Button>
                                            </div>
                                        ) : null}
                                    </form>
                                ) : null}
                            </div>
                            </div>
                            <div className="order-first min-w-0 xl:order-none">
                                <StickyDocumentToolbar scopeRef={workspaceRef} propertiesPanel>
                                    <div className="flex flex-col gap-3">
                                        <OpeningEditor
                                            takeoffUuid={takeoff.uuid}
                                            opening={creating ? null : selected}
                                            openings={takeoff.openings}
                                            creating={creating}
                                            documents={takeoff.documents}
                                            pendingMarker={pendingMarker}
                                            canEdit={editable}
                                            onDirty={setDirty}
                                            onSelect={(choice) => {
                                                if (choice !== null && choice !== 'new') {
                                                    openOpening(choice);
                                                    return;
                                                }

                                                if (dirty && !window.confirm('This opening still has changes to save. Leave them and open the other one?')) {
                                                    return;
                                                }

                                                if (choice === 'new') {
                                                    setCreating(true);
                                                    setSelectedOpeningId(null);
                                                    return;
                                                }

                                                setPendingMarker(null);
                                                setCreating(false);
                                                setSelectedOpeningId(null);
                                                setDirty(false);
                                            }}
                                            onClose={() => {
                                                if (dirty && !window.confirm('This opening still has changes to save. Leave them and open the other one?')) {
                                                    return;
                                                }

                                                setPendingMarker(null);
                                                setCreating(false);
                                                setSelectedOpeningId(null);
                                                setDirty(false);
                                            }}
                                        />
                                        {selected && !creating ? (
                                            <form className="grid gap-2 rounded-md border bg-card p-3" onSubmit={(event) => {
                                                event.preventDefault();
                                                const data = Object.fromEntries(new FormData(event.currentTarget).entries());
                                                router.post(route('admin.takeoffs.references.store', [takeoff.uuid, selected.id]), data, { preserveScroll: true });
                                                event.currentTarget.reset();
                                            }}>
                                                <p className="text-sm">Add a schedule or specification reference. This does not change quantity.</p>
                                                <select name="document_id" className="rounded-md border-gray-300 text-sm">
                                                    <option value="">Document</option>
                                                    {takeoff.documents.map((item) => <option key={item.id} value={item.id}>{item.original_filename}</option>)}
                                                </select>
                                                <TextInput name="page" placeholder="Page" />
                                                <TextInput name="section" placeholder="Section" />
                                                <TextInput name="note" placeholder="Note" />
                                                {editable ? <Button type="submit" variant="outline" size="sm">Add reference</Button> : null}
                                                <ul className="text-sm text-muted-foreground">
                                                    {selected.references.map((reference) => <li key={reference.id}>{reference.section || 'Reference'} {reference.page ? `p. ${reference.page}` : ''} {reference.note}</li>)}
                                                </ul>
                                            </form>
                                        ) : null}
                                    </div>
                                </StickyDocumentToolbar>
                            </div>
                        </div>
                    </div>
                ) : null}

                {section === 'assemblies' ? (
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">Matching openings can be grouped. A manual group with different configurations stays separate and shows a warning. One-time costs, such as freight, are not multiplied by quantity.</p>
                        {editable ? (
                            <div className="flex flex-wrap items-center gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={() => router.post(route('admin.takeoffs.groups.auto', takeoff.uuid), {}, { preserveScroll: true })}>Group matching openings</Button>
                                <TextInput value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Group name" />
                                <Button type="button" variant="create" size="sm" onClick={() => router.post(route('admin.takeoffs.groups.store', takeoff.uuid), { name: groupName, opening_ids: checked }, { preserveScroll: true })}>Group selected</Button>
                            </div>
                        ) : null}
                        <div className="space-y-3">
                            {takeoff.groups.map((group) => (
                                <div key={group.id} className="rounded-md border p-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <h3 className="font-medium">{group.name}</h3>
                                        {group.mismatch ? <Badge variant="outline">Configurations differ</Badge> : null}
                                        {group.manual ? <Badge variant="outline">Manual</Badge> : <Badge variant="outline">Matched</Badge>}
                                    </div>
                                    <p className="text-sm">{group.opening_ids.map((id) => takeoff.openings.find((opening) => opening.id === id)?.label).filter(Boolean).join(', ')}</p>
                                    {group.estimate ? <p className="text-sm">Estimated cost {money(group.estimate.cost)} · selling {money(group.estimate.selling)} · quantity {group.estimate.quantity}</p> : null}
                                    {editable ? <Button type="button" variant="outline" size="sm" onClick={() => router.delete(route('admin.takeoffs.groups.destroy', [takeoff.uuid, group.id]), { preserveScroll: true })}>Ungroup</Button> : null}
                                    {can.pricing ? <CostForm takeoffUuid={takeoff.uuid} groupId={group.id} /> : null}
                                </div>
                            ))}
                        </div>
                        <div className="rounded-md border p-3">
                            <h3 className="font-medium">Openings</h3>
                            {takeoff.openings.map((opening) => (
                                <label key={opening.id} className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={checked.includes(opening.id)} onChange={(event) => setChecked((current) => event.target.checked ? [...current, opening.id] : current.filter((id) => id !== opening.id))} />
                                    {opening.label} {opening.group_id ? '(grouped)' : ''}
                                </label>
                            ))}
                        </div>
                        {can.pricing && selected ? <CostForm takeoffUuid={takeoff.uuid} openingId={selected.id} /> : <p className="text-sm text-muted-foreground">Select an opening on the schedule to add its unit costs.</p>}
                        <div className="rounded-md border p-3">
                            <h3 className="font-medium">Assembly templates</h3>
                            <p className="text-sm text-muted-foreground">Applying a template copies it onto the opening. Later template edits do not change this estimate.</p>
                            <ul className="mt-2 space-y-1 text-sm">
                                {templates.map((template) => (
                                    <li key={template.id} className="flex items-center justify-between gap-2">
                                        <span>{template.name}</span>
                                        {editable && selected ? <Button type="button" size="sm" variant="outline" onClick={() => router.post(route('admin.takeoffs.templates.apply', [takeoff.uuid, selected.id]), { template_id: template.id }, { preserveScroll: true })}>Apply to {selected.label}</Button> : null}
                                    </li>
                                ))}
                            </ul>
                            {editable ? (
                                <form className="mt-3 grid gap-2 md:grid-cols-3" onSubmit={(event) => {
                                    event.preventDefault();
                                    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
                                    router.post(route('admin.takeoffs.templates.store', takeoff.uuid), {
                                        ...data,
                                        default_costs: data.amount ? [{ kind: 'material', basis: 'per_unit', amount: data.amount, description: data.name }] : [],
                                    }, { preserveScroll: true });
                                    event.currentTarget.reset();
                                }}>
                                    <TextInput name="name" placeholder="Template name" required />
                                    <select name="opening_type" className="rounded-md border-gray-300 text-sm" defaultValue="door"><option value="door">Door</option><option value="window">Window</option></select>
                                    <TextInput name="frame_type" placeholder="Frame" />
                                    <TextInput name="hardware_set" placeholder="Hardware" />
                                    <TextInput name="glazing" placeholder="Glazing" />
                                    <TextInput name="amount" placeholder="Default material cost" />
                                    <Button type="submit" variant="create" size="sm">Save template</Button>
                                </form>
                            ) : null}
                        </div>
                        {can.pricing ? (
                            <form className="grid gap-2 rounded-md border p-3 md:grid-cols-3" onSubmit={(event) => {
                                event.preventDefault();
                                const data = new FormData(event.currentTarget);
                                if (data.get('file') instanceof File && (data.get('file') as File).size === 0) {
                                    data.delete('file');
                                }
                                router.post(route('admin.takeoffs.quotes.store', takeoff.uuid), data, { forceFormData: true, preserveScroll: true });
                            }}>
                                <h3 className="md:col-span-3 font-medium">Supplier quote</h3>
                                <TextInput name="supplier_name" placeholder="Supplier" required />
                                <TextInput name="quote_number" placeholder="Quote number" />
                                <TextInput name="revision_label" placeholder="Revision" />
                                <TextInput name="quote_date" type="date" />
                                <TextInput name="expires_at" type="date" />
                                <select name="opening_id" className="rounded-md border-gray-300 text-sm" defaultValue={selected?.id ?? ''}>
                                    <option value="">Opening</option>
                                    {takeoff.openings.map((opening) => <option key={opening.id} value={opening.id}>{opening.label}</option>)}
                                </select>
                                <textarea name="included_scope" className="rounded-md border-gray-300 text-sm" placeholder="Included scope" />
                                <textarea name="exclusions" className="rounded-md border-gray-300 text-sm" placeholder="Exclusions" />
                                <textarea name="pricing_notes" className="rounded-md border-gray-300 text-sm" placeholder="Pricing notes" />
                                <input name="file" type="file" accept="application/pdf" />
                                <Button type="submit" variant="create" size="sm">Save supplier quote</Button>
                                <ul className="md:col-span-3 space-y-2 text-sm">
                                    {takeoff.supplier_quotes.map((quote) => (
                                        <li key={quote.id} className="rounded border p-2">
                                            {quote.supplier_name} {quote.quote_number} {quote.revision_label}
                                            {quote.expired ? <Badge variant="outline">Expired</Badge> : null}
                                            {quote.accepted_at ? <Badge variant="outline">Accepted</Badge> : null}
                                            {editable && !quote.accepted_at ? <Button type="button" size="sm" variant="outline" onClick={() => router.post(route('admin.takeoffs.quotes.accept', [takeoff.uuid, quote.id]), {}, { preserveScroll: true })}>Accept</Button> : null}
                                            {editable ? <Button type="button" size="sm" variant="outline" onClick={() => router.post(route('admin.takeoffs.quotes.revise', [takeoff.uuid, quote.id]), { supplier_name: quote.supplier_name, quote_number: quote.quote_number, revision_label: 'Next' }, { preserveScroll: true })}>New revision</Button> : null}
                                        </li>
                                    ))}
                                </ul>
                            </form>
                        ) : null}
                    </div>
                ) : null}

                {section === 'review' ? (
                    <div className="space-y-2">
                        {takeoff.flags.length === 0 ? <p className="text-sm">No review flags.</p> : null}
                        {takeoff.flags.map((flag, index) => (
                            <button key={`${flag.code}-${flag.opening_id}-${index}`} type="button" className="block w-full rounded-md border p-3 text-left text-sm" onClick={() => { if (flag.opening_id) { openOpening(flag.opening_id); setSection('workspace'); setMobilePane('schedule'); } }}>
                                {flag.message}
                            </button>
                        ))}
                        {takeoff.previous ? (
                            <div className="rounded-md border p-3 text-sm">
                                <h3 className="font-medium">Compared with revision {takeoff.previous.revision_number}</h3>
                                <p>Added: {takeoff.previous.diff.added.map((item) => item.label).join(', ') || 'None'}</p>
                                <p>Removed: {takeoff.previous.diff.removed.map((item) => item.label).join(', ') || 'None'}</p>
                                <p>Changed: {takeoff.previous.diff.changed.map((item) => item.label).join(', ') || 'None'}</p>
                                <p className="mt-2">Previous documents, for a manual comparison:</p>
                                <ul>
                                    {takeoff.previous.documents.map((document) => <li key={document.id}><a className="text-indigo-700" href={document.download_url ?? '#'}>{document.original_filename}</a></li>)}
                                </ul>
                                <Link className="text-indigo-700" href={route('admin.takeoffs.show', takeoff.previous.uuid)}>Open revision {takeoff.previous.revision_number}</Link>
                            </div>
                        ) : null}
                    </div>
                ) : null}

                {section === 'convert' ? (
                    <div className="space-y-3">
                        {can.convert ? (
                            <>
                                <p className="text-sm text-muted-foreground">Selling prices are copied onto the quotation. Internal costs and supplier files stay on the takeoff. Later takeoff edits do not change the quotation unless you replace the transferred lines.</p>
                                <select className="rounded-md border-gray-300" value={quotationId} onChange={(event) => setQuotationId(event.target.value)}>
                                    {quotations.map((quotation) => <option key={quotation.id} value={quotation.id}>{quotation.number} — {quotation.title}</option>)}
                                </select>
                                <Button type="button" variant="outline" size="sm" onClick={() => void loadPreview()}>Preview lines</Button>
                                {previewError ? <p className="text-sm text-destructive">{previewError}</p> : null}
                                {lines.map((line) => (
                                    <label key={line.key} className={`block rounded-md border p-3 text-sm ${line.flags.length ? 'border-amber-400' : ''}`}>
                                        <input type="checkbox" checked={chosen.includes(line.key)} onChange={(event) => setChosen((current) => event.target.checked ? [...current, line.key] : current.filter((key) => key !== line.key))} />
                                        <span className="ml-2 font-medium">{line.label}</span>
                                        <span className="ml-2">Qty {line.quantity}</span>
                                        <span className="ml-2">{money(line.extended)}</span>
                                        {line.already_transferred ? <Badge variant="outline">Already transferred</Badge> : null}
                                        <p>{line.description}</p>
                                        <p>{line.scope}</p>
                                        {line.flags.map((flag) => <p key={flag.code} className="text-amber-700">{flag.message}</p>)}
                                    </label>
                                ))}
                                <label className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={replace} onChange={(event) => setReplace(event.target.checked)} />
                                    Replace previously transferred lines
                                </label>
                                <Button type="button" variant="create" size="sm" disabled={chosen.length === 0 || !quotationId} onClick={() => router.post(route('admin.takeoffs.convert', takeoff.uuid), { quotation_id: Number(quotationId), keys: chosen, replace }, { preserveScroll: true })}>
                                    <PlusIcon data-icon="inline-start" />
                                    Add to quotation
                                </Button>
                            </>
                        ) : <p className="text-sm">Quotation conversion is available to admins who can update quotations and see takeoff pricing.</p>}
                    </div>
                ) : null}

                {section === 'history' ? (
                    <ul className="space-y-2 text-sm">
                        {takeoff.audits.map((audit) => (
                            <li key={audit.id} className="rounded-md border p-3">
                                <span className="font-medium">{audit.summary}</span>
                                <span className="text-muted-foreground"> · {audit.user ?? 'System'} · {audit.created_at ? new Date(audit.created_at).toLocaleString() : ''}</span>
                            </li>
                        ))}
                    </ul>
                ) : null}
            </div>
        </AuthenticatedLayout>
    );
}

function Estimate({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold">{value}</p>
        </div>
    );
}

function CostForm({ takeoffUuid, openingId, groupId }: { takeoffUuid: string; openingId?: number; groupId?: number }) {
    return (
        <form className="mt-3 grid gap-2 md:grid-cols-4" onSubmit={(event) => {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(event.currentTarget).entries());
            router.post(route('admin.takeoffs.costs.store', takeoffUuid), {
                ...data,
                opening_id: openingId ?? null,
                group_id: groupId ?? null,
            }, { preserveScroll: true });
            event.currentTarget.reset();
        }}>
            <select name="kind" className="rounded-md border-gray-300 text-sm" defaultValue="material">
                <option value="material">Material</option>
                <option value="labor">Labor</option>
                <option value="freight">Freight</option>
                <option value="equipment">Equipment</option>
                <option value="subcontract">Subcontract</option>
                <option value="other">Other</option>
            </select>
            <select name="basis" className="rounded-md border-gray-300 text-sm" defaultValue="per_unit">
                <option value="per_unit">Per unit</option>
                <option value="one_time">One time</option>
            </select>
            <TextInput name="amount" placeholder="Amount" />
            <TextInput name="labor_hours" placeholder="Labor hours" />
            <TextInput name="hourly_rate" placeholder="Hourly rate" />
            <Button type="submit" variant="outline" size="sm">Add cost</Button>
        </form>
    );
}
