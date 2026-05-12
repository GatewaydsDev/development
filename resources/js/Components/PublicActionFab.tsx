import { openContactForm } from '@/lib/contact';
import { openHelpCenter } from '@/lib/help';
import { cn } from '@/lib/utils';
import {
    HelpCircleIcon,
    MessageCircleIcon,
    PhoneCallIcon,
    SparklesIcon,
    XIcon,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type PublicActionFabProps = {
    callPhoneNumber?: string | null;
};

export default function PublicActionFab({
    callPhoneNumber,
}: PublicActionFabProps) {
    const { t } = useTranslation('common');
    const [isOpen, setIsOpen] = useState(false);
    const normalizedPhoneNumber = callPhoneNumber?.replace(/\D/g, '') ?? '';
    const canCall = normalizedPhoneNumber !== '';

    return (
        <div
            className="fixed bottom-6 right-4 z-40 flex flex-col items-end gap-3"
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
            onFocus={() => setIsOpen(true)}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                    setIsOpen(false);
                }
            }}
        >
            <div
                className={cn(
                    'flex flex-col items-end gap-2 transition-all duration-300 ease-out',
                    isOpen
                        ? 'translate-y-0 opacity-100'
                        : 'pointer-events-none translate-y-4 opacity-0',
                )}
            >
                {canCall && (
                    <a
                        href={`tel:${normalizedPhoneNumber}`}
                        className={cn(
                            'group inline-flex items-center gap-3 rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-emerald-950/20 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-background',
                            isOpen
                                ? 'scale-100 opacity-100 delay-150'
                                : 'translate-x-3 scale-95 opacity-0 delay-0',
                        )}
                    >
                        <span className="flex size-9 items-center justify-center rounded-full bg-white/15">
                            <PhoneCallIcon className="size-4 transition group-hover:animate-bell-shake" />
                        </span>
                        {t('publicActions.callNow')}
                    </a>
                )}

                <button
                    type="button"
                    onClick={() => {
                        setIsOpen(false);
                        openContactForm();
                    }}
                    className={cn(
                        'group inline-flex items-center gap-3 rounded-full bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-sky-950/20 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-background',
                        isOpen
                            ? 'scale-100 opacity-100 delay-75'
                            : 'translate-x-3 scale-95 opacity-0 delay-75',
                    )}
                >
                    <span className="flex size-9 items-center justify-center rounded-full bg-white/15">
                        <MessageCircleIcon className="size-4 transition group-hover:animate-bell-shake" />
                    </span>
                    {t('publicActions.contactUs')}
                </button>

                <button
                    type="button"
                    onClick={() => {
                        setIsOpen(false);
                        openHelpCenter();
                    }}
                    className={cn(
                        'group inline-flex items-center gap-3 rounded-full bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-violet-950/20 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 focus:ring-offset-background',
                        isOpen
                            ? 'scale-100 opacity-100'
                            : 'translate-x-3 scale-95 opacity-0 delay-150',
                    )}
                >
                    <span className="flex size-9 items-center justify-center rounded-full bg-white/15">
                        <HelpCircleIcon className="size-4 transition group-hover:animate-bell-shake" />
                    </span>
                    {t('publicActions.help')}
                </button>
            </div>

            <button
                type="button"
                onClick={() => setIsOpen((current) => !current)}
                className="flex size-16 items-center justify-center rounded-full border border-emerald-300/30 bg-gradient-to-br from-emerald-500 to-sky-600 text-white shadow-2xl shadow-emerald-950/25 transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-background"
                aria-expanded={isOpen}
                aria-label={t('publicActions.toggle')}
            >
                {isOpen ? (
                    <XIcon className="size-6" />
                ) : (
                    <SparklesIcon className="size-6" />
                )}
            </button>

            <span className="mr-1 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground shadow-sm ring-1 ring-border backdrop-blur">
                {t('publicActions.caption')}
            </span>
        </div>
    );
}
