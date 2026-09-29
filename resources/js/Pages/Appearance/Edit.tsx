import { Badge } from '@/Components/ui/badge';
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
import { Head, router } from '@inertiajs/react';
import { CheckIcon } from 'lucide-react';
import { useState } from 'react';

type ThemeOption = {
    key: string;
    name: string;
    description: string;
    swatches: string[];
};

export default function Edit({
    themes,
    current,
}: {
    themes: ThemeOption[];
    current: string;
}) {
    const [saving, setSaving] = useState<string | null>(null);

    const chooseTheme = (theme: string) => {
        if (theme === current || saving) {
            return;
        }

        document.documentElement.dataset.dashboardTheme = theme;
        setSaving(theme);

        router.patch(
            route('appearance.update'),
            { theme },
            {
                preserveScroll: true,
                onFinish: () => setSaving(null),
                onError: () => {
                    document.documentElement.dataset.dashboardTheme = current;
                },
            },
        );
    };

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h2 className="text-xl font-semibold leading-tight text-foreground">
                        Dashboard theme
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Choose a color theme for every signed-in page. It is
                        saved to your account and restored the next time you
                        sign in.
                    </p>
                </div>
            }
        >
            <Head title="Dashboard theme" />

            <div className="py-6 sm:py-8">
                <div className="mx-auto grid max-w-5xl gap-4 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 lg:px-8">
                    {themes.map((theme) => {
                        const selected = theme.key === current;

                        return (
                            <Card
                                key={theme.key}
                                className={cn(
                                    'shadow-sm',
                                    selected && 'dash-border ring-2 dash-ring',
                                )}
                            >
                                <CardHeader>
                                    <div className="flex items-center justify-between gap-3">
                                        <CardTitle className="text-base">
                                            {theme.name}
                                        </CardTitle>
                                        {selected && (
                                            <Badge className="dash-accent border-transparent">
                                                <CheckIcon className="size-3" />
                                                Current
                                            </Badge>
                                        )}
                                    </div>
                                    <CardDescription>
                                        {theme.description}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-4">
                                    <div className="flex overflow-hidden rounded-lg border border-border">
                                        {theme.swatches.map((color) => (
                                            <span
                                                key={color}
                                                className="h-12 flex-1"
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                    <Button
                                        type="button"
                                        className={cn(
                                            selected
                                                ? 'dash-accent'
                                                : 'dash-soft dash-text dash-border border',
                                        )}
                                        disabled={selected || saving !== null}
                                        onClick={() => chooseTheme(theme.key)}
                                    >
                                        {saving === theme.key
                                            ? 'Saving...'
                                            : selected
                                              ? 'Saved'
                                              : `Use ${theme.name}`}
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
