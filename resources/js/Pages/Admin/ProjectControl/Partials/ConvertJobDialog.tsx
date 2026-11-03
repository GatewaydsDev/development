import { Button } from '@/Components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/Components/ui/dialog';
import { router } from '@inertiajs/react';
import { useState } from 'react';

export type ConvertKind = 'project' | 'takeoff';

const COPY: Record<ConvertKind, { title: string; body: string; action: string; routeName: string }> = {
    project: {
        title: 'Convert this job to a project?',
        body: 'A new project is created with this job’s name, location, value, customer and notes, and linked back to the job.',
        action: 'Create project',
        routeName: 'admin.project-control.create-project',
    },
    takeoff: {
        title: 'Convert this job to a takeoff?',
        body: 'A takeoff is created from this job’s openings. If the job has no project yet, one is created first.',
        action: 'Create takeoff',
        routeName: 'admin.project-control.create-takeoff',
    },
};

export default function ConvertJobDialog({
    kind,
    jobUuid,
    jobLabel,
    onClose,
}: {
    kind: ConvertKind | null;
    jobUuid: string;
    jobLabel?: string;
    onClose: () => void;
}) {
    const [busy, setBusy] = useState(false);
    const copy = kind ? COPY[kind] : null;

    return (
        <Dialog open={kind !== null} onOpenChange={(open) => !open && !busy && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{copy?.title}</DialogTitle>
                    <DialogDescription>
                        {jobLabel ? `${jobLabel}. ` : ''}
                        {copy?.body}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" disabled={busy} onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        disabled={busy || !copy}
                        onClick={() => {
                            if (!copy) {
                                return;
                            }

                            setBusy(true);
                            router.post(route(copy.routeName, jobUuid), {}, {
                                onFinish: () => {
                                    setBusy(false);
                                    onClose();
                                },
                            });
                        }}
                    >
                        {busy ? 'Working…' : copy?.action}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
