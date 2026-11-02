import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/Components/ui/alert-dialog';
import { Button } from '@/Components/ui/button';
import { router } from '@inertiajs/react';
import { LogOutIcon } from 'lucide-react';
import { useState } from 'react';

export default function LogoutConfirmDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [busy, setBusy] = useState(false);

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300 sm:mx-0">
                        <LogOutIcon className="size-6" />
                    </span>
                    <AlertDialogTitle>Ready to log out?</AlertDialogTitle>
                    <AlertDialogDescription>
                        You will be signed out of Gateway. Any unsaved changes
                        on this page will be lost.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Stay signed in</AlertDialogCancel>
                    <Button
                        variant="destructive"
                        disabled={busy}
                        onClick={() => {
                            setBusy(true);
                            router.post(route('logout'), undefined, {
                                onFinish: () => setBusy(false),
                            });
                        }}
                    >
                        <LogOutIcon data-icon="inline-start" />
                        Yes, log out
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
