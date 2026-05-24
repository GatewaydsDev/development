import { cn } from '@/lib/utils';
import {
    LockKeyholeIcon,
    RadioTowerIcon,
    ShieldCheckIcon,
    type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

type RadioFrequencyImageShowcaseProps = {
    src: string;
    alt: string;
    variant?: 'hero' | 'detail';
    embedded?: boolean;
    className?: string;
};

const tileConfig = [
    { key: 'shielding', Icon: RadioTowerIcon },
    { key: 'secureOpening', Icon: ShieldCheckIcon },
    { key: 'accessControl', Icon: LockKeyholeIcon },
] as const;

const highlightConfig = ['fullOpening', 'installFocus'] as const;

function GlassPanel({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'rounded-2xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur-md transition duration-[1200ms] ease-out group-hover/rf:border-emerald-400/25 group-hover/rf:bg-white/[0.1] group-hover/rf:shadow-[0_0_32px_-8px_rgba(52,211,153,0.45)] sm:p-3.5',
                className,
            )}
        >
            {children}
        </div>
    );
}

function ContextTile({
    title,
    description,
    className,
    compact,
}: {
    title: string;
    description: string;
    className?: string;
    compact?: boolean;
}) {
    return (
        <GlassPanel
            className={cn(
                'flex h-full flex-col justify-center gap-1.5 text-left',
                className,
            )}
        >
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-300/90 sm:text-xs">
                {title}
            </p>
            <p
                className={cn(
                    'leading-snug text-emerald-50/75',
                    compact
                        ? 'text-[10px] sm:text-[11px]'
                        : 'text-[11px] sm:text-xs',
                )}
            >
                {description}
            </p>
        </GlassPanel>
    );
}

function FeatureTile({
    Icon,
    title,
    description,
    className,
    compact,
}: {
    Icon: LucideIcon;
    title: string;
    description: string;
    className?: string;
    compact?: boolean;
}) {
    return (
        <GlassPanel
            className={cn(
                'flex h-full flex-col items-start gap-2 text-left',
                className,
            )}
        >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10 text-emerald-300 transition duration-[1200ms] ease-out group-hover/rf:scale-110 group-hover/rf:border-emerald-300/40 group-hover/rf:bg-emerald-400/20 sm:size-9">
                <Icon className="size-3.5 sm:size-4" aria-hidden />
            </div>

            <div className="space-y-1">
                <p className="text-xs font-semibold text-white sm:text-sm">
                    {title}
                </p>
                <p
                    className={cn(
                        'leading-snug text-emerald-50/70',
                        compact
                            ? 'text-[10px] sm:text-[11px]'
                            : 'text-[11px] sm:text-xs',
                    )}
                >
                    {description}
                </p>
            </div>
        </GlassPanel>
    );
}

function ShowcaseShell({
    children,
    className,
    compact,
    embedded,
}: {
    children: ReactNode;
    className?: string;
    compact?: boolean;
    embedded?: boolean;
}) {
    return (
        <div
            className={cn(
                'group/rf relative overflow-hidden',
                embedded
                    ? 'rounded-[1.75rem] sm:rounded-[2rem]'
                    : 'rounded-[1.75rem] border border-emerald-500/20 bg-zinc-950 shadow-2xl shadow-emerald-950/50 sm:rounded-[2rem]',
                compact ? 'p-3 sm:p-4' : 'p-4 sm:p-5',
                className,
            )}
        >
            {!embedded ? (
                <>
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,_rgba(52,211,153,0.32),_transparent_42%),radial-gradient(circle_at_82%_78%,_rgba(16,185,129,0.24),_transparent_48%),linear-gradient(155deg,_rgba(6,78,59,0.42),_rgba(2,6,23,0.95)_58%)]" />
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,_transparent_1px),linear-gradient(90deg,_rgba(255,255,255,0.035)_1px,_transparent_1px)] bg-[size:44px_44px] opacity-40" />
                </>
            ) : null}
            <div className="pointer-events-none absolute -left-10 top-1/4 size-44 rounded-full bg-emerald-400/20 blur-3xl opacity-70 transition-all duration-[1400ms] ease-out group-hover/rf:opacity-100 group-hover/rf:blur-[72px]" />
            <div className="pointer-events-none absolute -right-8 bottom-6 size-36 rounded-full bg-emerald-500/15 blur-3xl transition-all duration-[1400ms] ease-out group-hover/rf:bottom-4 group-hover/rf:size-48 group-hover/rf:bg-emerald-400/30" />
            {children}
        </div>
    );
}

export default function RadioFrequencyImageShowcase({
    src,
    alt,
    variant = 'hero',
    embedded = false,
    className,
}: RadioFrequencyImageShowcaseProps) {
    const { t } = useTranslation('services');
    const isHero = variant === 'hero';
    const showcasePath = 'services.radioFrequencyDoors.showcase';

    return (
        <ShowcaseShell
            className={className}
            compact={isHero}
            embedded={embedded}
        >
            <div className="relative grid grid-cols-3 gap-2 sm:gap-3">
                <div
                    className={cn(
                        'relative col-span-2 row-span-2 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.07] p-2 backdrop-blur-xl transition duration-[1200ms] ease-out group-hover/rf:-translate-y-1 group-hover/rf:border-emerald-300/30 group-hover/rf:bg-white/[0.11] group-hover/rf:shadow-[0_0_48px_-12px_rgba(52,211,153,0.55)] sm:rounded-[1.25rem] sm:p-3',
                        isHero
                            ? 'min-h-[14rem] sm:min-h-[18rem] lg:min-h-[20rem]'
                            : 'min-h-[16rem] sm:min-h-[22rem] lg:min-h-[28rem]',
                    )}
                >
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,_rgba(52,211,153,0.16),_transparent_62%)] opacity-80 transition-opacity duration-[1200ms] ease-out group-hover/rf:opacity-100" />
                    <img
                        src={src}
                        alt={alt}
                        className="relative h-full w-full object-contain object-center transition duration-[1200ms] ease-out group-hover/rf:scale-[1.04]"
                    />
                </div>

                {highlightConfig.map((key, index) => (
                    <ContextTile
                        key={key}
                        title={t(`${showcasePath}.highlights.${key}.title`)}
                        description={t(
                            `${showcasePath}.highlights.${key}.description`,
                        )}
                        compact={isHero}
                        className={cn(
                            'min-h-[5.5rem]',
                            index === 0 && 'col-start-3 row-start-1',
                            index === 1 && 'col-start-3 row-start-2',
                        )}
                    />
                ))}

                {tileConfig.map(({ key, Icon }, index) => (
                    <FeatureTile
                        key={key}
                        Icon={Icon}
                        title={t(`${showcasePath}.tiles.${key}.title`)}
                        description={t(
                            `${showcasePath}.tiles.${key}.description`,
                        )}
                        compact={isHero}
                        className={cn(
                            'min-h-[6.5rem]',
                            index === 0 && 'col-start-1 row-start-3',
                            index === 1 && 'col-start-2 row-start-3',
                            index === 2 && 'col-start-3 row-start-3',
                        )}
                    />
                ))}
            </div>
        </ShowcaseShell>
    );
}
