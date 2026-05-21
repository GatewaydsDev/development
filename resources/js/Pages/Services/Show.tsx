import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { serviceDefinitionsByKey, type ServiceKey } from '@/data/services';
import PublicLayout from '@/Layouts/PublicLayout';
import { openContactForm } from '@/lib/contact';
import { cn } from '@/lib/utils';
import { Head } from '@inertiajs/react';
import {
    CheckCircle2Icon,
    ClipboardCheckIcon,
    DoorOpenIcon,
    FileCheck2Icon,
    RulerIcon,
    ShieldCheckIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

type ServiceShowProps = {
    serviceKey: ServiceKey;
    serviceSlug: string;
    canonicalUrl: string;
};

const capabilityItems = [
    { key: 'performance', Icon: ShieldCheckIcon },
    { key: 'coordination', Icon: RulerIcon },
    { key: 'handoff', Icon: ClipboardCheckIcon },
];

const applicationItems = ['secureAreas', 'retrofits', 'facilities', 'hardware'];
const processItems = ['review', 'coordinate', 'install', 'verify'];

export default function ServiceShow({
    serviceKey,
    serviceSlug,
    canonicalUrl,
}: ServiceShowProps) {
    const { t } = useTranslation('services');
    const service = serviceDefinitionsByKey[serviceKey];

    if (!service) {
        return (
            <PublicLayout>
                <Head title={t('notFound.metaTitle')} />
                <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
                    <h1 className="text-3xl font-semibold tracking-tight">
                        {t('notFound.title')}
                    </h1>
                    <p className="mt-4 text-muted-foreground">
                        {t('notFound.description')}
                    </p>
                </section>
            </PublicLayout>
        );
    }

    const ServiceIcon = service.Icon;
    const isRadioFrequencyDoors = serviceKey === 'radioFrequencyDoors';
    const servicePath = `services.${service.key}`;
    const metaTitle = t(`${servicePath}.metaTitle`);
    const metaDescription = t(`${servicePath}.metaDescription`);
    const imageUrl = new URL(service.images.hero, canonicalUrl).href;
    const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: t(`${servicePath}.title`),
        description: metaDescription,
        serviceType: t(`${servicePath}.title`),
        provider: {
            '@type': 'LocalBusiness',
            name: 'Gateway Door Systems',
        },
        url: canonicalUrl,
        image: imageUrl,
        areaServed: 'United States',
        mainEntityOfPage: canonicalUrl,
        identifier: serviceSlug,
    };

    const heroIntro = (
        <>
            <Badge
                variant="outline"
                className="border-emerald-500/20 bg-background/70 text-emerald-700 dark:text-emerald-300"
            >
                <ServiceIcon className="size-4" />
                {t('shared.heroBadge')}
            </Badge>

            <h1 className="mt-6 max-w-4xl text-3xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                {t(`${servicePath}.title`)}
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                {t(`${servicePath}.description`)}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row">
                <Button
                    type="button"
                    size="lg"
                    className="w-full sm:w-auto"
                    onClick={openContactForm}
                >
                    {t('shared.primaryCta')}
                </Button>

                <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="w-full bg-background/70 sm:w-auto"
                >
                    <a href="/#services">{t('shared.secondaryCta')}</a>
                </Button>
            </div>
        </>
    );

    return (
        <PublicLayout>
            <Head title={metaTitle}>
                <meta name="description" content={metaDescription} />
                <link rel="canonical" href={canonicalUrl} />
                <meta property="og:title" content={metaTitle} />
                <meta property="og:description" content={metaDescription} />
                <meta property="og:type" content="website" />
                <meta property="og:url" content={canonicalUrl} />
                <meta property="og:image" content={imageUrl} />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content={metaTitle} />
                <meta name="twitter:description" content={metaDescription} />
                <meta name="twitter:image" content={imageUrl} />
                <script type="application/ld+json">
                    {JSON.stringify(structuredData)}
                </script>
            </Head>

            <section className="relative overflow-hidden border-b border-border bg-background">
                {isRadioFrequencyDoors ? (
                    <div className="relative mx-auto grid max-w-7xl lg:grid-cols-[minmax(0,1.22fr)_minmax(0,0.68fr)] lg:items-center lg:gap-10 xl:gap-14">
                        <div className="relative flex flex-col justify-center px-4 py-12 sm:px-6 sm:py-16 lg:border-r lg:border-border/60 lg:px-10 lg:py-24 xl:px-14">
                            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.14),_transparent_42%),linear-gradient(rgba(0,0,0,0.02)_1px,_transparent_1px),linear-gradient(90deg,_rgba(0,0,0,0.02)_1px,_transparent_1px)] bg-[size:auto_auto,56px_56px,56px_56px] dark:bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.12),_transparent_42%),linear-gradient(rgba(255,255,255,0.025)_1px,_transparent_1px),linear-gradient(90deg,_rgba(255,255,255,0.025)_1px,_transparent_1px)]" />

                            <div className="relative max-w-xl xl:max-w-2xl">
                                {heroIntro}
                            </div>
                        </div>

                        <div className="relative flex min-h-[240px] flex-col items-end justify-center bg-gradient-to-bl from-muted/25 via-transparent to-transparent px-6 py-10 sm:min-h-[320px] lg:min-h-[min(88svh,44rem)] lg:px-8 lg:py-16 xl:px-12">
                            <img
                                src={service.images.hero}
                                alt={t(`${servicePath}.imageAlt`)}
                                className="h-auto w-full max-w-[min(100%,18rem)] object-contain object-right drop-shadow-[0_28px_56px_-18px_rgba(6,78,59,0.28)] dark:drop-shadow-[0_28px_56px_-14px_rgba(0,0,0,0.45)] sm:max-w-[22rem] lg:max-h-[min(78vh,40rem)] lg:max-w-[26rem] xl:max-w-[30rem]"
                            />
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.18),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.12),_transparent_36%)]" />
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.035)_1px,_transparent_1px),linear-gradient(90deg,_rgba(0,0,0,0.035)_1px,_transparent_1px)] bg-[size:56px_56px] dark:bg-[linear-gradient(rgba(255,255,255,0.035)_1px,_transparent_1px),linear-gradient(90deg,_rgba(255,255,255,0.035)_1px,_transparent_1px)]" />

                        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:gap-12 sm:px-6 sm:py-20 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:px-8 lg:py-28">
                            <div>{heroIntro}</div>

                            <div className="relative">
                                <div className="absolute -inset-4 rounded-[2rem] bg-emerald-400/15 blur-3xl" />

                                <div className="relative">
                                    <img
                                        src={service.images.hero}
                                        alt={t(`${servicePath}.imageAlt`)}
                                        className="h-72 w-full rounded-2xl bg-muted/50 object-contain shadow-2xl shadow-emerald-950/20 transition duration-700 hover:scale-[1.01] sm:h-[28rem] sm:rounded-3xl lg:h-[34rem]"
                                    />
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </section>

            <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
                <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-10">
                    <div>
                        <Badge
                            variant="outline"
                            className="border-emerald-500/20 bg-background/70 text-emerald-700 dark:text-emerald-300"
                        >
                            {t('shared.overviewBadge')}
                        </Badge>

                        <h2 className="mt-5 text-2xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                            {t(`${servicePath}.overviewTitle`)}
                        </h2>
                    </div>

                    <Card className="border-border bg-card text-card-foreground">
                        <CardContent className="p-6 sm:p-8">
                            <p className="text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                                {t(`${servicePath}.overviewText`)}
                            </p>
                            <p className="mt-5 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                                {t(`${servicePath}.supportText`)}
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </section>

            <section className="border-y border-border bg-muted/30">
                <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
                    <div className="mb-8 max-w-3xl sm:mb-10">
                        <Badge
                            variant="outline"
                            className="border-emerald-500/20 bg-background/70 text-emerald-700 dark:text-emerald-300"
                        >
                            {t('shared.capabilitiesBadge')}
                        </Badge>

                        <h2 className="mt-5 text-2xl font-semibold tracking-tight text-foreground sm:text-4xl">
                            {t(`${servicePath}.title`)}
                        </h2>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        {capabilityItems.map(({ key, Icon }) => (
                            <Card
                                key={key}
                                className="border-border bg-background/80 text-card-foreground transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-950/10"
                            >
                                <CardHeader>
                                    <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-emerald-500/10">
                                        <Icon className="size-5 text-emerald-700 dark:text-emerald-300" />
                                    </div>

                                    <CardTitle className="text-base">
                                        {t(`shared.capabilityTitles.${key}`)}
                                    </CardTitle>

                                    <CardDescription className="leading-6">
                                        {t(
                                            `${servicePath}.capabilities.${key}`,
                                        )}
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[0.95fr_1.05fr] lg:items-start lg:gap-10 lg:px-8 lg:py-24">
                <div>
                    <Badge
                        variant="outline"
                        className="border-emerald-500/20 bg-background/70 text-emerald-700 dark:text-emerald-300"
                    >
                        {t('shared.applicationsBadge')}
                    </Badge>

                    <h2 className="mt-5 text-2xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                        {t(`${servicePath}.title`)}
                    </h2>

                    <img
                        src={service.images.detail}
                        alt={t(`${servicePath}.imageAlt`)}
                        className={cn(
                            'mt-6 w-full rounded-2xl object-contain transition duration-700 hover:scale-[1.01] sm:mt-8 sm:rounded-3xl',
                            isRadioFrequencyDoors
                                ? 'h-[22rem] border-0 bg-transparent p-0 shadow-none ring-0 outline-none sm:h-[30rem] lg:h-[36rem]'
                                : 'h-72 border border-border bg-muted/50 p-2 shadow-xl shadow-emerald-950/10 sm:h-96 lg:h-[28rem]',
                        )}
                    />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                    {applicationItems.map((item) => (
                        <div
                            key={item}
                            className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-sm font-medium text-card-foreground"
                        >
                            <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                            <span>{t(`${servicePath}.applications.${item}`)}</span>
                        </div>
                    ))}
                </div>
            </section>

            <section className="border-y border-border bg-muted/30">
                <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1fr_0.9fr] lg:items-start lg:gap-10 lg:px-8 lg:py-24">
                    <div>
                        <Badge
                            variant="outline"
                            className="border-emerald-500/20 bg-background/70 text-emerald-700 dark:text-emerald-300"
                        >
                            {t('shared.processBadge')}
                        </Badge>

                        <h2 className="mt-5 text-2xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                            {t('shared.processTitle')}
                        </h2>

                        <p className="mt-5 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                            {t('shared.processDescription')}
                        </p>
                    </div>

                    <Card className="overflow-hidden border-emerald-400/20 bg-emerald-400 text-zinc-950">
                        <CardContent className="flex flex-col gap-5 p-6 sm:p-8">
                            {processItems.map((item, index) => (
                                <div key={item} className="flex gap-4">
                                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white">
                                        {String(index + 1).padStart(2, '0')}
                                    </div>

                                    <div>
                                        <h3 className="font-semibold">
                                            {t(`process.${item}.title`)}
                                        </h3>

                                        <p className="mt-1 text-sm leading-6 text-zinc-950/75">
                                            {t(`process.${item}.description`)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </section>

            <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
                <Card className="overflow-hidden border-emerald-400/20 bg-emerald-950 text-white">
                    <CardContent className="grid gap-6 bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.35),_transparent_36%),linear-gradient(135deg,_rgba(6,78,59,0.92),_rgba(6,95,70,0.72)_48%,_rgba(2,6,23,0.98))] p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center lg:p-10">
                        <div>
                            <div className="mb-4 flex size-10 items-center justify-center rounded-full bg-white/10">
                                <DoorOpenIcon className="size-5" />
                            </div>

                            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-100">
                                {t('shared.ctaEyebrow')}
                            </p>

                            <h2 className="mt-3 text-xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
                                {t('shared.ctaTitle')}
                            </h2>

                            <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/75">
                                {t('shared.ctaDescription')}
                            </p>
                        </div>

                        <Button
                            type="button"
                            variant="secondary"
                            size="lg"
                            className="w-full md:w-auto"
                            onClick={openContactForm}
                        >
                            {t('shared.ctaButton')}
                        </Button>
                    </CardContent>
                </Card>
            </section>
        </PublicLayout>
    );
}

