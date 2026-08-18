import ApplicationLogo from '@/Components/ApplicationLogo';
import { cn } from '@/lib/utils';
import {
    BadgeCheckIcon,
    CheckCircle2Icon,
    KeyRoundIcon,
    LockKeyholeIcon,
    SettingsIcon,
    type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const featureItems: Array<{
    key: 'reinforced' | 'accessControl' | 'installation';
    index: string;
    Icon: LucideIcon;
    accent: string;
    well: string;
    glow: string;
    texture: string;
}> = [
    {
        key: 'reinforced',
        index: '01',
        Icon: LockKeyholeIcon,
        accent: 'from-slate-950 via-emerald-950 to-slate-900',
        well: 'border-emerald-300/50 bg-emerald-400/10 text-emerald-200',
        glow: 'bg-emerald-400/20',
        texture:
            'bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.05)_0_1px,transparent_1px_16px),radial-gradient(circle_at_90%_0%,rgba(16,185,129,0.22),transparent_42%)]',
    },
    {
        key: 'accessControl',
        index: '02',
        Icon: KeyRoundIcon,
        accent: 'from-emerald-950 via-teal-950 to-zinc-950',
        well: 'border-teal-200/50 bg-teal-400/10 text-teal-100',
        glow: 'bg-teal-300/20',
        texture:
            'bg-[linear-gradient(rgba(45,212,191,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(45,212,191,0.1)_1px,transparent_1px)] bg-[size:16px_16px]',
    },
    {
        key: 'installation',
        index: '03',
        Icon: BadgeCheckIcon,
        accent: 'from-emerald-950 via-slate-900 to-emerald-950',
        well: 'border-lime-200/40 bg-lime-400/10 text-lime-100',
        glow: 'bg-lime-300/20',
        texture:
            'bg-[radial-gradient(circle_at_10%_0%,rgba(163,230,53,0.18),transparent_40%),radial-gradient(circle_at_90%_110%,rgba(16,185,129,0.22),transparent_44%)]',
    },
];

const footerItems: Array<{
    key: 'builtToLast' | 'quality' | 'madeInUsa';
    Icon: LucideIcon;
}> = [
    { key: 'builtToLast', Icon: CheckCircle2Icon },
    { key: 'quality', Icon: BadgeCheckIcon },
    { key: 'madeInUsa', Icon: SettingsIcon },
];

function RestrictedVisual({ label }: { label: string }) {
    return (
        <div className="relative h-full min-h-[11.5rem] overflow-hidden bg-zinc-800 sm:min-h-full">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,#3f3f46_0_18px,#52525b_18px_20px)] opacity-70" />
            <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0_54px,#27272a_54px_56px)] opacity-50" />
            <div className="absolute inset-y-6 right-[12%] left-[38%] rounded-sm bg-gradient-to-b from-zinc-700 via-zinc-900 to-zinc-950 shadow-2xl ring-1 ring-zinc-500/60">
                <div className="absolute inset-x-3 top-3 bottom-3 border border-white/10" />
                <div className="absolute left-2 top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-zinc-400 shadow-[inset_-1px_-1px_2px_rgba(0,0,0,0.5)]" />
            </div>
            <div className="absolute bottom-[22%] left-[18%] grid w-12 grid-cols-3 gap-0.5 rounded-md bg-zinc-950/90 p-1 ring-1 ring-zinc-500/70">
                {Array.from({ length: 9 }, (_, index) => (
                    <span
                        key={index}
                        className="aspect-square rounded-[2px] bg-zinc-700"
                    />
                ))}
            </div>
            <div className="absolute left-[16%] top-[18%] rounded-sm bg-zinc-950 px-2 py-1 text-[0.55rem] font-semibold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-400/50 sm:text-[0.65rem]">
                {label}
            </div>
        </div>
    );
}

export default function SecureDoorCard() {
    const { t } = useTranslation('home');

    return (
        <div className="overflow-hidden bg-white text-zinc-950">
            <div className="grid md:grid-cols-[0.95fr_1.05fr]">
                <div className="relative z-10 flex flex-col justify-center bg-white px-5 py-6 sm:px-6 sm:py-7">
                    <ApplicationLogo className="size-16 sm:size-20" />
                    <h3 className="mt-4 text-lg font-semibold uppercase tracking-tight text-zinc-950 sm:text-xl">
                        {t('secureDoor.card.title')}
                    </h3>
                    <p className="mt-2 text-sm font-semibold text-emerald-700 sm:text-base">
                        {t('secureDoor.card.tagline')}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">
                        {t('secureDoor.card.body')}
                    </p>
                </div>

                <div className="relative">
                    <div className="absolute inset-0 hidden bg-emerald-700 [clip-path:polygon(12%_0,18%_0,2%_100%,0_100%)] md:block" />
                    <div className="h-full md:[clip-path:polygon(16%_0,100%_0,100%_100%,0_100%)]">
                        <RestrictedVisual
                            label={t('secureDoor.card.restricted')}
                        />
                    </div>
                </div>
            </div>

            <div className="grid gap-2 bg-emerald-950 p-2 sm:grid-cols-3 sm:gap-2.5 sm:p-2.5">
                {featureItems.map(
                    ({ key, index, Icon, accent, well, glow, texture }) => (
                        <article
                            key={key}
                            className={cn(
                                'group relative flex min-h-[12rem] flex-col overflow-hidden rounded-2xl bg-gradient-to-br p-4 ring-1 ring-white/10 transition duration-300',
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
                                    'pointer-events-none absolute -right-8 -top-10 size-24 rounded-full blur-2xl transition duration-300 group-hover:scale-125',
                                    glow,
                                )}
                            />
                            <span className="pointer-events-none absolute right-3 top-3 font-mono text-[0.65rem] tracking-[0.2em] text-white/35">
                                {index}
                            </span>
                            <span className="pointer-events-none absolute left-2 top-2 size-1.5 rounded-full bg-white/35" />
                            <span className="pointer-events-none absolute bottom-2 right-2 size-1.5 rounded-full bg-white/35" />

                            <div
                                className={cn(
                                    'relative mb-3 flex size-11 items-center justify-center border text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]',
                                    '[clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)]',
                                    well,
                                )}
                            >
                                <Icon className="size-5 transition duration-300 group-hover:scale-110" />
                            </div>

                            <h4 className="relative text-[0.72rem] font-semibold uppercase tracking-wide text-white sm:text-xs">
                                {t(`secureDoor.card.features.${key}.title`)}
                            </h4>
                            <p className="relative mt-1.5 text-[0.68rem] leading-5 text-emerald-50/85 sm:text-[0.7rem] sm:leading-5">
                                {t(
                                    `secureDoor.card.features.${key}.description`,
                                )}
                            </p>
                        </article>
                    ),
                )}
            </div>

            <div className="flex flex-col items-center gap-4 bg-emerald-900 px-4 py-4 sm:flex-row sm:justify-between sm:px-5">
                <ApplicationLogo className="size-12 bg-black sm:size-14" />
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[0.65rem] font-semibold uppercase tracking-wide text-white sm:justify-end sm:text-xs">
                    {footerItems.map(({ key, Icon }) => (
                        <span
                            key={key}
                            className="inline-flex items-center gap-1.5"
                        >
                            <Icon className="size-3.5" />
                            {t(`secureDoor.card.footer.${key}`)}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}
