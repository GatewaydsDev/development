import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

const owners = [
    {
        key: 'larry',
        initials: 'LD',
        panel: 'bg-[radial-gradient(circle_at_28%_18%,rgba(63,207,142,0.42),transparent_36%),linear-gradient(165deg,#1c4a38_0%,#111827_58%,#0b1220_100%)]',
    },
    {
        key: 'ricardo',
        initials: 'RS',
        panel: 'bg-[radial-gradient(circle_at_72%_16%,rgba(186,230,210,0.28),transparent_34%),linear-gradient(165deg,#243044_0%,#111827_52%,#101820_100%)]',
    },
] as const;

export default function PublicOwners({ id = 'owners' }: { id?: string }) {
    const { t } = useTranslation('about');

    return (
        <section
            id={id}
            className="scroll-mt-24 overflow-hidden bg-[#f4f1ea] text-[#14211c] dark:bg-[#0d1613] dark:text-white"
            aria-labelledby={`${id}-title`}
        >
            <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
                <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#0f6b45] dark:text-[#3FCF8E]">
                            {t('owners.badge')}
                        </p>
                        <h2
                            id={`${id}-title`}
                            className="mt-4 max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl"
                        >
                            {t('owners.title')}
                        </h2>
                    </div>
                    <p className="max-w-xl text-base leading-8 text-[#14211c]/75 dark:text-white/75 lg:pb-1">
                        {t('owners.description')}
                    </p>
                </div>

                <div className="mt-12 grid gap-6 lg:mt-16 lg:grid-cols-2 lg:gap-8">
                    {owners.map((owner, index) => (
                        <article
                            key={owner.key}
                            className="overflow-hidden rounded-[1.75rem] bg-[#fbfaf7] shadow-[0_28px_70px_-42px_rgba(17,24,39,0.85)] dark:bg-[#16211c]"
                        >
                            <div
                                className={cn(
                                    'relative flex min-h-72 flex-col justify-between p-7 sm:min-h-80 sm:p-8',
                                    owner.panel,
                                )}
                            >
                                <div className="pointer-events-none absolute inset-5 rounded-[1.35rem] border border-white/20" />
                                <div className="relative flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70">
                                    <span>{t(`owners.people.${owner.key}.role`)}</span>
                                    <span>{String(index + 1).padStart(2, '0')}</span>
                                </div>
                                <p className="relative text-7xl font-semibold tracking-tight text-white sm:text-8xl">
                                    {owner.initials}
                                </p>
                                <p className="relative text-sm font-medium text-[#d7f6e8]">
                                    Gateway Door Systems
                                </p>
                            </div>

                            <div className="p-7 text-[#14211c] dark:text-white sm:p-8">
                                <h3 className="text-3xl font-semibold tracking-tight">
                                    {t(`owners.people.${owner.key}.name`)}
                                </h3>
                                <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#0f6b45] dark:text-[#3FCF8E]">
                                    {t(`owners.people.${owner.key}.role`)}
                                </p>
                                <p className="mt-5 text-base leading-7 text-[#14211c]/75 dark:text-white/75">
                                    {t(`owners.people.${owner.key}.text`)}
                                </p>
                            </div>
                        </article>
                    ))}
                </div>

                <p className="mt-10 max-w-3xl border-t border-[#14211c]/10 pt-6 text-sm leading-7 text-[#14211c]/70 dark:border-white/10 dark:text-white/70">
                    {t('owners.shared')}
                </p>
            </div>
        </section>
    );
}
