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
import { deviceName, passkeysSupported, registerPasskey } from '@/lib/passkeys';
import { router } from '@inertiajs/react';
import { ScanFaceIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';

export type Passkey = { id: string; alias: string; created_at: string | null };

export default function PasskeysForm({
    passkeys,
    className = '',
}: {
    passkeys: Passkey[];
    className?: string;
}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [removeTarget, setRemoveTarget] = useState<Passkey | null>(null);

    const add = async () => {
        setBusy(true);
        setError(null);

        try {
            await registerPasskey(
                route('webauthn.register.options'),
                route('webauthn.register'),
                deviceName(),
            );
            router.reload({ only: ['passkeys'] });
        } catch (e) {
            setError(
                (e as Error).name === 'NotAllowedError'
                    ? 'Setup was cancelled or this device has no Face ID / fingerprint set up.'
                    : (e as Error).message,
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className={className}>
            <header>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                    <ScanFaceIcon className="size-5 text-violet-600 dark:text-violet-300" />
                    Face ID / fingerprint sign in
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Use Face ID, Touch ID or Android biometrics to sign in
                    without typing your password. Add each device you use.
                </p>
            </header>

            <ul className="mt-4 divide-y divide-border rounded-md border border-border">
                {passkeys.length === 0 && (
                    <li className="p-3 text-sm text-muted-foreground">
                        No devices added yet.
                    </li>
                )}
                {passkeys.map((passkey) => (
                    <li
                        key={passkey.id}
                        className="flex items-center justify-between gap-3 p-3 text-sm"
                    >
                        <span className="flex items-center gap-2 text-foreground">
                            <ScanFaceIcon className="size-4" />
                            {passkey.alias}
                            {passkey.created_at && (
                                <span className="text-xs text-muted-foreground">
                                    added {passkey.created_at}
                                </span>
                            )}
                        </span>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setRemoveTarget(passkey)}
                        >
                            <Trash2Icon className="size-4" />
                            Remove
                        </Button>
                    </li>
                ))}
            </ul>

            <div className="mt-4 flex flex-col gap-2">
                {passkeysSupported() ? (
                    <Button
                        type="button"
                        className="w-fit"
                        disabled={busy}
                        onClick={add}
                    >
                        <ScanFaceIcon className="size-4" />
                        Add this device
                    </Button>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        This browser does not support passkeys.
                    </p>
                )}
                {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <AlertDialog
                open={removeTarget !== null}
                onOpenChange={(open) => !open && setRemoveTarget(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Remove {removeTarget?.alias}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This device will no longer be able to sign in with
                            Face ID or fingerprint. You can add it again later.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            type="button"
                            onClick={() => {
                                if (removeTarget) {
                                    router.delete(
                                        route('webauthn.destroy', removeTarget.id),
                                        { preserveScroll: true },
                                    );
                                }
                                setRemoveTarget(null);
                            }}
                        >
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </section>
    );
}
