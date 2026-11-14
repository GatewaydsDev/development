import InputError from "@/Components/InputError";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/Components/ui/alert-dialog";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/Components/ui/dialog";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, Link, router, useForm } from "@inertiajs/react";
import {
    LockIcon,
    PencilIcon,
    PlusIcon,
    ShieldCheckIcon,
    SmartphoneIcon,
    Trash2Icon,
    UsersIcon,
} from "lucide-react";
import { FormEventHandler, useState } from "react";

type Level = {
    id: number;
    uuid: string;
    name: string;
    locked: boolean;
    users_count: number;
    permissions_count: number;
    mobile_count: number;
};

type IndexProps = {
    levels: Level[];
    totalPermissions: number;
};

function Meter({ value, total }: { value: number; total: number }) {
    const percent = total > 0 ? Math.round((value / total) * 100) : 0;

    return (
        <div className="flex items-center gap-2">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                <div
                    className="h-full rounded-full bg-emerald-600"
                    style={{ width: `${percent}%` }}
                />
            </div>
            <span className="text-xs text-muted-foreground">
                {value}/{total}
            </span>
        </div>
    );
}

export default function Index({ levels, totalPermissions }: IndexProps) {
    const [createOpen, setCreateOpen] = useState(false);
    const [renaming, setRenaming] = useState<Level | null>(null);
    const [deleting, setDeleting] = useState<Level | null>(null);
    const [deleteBusy, setDeleteBusy] = useState(false);

    const createForm = useForm({ name: "" });
    const renameForm = useForm({ name: "" });

    const submitCreate: FormEventHandler = (event) => {
        event.preventDefault();
        createForm.post(route("admin.access-control.levels.store"), {
            onSuccess: () => {
                setCreateOpen(false);
                createForm.reset();
            },
        });
    };

    const submitRename: FormEventHandler = (event) => {
        event.preventDefault();

        if (!renaming) {
            return;
        }

        renameForm.patch(
            route("admin.access-control.levels.rename", renaming.uuid),
            {
                preserveScroll: true,
                onSuccess: () => setRenaming(null),
            },
        );
    };

    const confirmDelete = () => {
        if (!deleting) {
            return;
        }

        setDeleteBusy(true);
        router.delete(
            route("admin.access-control.levels.destroy", deleting.uuid),
            {
                preserveScroll: true,
                onFinish: () => {
                    setDeleteBusy(false);
                    setDeleting(null);
                },
            },
        );
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <nav className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <span>Administration</span>
                            <span>/</span>
                            <span className="text-foreground">
                                Access Control
                            </span>
                        </nav>
                        <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                            User levels
                        </h2>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" asChild>
                            <Link href={route("admin.access-control.edit")}>
                                <ShieldCheckIcon data-icon="inline-start" />
                                Permission matrix
                            </Link>
                        </Button>
                        <Button
                            onClick={() => {
                                createForm.reset();
                                createForm.clearErrors();
                                setCreateOpen(true);
                            }}
                        >
                            <PlusIcon data-icon="inline-start" />
                            Add user level
                        </Button>
                    </div>
                </div>
            }
        >
            <Head title="Access Control" />

            <div className="py-6 sm:py-8">
                <div className="flex w-full flex-col gap-6 px-4 sm:px-6 lg:px-8">
                    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">
                                            Level
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Users
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Website access
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Mobile access
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {levels.map((level) => (
                                        <tr
                                            key={level.id}
                                            className="transition hover:bg-muted/30"
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2 font-medium text-foreground">
                                                    {level.name}
                                                    {level.locked && (
                                                        <Badge variant="secondary">
                                                            <LockIcon className="size-3" />
                                                            Locked
                                                        </Badge>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                                    <UsersIcon className="size-4" />
                                                    {level.users_count}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Meter
                                                    value={
                                                        level.permissions_count
                                                    }
                                                    total={totalPermissions}
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <SmartphoneIcon className="size-4 text-muted-foreground" />
                                                    <Meter
                                                        value={
                                                            level.mobile_count
                                                        }
                                                        total={totalPermissions}
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        asChild
                                                    >
                                                        <Link
                                                            href={route(
                                                                "admin.access-control.edit",
                                                                {
                                                                    level: level.uuid,
                                                                },
                                                            )}
                                                        >
                                                            <ShieldCheckIcon data-icon="inline-start" />
                                                            Permissions
                                                        </Link>
                                                    </Button>
                                                    {!level.locked && (
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => {
                                                                    renameForm.setData(
                                                                        "name",
                                                                        level.name,
                                                                    );
                                                                    renameForm.clearErrors();
                                                                    setRenaming(
                                                                        level,
                                                                    );
                                                                }}
                                                            >
                                                                <PencilIcon data-icon="inline-start" />
                                                                Rename
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-destructive hover:text-destructive"
                                                                onClick={() =>
                                                                    setDeleting(
                                                                        level,
                                                                    )
                                                                }
                                                            >
                                                                <Trash2Icon data-icon="inline-start" />
                                                                Delete
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {levels.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={5}
                                                className="px-4 py-10 text-center text-muted-foreground"
                                            >
                                                No user levels yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent>
                    <form
                        onSubmit={submitCreate}
                        className="flex flex-col gap-4"
                    >
                        <DialogHeader>
                            <DialogTitle>Add user level</DialogTitle>
                            <DialogDescription>
                                Name the level, then choose its permissions on
                                the next screen.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col gap-2">
                            <input
                                autoFocus
                                value={createForm.data.name}
                                onChange={(event) =>
                                    createForm.setData(
                                        "name",
                                        event.target.value,
                                    )
                                }
                                placeholder="e.g. Estimator"
                                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm focus:border-ring focus:ring-ring"
                            />
                            <InputError message={createForm.errors.name} />
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setCreateOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={
                                    createForm.processing ||
                                    createForm.data.name.trim().length < 2
                                }
                            >
                                Create level
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={renaming !== null}
                onOpenChange={(open) => !open && setRenaming(null)}
            >
                <DialogContent>
                    <form
                        onSubmit={submitRename}
                        className="flex flex-col gap-4"
                    >
                        <DialogHeader>
                            <DialogTitle>Rename user level</DialogTitle>
                            <DialogDescription>
                                Users keep this level after it is renamed.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col gap-2">
                            <input
                                autoFocus
                                value={renameForm.data.name}
                                onChange={(event) =>
                                    renameForm.setData(
                                        "name",
                                        event.target.value,
                                    )
                                }
                                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm focus:border-ring focus:ring-ring"
                            />
                            <InputError message={renameForm.errors.name} />
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setRenaming(null)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={
                                    renameForm.processing ||
                                    renameForm.data.name.trim().length < 2
                                }
                            >
                                Save
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={deleting !== null}
                onOpenChange={(open) =>
                    !open && !deleteBusy && setDeleting(null)
                }
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete {deleting?.name}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleting && deleting.users_count > 0
                                ? `${deleting.users_count} user(s) still use this level. Reassign them before deleting it.`
                                : "This permanently removes the user level and its permissions."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteBusy}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={deleteBusy}
                            onClick={(event) => {
                                event.preventDefault();
                                confirmDelete();
                            }}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AuthenticatedLayout>
    );
}
