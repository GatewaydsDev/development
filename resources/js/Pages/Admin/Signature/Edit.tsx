import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import SignaturePad from '@/Components/SignaturePad';
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
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { cn } from '@/lib/utils';
import {
    renderStyledSignature,
    SIGNATURE_FONT_HREF,
    SIGNATURE_STYLES,
    waitForSignatureFonts,
} from '@/lib/signatureStyles';
import { Head, useForm } from '@inertiajs/react';
import { FormEventHandler, useEffect, useState } from 'react';

type EditProps = {
    signature: {
        url: string | null;
        has_signature: boolean;
        name: string;
    };
};

export default function Edit({ signature }: EditProps) {
    const [mode, setMode] = useState<'draw' | 'style'>('style');
    const [displayName, setDisplayName] = useState(signature.name);
    const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
    const [fontsReady, setFontsReady] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const { data, setData, errors, processing, patch, delete: destroy } =
        useForm<{
            signature: string;
        }>({
            signature: '',
        });

    useEffect(() => {
        let cancelled = false;

        waitForSignatureFonts().then(() => {
            if (!cancelled) {
                setFontsReady(true);
            }
        });

        return () => {
            cancelled = true;
        };
    }, []);

    const submit: FormEventHandler = (event) => {
        event.preventDefault();

        patch(route('admin.signature.update'), {
            preserveScroll: true,
        });
    };

    const applyStyle = async (styleId: string, name = displayName) => {
        const style = SIGNATURE_STYLES.find((item) => item.id === styleId);

        if (!style) {
            return;
        }

        const rendered = await renderStyledSignature(name, style);

        if (!rendered) {
            return;
        }

        setSelectedStyle(style.id);
        setMode('style');
        setData('signature', rendered);
    };

    const clearPad = () => {
        const canvas = document.querySelector<HTMLCanvasElement>(
            'canvas.signature-pad',
        );

        if (canvas) {
            const context = canvas.getContext('2d');

            if (context) {
                context.fillStyle = '#ffffff';
                context.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
            }
        }

        setSelectedStyle(null);
        setData('signature', '');
    };

    const removeSignature = () => {
        destroy(route('admin.signature.destroy'), {
            onFinish: () => setIsDeleteOpen(false),
        });
    };

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <nav
                        aria-label="Breadcrumb"
                        className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
                    >
                        <span>Administration</span>
                        <span>/</span>
                        <span className="text-foreground">Signature</span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Signature
                    </h2>
                </div>
            }
        >
            <Head title="Signature">
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link
                    rel="preconnect"
                    href="https://fonts.gstatic.com"
                    crossOrigin=""
                />
                <link href={SIGNATURE_FONT_HREF} rel="stylesheet" />
            </Head>

            <div className="py-6 sm:py-10">
                <div className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-6 px-4 sm:px-6 lg:px-8">
                    <Card className="shadow-sm">
                        <CardHeader className="p-6 sm:p-8">
                            <CardTitle className="text-2xl">
                                Authorized representative signature
                            </CardTitle>
                            <CardDescription className="max-w-2xl text-base leading-7">
                                Choose a suggested signature style or draw your
                                own. Quotations and bids will use this signature
                                in the Submitted by block whenever you are the
                                authorized representative.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 pt-0 sm:p-8 sm:pt-0">
                            <form
                                onSubmit={submit}
                                className="flex flex-col gap-6"
                            >
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        type="button"
                                        variant={
                                            mode === 'style'
                                                ? 'default'
                                                : 'outline'
                                        }
                                        onClick={() => setMode('style')}
                                    >
                                        Suggested styles
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={
                                            mode === 'draw'
                                                ? 'default'
                                                : 'outline'
                                        }
                                        onClick={() => setMode('draw')}
                                    >
                                        Draw signature
                                    </Button>
                                </div>

                                {mode === 'style' ? (
                                    <div className="flex flex-col gap-4">
                                        <div>
                                            <InputLabel
                                                htmlFor="signature-name"
                                                value="Name to sign"
                                            />
                                            <TextInput
                                                id="signature-name"
                                                className="mt-1.5 block w-full max-w-md"
                                                value={displayName}
                                                onChange={(event) => {
                                                    const nextName =
                                                        event.target.value;
                                                    setDisplayName(nextName);

                                                    if (selectedStyle) {
                                                        void applyStyle(
                                                            selectedStyle,
                                                            nextName,
                                                        );
                                                    }
                                                }}
                                            />
                                            <p className="mt-1.5 text-sm text-muted-foreground">
                                                Edit this if you want a shorter
                                                signature, such as a first name
                                                or initials.
                                            </p>
                                        </div>

                                        <div className="grid gap-3 sm:grid-cols-2">
                                            {SIGNATURE_STYLES.map((style) => {
                                                const selected =
                                                    selectedStyle === style.id;

                                                return (
                                                    <button
                                                        key={style.id}
                                                        type="button"
                                                        disabled={
                                                            displayName.trim() ===
                                                            ''
                                                        }
                                                        onClick={() =>
                                                            void applyStyle(
                                                                style.id,
                                                            )
                                                        }
                                                        className={cn(
                                                            'flex min-h-24 flex-col items-start justify-center rounded-lg border bg-white px-4 py-3 text-left transition',
                                                            selected
                                                                ? 'border-emerald-600 ring-2 ring-emerald-600/20'
                                                                : 'border-border hover:border-emerald-400',
                                                        )}
                                                    >
                                                        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                            {style.label}
                                                        </span>
                                                        <span
                                                            className="mt-1 block w-full truncate text-[32px] leading-none text-zinc-900"
                                                            style={{
                                                                fontFamily: `"${style.fontFamily}", cursive`,
                                                                opacity:
                                                                    fontsReady
                                                                        ? 1
                                                                        : 0.55,
                                                            }}
                                                        >
                                                            {displayName.trim() ||
                                                                'Your name'}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {data.signature ? (
                                            <div className="rounded-lg border border-border bg-muted/30 p-4">
                                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                    Selected signature
                                                </p>
                                                <img
                                                    src={data.signature}
                                                    alt="Selected signature style"
                                                    className="mt-2 h-16 max-w-[280px] object-contain object-left"
                                                />
                                            </div>
                                        ) : null}
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        <SignaturePad
                                            className="signature-pad"
                                            value={
                                                data.signature ||
                                                signature.url
                                            }
                                            onChange={(value) => {
                                                setSelectedStyle(null);
                                                setData(
                                                    'signature',
                                                    value ?? '',
                                                );
                                            }}
                                        />
                                        <p className="text-sm text-muted-foreground">
                                            Use your mouse or finger to sign in
                                            the box.
                                        </p>
                                    </div>
                                )}

                                <InputError message={errors.signature} />

                                {signature.has_signature && !data.signature ? (
                                    <p className="text-sm text-muted-foreground">
                                        A saved signature is already on file.
                                        Choose a new style or draw a
                                        replacement, or remove it below.
                                    </p>
                                ) : null}

                                {signature.has_signature &&
                                !data.signature &&
                                signature.url ? (
                                    <div className="rounded-lg border border-border bg-muted/30 p-4">
                                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                            Current signature
                                        </p>
                                        <img
                                            src={signature.url}
                                            alt="Saved signature"
                                            className="mt-2 h-16 max-w-[240px] object-contain object-left"
                                        />
                                    </div>
                                ) : null}

                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <Button
                                        type="submit"
                                        disabled={
                                            processing || data.signature === ''
                                        }
                                    >
                                        {signature.has_signature
                                            ? 'Update signature'
                                            : 'Save signature'}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={clearPad}
                                    >
                                        Clear selection
                                    </Button>
                                    {signature.has_signature ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="border-destructive/30 text-destructive hover:bg-destructive/10"
                                            onClick={() => setIsDeleteOpen(true)}
                                        >
                                            Remove signature
                                        </Button>
                                    ) : null}
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove saved signature?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to remove your saved signature? Documents will show a blank signature line until you save a new one.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            type="button"
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={removeSignature}
                        >
                            Remove signature
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AuthenticatedLayout>
    );
}
