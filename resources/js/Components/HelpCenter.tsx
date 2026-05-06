import { openContactForm } from '@/lib/contact';
import { openHelpCenterEventName } from '@/lib/help';
import { Link } from '@inertiajs/react';
import {
    Building2Icon,
    ClipboardCheckIcon,
    DoorOpenIcon,
    HelpCircleIcon,
    LogInIcon,
    MessageCircleIcon,
    PhoneCallIcon,
    SearchIcon,
    ShieldCheckIcon,
    WrenchIcon,
    XIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const helpTopics = [
    {
        key: 'contact',
        Icon: MessageCircleIcon,
        action: 'contact',
    },
    {
        key: 'services',
        Icon: WrenchIcon,
        action: 'services',
    },
    {
        key: 'quote',
        Icon: MessageCircleIcon,
        action: 'contact',
    },
    {
        key: 'call',
        Icon: PhoneCallIcon,
        action: 'contact',
    },
    {
        key: 'secureOpenings',
        Icon: ShieldCheckIcon,
        action: 'services',
    },
    {
        key: 'process',
        Icon: ClipboardCheckIcon,
        action: 'about',
    },
    {
        key: 'markets',
        Icon: Building2Icon,
        action: 'about',
    },
    {
        key: 'about',
        Icon: DoorOpenIcon,
        action: 'about',
    },
    {
        key: 'portal',
        Icon: LogInIcon,
        action: 'portal',
    },
] as const;

type HelpTopic = (typeof helpTopics)[number];

type HelpCenterProps = {
    showTrigger?: boolean;
};

export default function HelpCenter({ showTrigger = true }: HelpCenterProps) {
    const { t } = useTranslation('common');
    const [isOpen, setIsOpen] = useState(false);
    const [question, setQuestion] = useState('');

    useEffect(() => {
        const openHelp = () => setIsOpen(true);

        window.addEventListener(openHelpCenterEventName, openHelp);

        return () => window.removeEventListener(openHelpCenterEventName, openHelp);
    }, []);

    const filteredTopics = useMemo(() => {
        const normalizedQuestion = question.trim().toLowerCase();

        if (!normalizedQuestion) {
            return helpTopics;
        }

        return helpTopics.filter((topic) => {
            const searchableContent = [
                t(`helpCenter.topics.${topic.key}.title`),
                t(`helpCenter.topics.${topic.key}.answer`),
                t(`helpCenter.topics.${topic.key}.keywords`),
            ]
                .join(' ')
                .toLowerCase();

            return searchableContent.includes(normalizedQuestion);
        });
    }, [question, t]);

    const selectTopic = (topic: HelpTopic) => {
        if (topic.action === 'contact') {
            setIsOpen(false);
            openContactForm();
        }
    };

    return (
        <>
            {showTrigger && (
                <button
                    type="button"
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 left-4 z-40 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-2xl shadow-emerald-950/20 transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-background"
                    aria-label={t('helpCenter.open')}
                >
                    <HelpCircleIcon className="size-5" />
                    {t('helpCenter.button')}
                </button>
            )}

            <div
                className={
                    'fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm transition duration-200 ' +
                    (isOpen
                        ? 'pointer-events-auto opacity-100'
                        : 'pointer-events-none opacity-0')
                }
                onClick={() => setIsOpen(false)}
                aria-hidden="true"
            />

            <aside
                className={
                    'fixed bottom-0 left-0 z-50 flex max-h-[88vh] w-full flex-col rounded-t-3xl border border-border bg-background shadow-2xl transition duration-300 sm:bottom-6 sm:left-6 sm:max-h-[78vh] sm:max-w-md sm:rounded-3xl ' +
                    (isOpen
                        ? 'translate-y-0 opacity-100'
                        : 'pointer-events-none translate-y-8 opacity-0')
                }
                aria-labelledby="help-center-title"
            >
                <div className="flex items-start justify-between gap-4 border-b border-border p-5">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                            {t('helpCenter.eyebrow')}
                        </p>
                        <h2
                            id="help-center-title"
                            className="mt-1 text-xl font-semibold text-foreground"
                        >
                            {t('helpCenter.title')}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {t('helpCenter.description')}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        aria-label={t('helpCenter.close')}
                    >
                        <XIcon className="size-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-medium text-foreground">
                            {t('helpCenter.questionLabel')}
                        </span>
                        <span className="relative">
                            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <input
                                value={question}
                                onChange={(event) =>
                                    setQuestion(event.target.value)
                                }
                                placeholder={t('helpCenter.questionPlaceholder')}
                                className="h-11 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                        </span>
                    </label>

                    <div className="mt-5 flex flex-col gap-3">
                        {filteredTopics.length > 0 ? (
                            filteredTopics.map((topic) => {
                                const Icon = topic.Icon;
                                const topicContent = (
                                    <>
                                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                                            <Icon className="size-5" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block font-semibold text-foreground">
                                                {t(
                                                    `helpCenter.topics.${topic.key}.title`,
                                                )}
                                            </span>
                                            <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                                                {t(
                                                    `helpCenter.topics.${topic.key}.answer`,
                                                )}
                                            </span>
                                        </span>
                                    </>
                                );

                                if (topic.action === 'services') {
                                    return (
                                        <Link
                                            key={topic.key}
                                            href="/#services"
                                            onClick={() => setIsOpen(false)}
                                            className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition hover:border-emerald-400/50 hover:bg-emerald-500/5"
                                        >
                                            {topicContent}
                                        </Link>
                                    );
                                }

                                if (topic.action === 'portal') {
                                    return (
                                        <Link
                                            key={topic.key}
                                            href={route('login')}
                                            onClick={() => setIsOpen(false)}
                                            className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition hover:border-emerald-400/50 hover:bg-emerald-500/5"
                                        >
                                            {topicContent}
                                        </Link>
                                    );
                                }

                                if (topic.action === 'about') {
                                    return (
                                        <Link
                                            key={topic.key}
                                            href={route('about')}
                                            onClick={() => setIsOpen(false)}
                                            className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition hover:border-emerald-400/50 hover:bg-emerald-500/5"
                                        >
                                            {topicContent}
                                        </Link>
                                    );
                                }

                                return (
                                    <button
                                        key={topic.key}
                                        type="button"
                                        onClick={() => selectTopic(topic)}
                                        className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition hover:border-emerald-400/50 hover:bg-emerald-500/5"
                                    >
                                        {topicContent}
                                    </button>
                                );
                            })
                        ) : (
                            <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                                {t('helpCenter.noResults')}
                            </div>
                        )}
                    </div>
                </div>

                <div className="border-t border-border p-5">
                    <button
                        type="button"
                        onClick={() => {
                            setIsOpen(false);
                            openContactForm();
                        }}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-background"
                    >
                        <MessageCircleIcon className="size-4" />
                        {t('helpCenter.contactButton')}
                    </button>
                </div>
            </aside>
        </>
    );
}
