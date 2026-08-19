import ApplicationLogo from '@/Components/ApplicationLogo';
import { cn } from '@/lib/utils';
import {
    CheckCircle2Icon,
    ClipboardListIcon,
    DoorOpenIcon,
    FlameIcon,
    SettingsIcon,
    WrenchIcon,
    type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const featureItems: Array<{
    key: 'steel' | 'fire' | 'commercial' | 'custom';
    index: string;
    Icon: LucideIcon;
    accent: string;
    well: string;
    glow: string;
    texture: string;
}> = [
    {
        key: 'steel',
        index: '01',
        Icon: DoorOpenIcon,
        accent: 'from-slate-950 via-emerald-950 to-slate-900',
        well: 'border-emerald-300/50 bg-emerald-400/10 text-emerald-200',
        glow: 'bg-emerald-400/20',
        texture:
            'bg-[linear-gradient(115deg,rgba(148,163,184,0.16)_0%,transparent_42%),repeating-linear-gradient(90deg,rgba(255,255,255,0.05)_0_1px,transparent_1px_18px)]',
    },
    {
        key: 'fire',
        index: '02',
        Icon: FlameIcon,
        accent: 'from-emerald-950 via-orange-950/80 to-slate-950',
        well: 'border-orange-300/50 bg-orange-400/10 text-orange-200',
        glow: 'bg-orange-400/25',
        texture:
            'bg-[radial-gradient(circle_at_80%_0%,rgba(251,146,60,0.28),transparent_46%),radial-gradient(circle_at_20%_100%,rgba(16,185,129,0.18),transparent_40%)]',
    },
    {
        key: 'commercial',
        index: '03',
        Icon: ClipboardListIcon,
        accent: 'from-slate-950 via-teal-950 to-emerald-950',
        well: 'border-teal-200/50 bg-teal-400/10 text-teal-100',
        glow: 'bg-teal-300/20',
        texture:
            'bg-[linear-gradient(rgba(45,212,191,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(45,212,191,0.08)_1px,transparent_1px)] bg-[size:18px_18px]',
    },
    {
        key: 'custom',
        index: '04',
        Icon: WrenchIcon,
        accent: 'from-emerald-950 via-slate-900 to-zinc-950',
        well: 'border-lime-200/40 bg-lime-400/10 text-lime-100',
        glow: 'bg-lime-300/20',
        texture:
            'bg-[conic-gradient(from_210deg_at_90%_10%,rgba(163,230,53,0.16),transparent_40%),radial-gradient(circle_at_0%_100%,rgba(16,185,129,0.2),transparent_42%)]',
    },
];

const footerItems: Array<{
    key: 'builtToLast' | 'quality' | 'madeInUsa';
    Icon: LucideIcon;
}> = [
    { key: 'builtToLast', Icon: CheckCircle2Icon },
    { key: 'quality', Icon: CheckCircle2Icon },
    { key: 'madeInUsa', Icon: SettingsIcon },
];

export default function HeroProductCard() {
    const { t } = useTranslation('home');

    return (
        <div className="overflow-hidden bg-white text-zinc-950">
            <div className="px-5 py-6 sm:px-7 sm:py-7">
                <ApplicationLogo className="size-20 sm:size-24" />
                <span className="mt-5 block h-0.5 w-10 rounded-full bg-emerald-600" />
                <p className="mt-3 text-xl font-semibold tracking-tight text-emerald-700 sm:text-2xl">
                    {t('hero.card.tagline')}
                </p>
                <p className="mt-2 max-w-md text-sm leading-6 text-zinc-600 sm:text-base sm:leading-7">
                    {t('hero.card.body')}
                </p>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-emerald-950 p-2 sm:gap-3 sm:p-3">
                {featureItems.map(
                    ({ key, index, Icon, accent, well, glow, texture }) => (
                        <article
                            key={key}
                            className={cn(
                                'group relative flex min-h-[11.5rem] flex-col overflow-hidden rounded-2xl bg-gradient-to-br p-4 ring-1 ring-white/10 transition duration-300 sm:min-h-[13rem] sm:p-5',
                                'hover:-translate-y-0.5 hover:ring-emerald-300/40 hover:shadow-lg hover:shadow-emerald-950/40',
                                accent,
                            )}
                        >
                            <div
                                className={cn(
                                    'pointer-events-none absolute inset-0 opacity-80',
                                    texture,
                                )}
                            />
                            <div
                                className={cn(
                                    'pointer-events-none absolute -right-8 -top-10 size-28 rounded-full blur-2xl transition duration-300 group-hover:scale-125',
                                    glow,
                                )}
                            />
                            <span className="pointer-events-none absolute right-3 top-3 font-mono text-[0.65rem] tracking-[0.2em] text-white/35 sm:text-xs">
                                {index}
                            </span>
                            <span className="pointer-events-none absolute left-2 top-2 size-1.5 rounded-full bg-white/35" />
                            <span className="pointer-events-none absolute bottom-2 right-2 size-1.5 rounded-full bg-white/35" />

                            <div
                                className={cn(
                                    'relative mb-3 flex size-11 items-center justify-center border text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] sm:size-12',
                                    '[clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)]',
                                    well,
                                )}
                            >
                                <Icon className="size-5 transition duration-300 group-hover:scale-110" />
                            </div>

                            <h3 className="relative text-[0.72rem] font-semibold uppercase tracking-wide text-white sm:text-sm">
                                {t(`hero.card.features.${key}.title`)}
                            </h3>
                            <p className="relative mt-1.5 text-[0.68rem] leading-5 text-emerald-50/85 sm:text-xs sm:leading-5">
                                {t(`hero.card.features.${key}.description`)}
                            </p>
                        </article>
                    ),
                )}
            </div>

            <div className="flex flex-col items-center gap-4 bg-emerald-900 px-4 py-4 sm:flex-row sm:justify-between sm:px-5">
                <ApplicationLogo className="size-14 bg-black sm:size-16" />
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[0.65rem] font-semibold uppercase tracking-wide text-white sm:justify-end sm:text-xs">
                    {footerItems.map(({ key, Icon }) => (
                        <span
                            key={key}
                            className="inline-flex items-center gap-1.5"
                        >
                            <Icon className="size-3.5" />
                            {t(`hero.card.footer.${key}`)}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}
