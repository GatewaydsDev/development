import { Badge } from '@/Components/ui/badge';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { Separator } from '@/Components/ui/separator';
import PublicLayout from '@/Layouts/PublicLayout';
import { Head } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';

const values = ['uptime', 'service', 'growth'];
const audiences = [
    'contractors',
    'facility',
    'property',
    'education',
    'healthcare',
    'industrial',
];
const snapshotItems = [
    ['01', 'assessment'],
    ['02', 'fit'],
    ['03', 'support'],
];

export default function About() {
    const { t } = useTranslation('about');

    return (
        <PublicLayout>
            <Head title={t('meta.title')} />

            <section className="relative overflow-hidden border-b border-border">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(52,211,153,0.18),_transparent_30%)]" />
                <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-32">
                    <div className="max-w-3xl">
                        <Badge
                            variant="outline"
                            className="border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                        >
                            {t('hero.badge')}
                        </Badge>
                        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                            {t('hero.title')}
                        </h1>
                        <p className="mt-6 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                            {t('hero.description')}
                        </p>
                    </div>
                </div>
            </section>

            <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
                <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
                    <Card className="border-border bg-card text-card-foreground">
                        <CardHeader>
                            <CardDescription className="uppercase tracking-[0.2em]">
                                {t('snapshot.label')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-6">
                            {snapshotItems.map(([value, label]) => (
                                <div
                                    key={label}
                                    className="flex items-center justify-between gap-4"
                                >
                                    <p className="text-4xl font-semibold text-emerald-700 dark:text-emerald-300">
                                        {value}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {t(`snapshot.items.${label}`)}
                                    </p>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                            {t('role.eyebrow')}
                        </p>
                        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                            {t('role.title')}
                        </h2>
                        <p className="mt-5 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                            {t('role.description')}
                        </p>

                        <div className="mt-10 grid gap-4 md:grid-cols-3">
                            {values.map((item) => (
                                <Card
                                    key={item}
                                    className="border-border bg-card text-card-foreground"
                                >
                                    <CardHeader className="p-5 sm:p-6">
                                        <CardTitle className="text-base">
                                            {t(`values.${item}.title`)}
                                        </CardTitle>
                                        <CardDescription className="leading-6">
                                            {t(`values.${item}.description`)}
                                        </CardDescription>
                                    </CardHeader>
                                </Card>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section className="border-y border-border bg-muted/30">
                <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1fr_1fr] lg:px-8 lg:py-24">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                            {t('audiences.eyebrow')}
                        </p>
                        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                            {t('audiences.title')}
                        </h2>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {audiences.map((audience) => (
                            <div
                                key={audience}
                                className="rounded-xl border border-border bg-card p-5 text-sm font-medium text-card-foreground"
                            >
                                {t(`audiences.items.${audience}`)}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
                <div className="max-w-3xl">
                    <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                        {t('next.eyebrow')}
                    </p>
                    <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                        {t('next.title')}
                    </h2>
                    <Separator className="my-8" />
                    <p className="text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                        {t('next.description')}
                    </p>
                </div>
            </section>
        </PublicLayout>
    );
}
