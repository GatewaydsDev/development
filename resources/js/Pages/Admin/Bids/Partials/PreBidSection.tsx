import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/Components/ui/alert-dialog';
import { Button } from '@/Components/ui/button';
import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import { BookmarkIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { toast } from 'sonner';
import type { BidFormData, BidOptions, PreBidOption } from '../types';

type PreBidSectionProps = {
    options: BidOptions;
    formData: BidFormData;
    selectedPreBidId: string;
    onSelectPreBidId: (id: string) => void;
    onApplyPreBid: (preBid: PreBidOption) => void;
};

export default function PreBidSection({
    options,
    formData,
    selectedPreBidId,
    onSelectPreBidId,
    onApplyPreBid,
}: PreBidSectionProps) {
    const preBids = options.preBids ?? [];
    const [isSaveOpen, setIsSaveOpen] = useState(false);
    const [preBidName, setPreBidName] = useState('');
    const [saveError, setSaveError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [pendingPreBid, setPendingPreBid] = useState<PreBidOption | null>(null);
    const [pendingDeletePreBid, setPendingDeletePreBid] =
        useState<PreBidOption | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const isFormDirtyOrFilled = () => {
        return (
            (formData.project_id ?? '') !== '' ||
            (formData.assigned_to ?? '') !== '' ||
            (formData.scope_of_work_text ?? '').trim() !== '' ||
            (formData.notes ?? '').trim() !== '' ||
            (formData.scopes ?? []).some(
                (scope) =>
                    (scope.title_id ?? '') !== '' ||
                    (scope.products ?? []).length > 0,
            )
        );
    };

    const handlePreBidClick = (preBid: PreBidOption) => {
        if (String(preBid.id) === selectedPreBidId) {
            return;
        }

        if (isFormDirtyOrFilled()) {
            setPendingPreBid(preBid);
            return;
        }

        apply(preBid);
    };

    const apply = (preBid: PreBidOption) => {
        onSelectPreBidId(String(preBid.id));
        onApplyPreBid(preBid);
        setPendingPreBid(null);
    };

    const handleSavePreBid = (e?: FormEvent) => {
        e?.preventDefault();
        const trimmed = preBidName.trim();

        if (!trimmed) {
            setSaveError('Enter a name for the pre-bid.');
            return;
        }

        setSaveError('');
        setIsSaving(true);

        const payload = {
            name: trimmed,
            project_id: formData.project_id ? Number(formData.project_id) : null,
            assigned_to: formData.assigned_to ? Number(formData.assigned_to) : null,
            notes: formData.notes || null,
            bid_shipping_text_template_id: formData.bid_shipping_text_template_id
                ? Number(formData.bid_shipping_text_template_id)
                : null,
            bid_scope_text_template_id: formData.bid_scope_text_template_id
                ? Number(formData.bid_scope_text_template_id)
                : null,
            scope_of_work_text: formData.scope_of_work_text || null,
            scopes: formData.scopes ?? [],
            stages: formData.stages ?? [],
            revisions: formData.revisions ?? [],
            pricings: formData.pricings ?? [],
        };

        router.post(route('admin.pre-bids.store'), payload, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                setIsSaveOpen(false);
                setPreBidName('');
                router.reload({
                    only: ['options'],
                    onSuccess: (page) => {
                        const updatedOptions = page.props.options as
                            | BidOptions
                            | undefined;
                        const created = (updatedOptions?.preBids ?? []).find(
                            (item) =>
                                item.name.toLowerCase() === trimmed.toLowerCase(),
                        );
                        if (created) {
                            onSelectPreBidId(String(created.id));
                        }
                    },
                });
                toast.success(`Pre-bid “${trimmed}” saved.`);
            },
            onError: (errors) => {
                if (errors.name) {
                    setSaveError(errors.name);
                } else {
                    toast.error('Could not save pre-bid. Please check inputs.');
                }
            },
            onFinish: () => {
                setIsSaving(false);
            },
        });
    };

    const handleDeletePreBid = () => {
        if (!pendingDeletePreBid) return;

        setIsDeleting(true);
        router.delete(route('admin.pre-bids.destroy', pendingDeletePreBid.id), {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                if (selectedPreBidId === String(pendingDeletePreBid.id)) {
                    onSelectPreBidId('');
                }
                setPendingDeletePreBid(null);
                router.reload({ only: ['options'] });
                toast.success(`Pre-bid “${pendingDeletePreBid.name}” removed.`);
            },
            onError: () => {
                toast.error('Could not remove pre-bid.');
            },
            onFinish: () => {
                setIsDeleting(false);
            },
        });
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-base font-semibold text-foreground">
                        Predefined bids
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Pick a saved bid to insert it, the same way templates work. Create new saves the current form as another reusable pre-bid. You can still modify fields below.
                    </p>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <InputLabel
                    value="Saved bids"
                    className="text-emerald-700 dark:text-emerald-300"
                />
                <div className="-mx-1 flex min-w-0 items-start gap-4 overflow-x-auto overscroll-x-contain px-1 pt-1 pb-3">
                    <button
                        type="button"
                        className="w-[7.25rem] shrink-0 text-center"
                        onClick={() => {
                            setPreBidName('');
                            setSaveError('');
                            setIsSaveOpen(true);
                        }}
                    >
                        <span className="flex h-36 w-full items-center justify-center rounded-[4px] border-[3px] border-emerald-600 bg-white p-3 shadow-sm transition hover:bg-emerald-50/50 dark:bg-background dark:hover:bg-emerald-950/20">
                            <PlusIcon className="size-7 shrink-0 overflow-visible text-emerald-600" />
                        </span>
                        <span className="mt-2 block text-xs font-medium leading-4 text-foreground">
                            Create new
                        </span>
                    </button>

                    {preBids.map((preBid) => {
                        const selected = String(preBid.id) === selectedPreBidId;

                        return (
                            <div
                                key={preBid.id}
                                className="group relative w-[7.25rem] shrink-0 text-center"
                            >
                                <button
                                    type="button"
                                    aria-pressed={selected}
                                    className="w-full text-left"
                                    onClick={() => handlePreBidClick(preBid)}
                                >
                                    <span
                                        className={cn(
                                            'relative block h-36 w-full overflow-hidden rounded-[4px] bg-white p-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.12)] transition dark:bg-background',
                                            selected
                                                ? 'ring-2 ring-emerald-600 ring-offset-2 ring-offset-background'
                                                : 'border border-border hover:border-emerald-400',
                                        )}
                                    >
                                        <span className="flex flex-col gap-1.5 text-[9px] leading-tight text-slate-600 dark:text-slate-300">
                                            <span className="flex items-center gap-1 font-semibold text-foreground">
                                                <BookmarkIcon className="size-3 shrink-0 text-emerald-600" />
                                                <span className="truncate">{preBid.name}</span>
                                            </span>
                                            {preBid.project_name ? (
                                                <span className="line-clamp-2 text-muted-foreground">
                                                    Proj: {preBid.project_name}
                                                </span>
                                            ) : (
                                                <span className="italic text-muted-foreground/70">
                                                    No project set
                                                </span>
                                            )}
                                            {preBid.assignee_name ? (
                                                <span className="truncate text-muted-foreground">
                                                    By: {preBid.assignee_name}
                                                </span>
                                            ) : null}
                                            {preBid.scopes && preBid.scopes.length > 0 ? (
                                                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                                                    {preBid.scopes.length}{' '}
                                                    {preBid.scopes.length === 1 ? 'scope' : 'scopes'}
                                                </span>
                                            ) : null}
                                        </span>
                                    </span>
                                    <span className="mt-2 block truncate text-xs font-medium leading-4 text-muted-foreground">
                                        {preBid.name}
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    aria-label={`Delete pre-bid ${preBid.name}`}
                                    className="absolute -top-2 -right-2 hidden rounded-full bg-destructive p-1 text-destructive-foreground shadow hover:bg-destructive/90 focus:outline-none group-hover:block"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setPendingDeletePreBid(preBid);
                                    }}
                                >
                                    <Trash2Icon className="size-3" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Save Pre-bid Dialog */}
            <AlertDialog open={isSaveOpen} onOpenChange={setIsSaveOpen}>
                <AlertDialogContent>
                    <form onSubmit={handleSavePreBid}>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Save reusable pre-bid</AlertDialogTitle>
                            <AlertDialogDescription>
                                Save the current basic information (project, assignee, scope & shipping texts, scopes, stages, and revisions) as a reusable pre-bid template for starting new bids.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="flex flex-col gap-2 py-4">
                            <InputLabel
                                htmlFor="pre-bid-name"
                                value="Pre-bid name"
                                className="text-emerald-700 dark:text-emerald-300"
                            />
                            <TextInput
                                id="pre-bid-name"
                                value={preBidName}
                                placeholder="e.g. Standard Commercial Pre-bid"
                                onChange={(e) => setPreBidName(e.target.value)}
                                autoFocus
                            />
                            {saveError ? <InputError message={saveError} /> : null}
                        </div>
                        <AlertDialogFooter>
                            <AlertDialogCancel
                                type="button"
                                disabled={isSaving}
                                onClick={() => setIsSaveOpen(false)}
                            >
                                Cancel
                            </AlertDialogCancel>
                            <Button
                                type="submit"
                                disabled={isSaving || !preBidName.trim()}
                                className="bg-emerald-600 text-white hover:bg-emerald-700"
                            >
                                {isSaving ? 'Saving...' : 'Save pre-bid'}
                            </Button>
                        </AlertDialogFooter>
                    </form>
                </AlertDialogContent>
            </AlertDialog>

            {/* Apply Pre-bid Confirmation */}
            <AlertDialog
                open={pendingPreBid !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingPreBid(null);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Apply this pre-bid?</AlertDialogTitle>
                        <AlertDialogDescription>
                            “{pendingPreBid?.name ?? 'This pre-bid'}” will fill the basic information for this bid. You can edit it afterward. This does not save the bid.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel type="button">
                            Keep current bid
                        </AlertDialogCancel>
                        <AlertDialogAction
                            type="button"
                            onClick={() => {
                                if (pendingPreBid) {
                                    apply(pendingPreBid);
                                }
                            }}
                        >
                            Apply pre-bid
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Pre-bid Confirmation */}
            <AlertDialog
                open={pendingDeletePreBid !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingDeletePreBid(null);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete pre-bid?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete the “{pendingDeletePreBid?.name}” pre-bid? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel type="button" disabled={isDeleting}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            type="button"
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={handleDeletePreBid}
                        >
                            {isDeleting ? 'Deleting...' : 'Delete pre-bid'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
