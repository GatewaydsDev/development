import { cn } from '@/lib/utils';
import type { TakeoffGuide, TakeoffGuideStep } from './types';

const stateLabel: Record<TakeoffGuideStep['state'], string> = {
    done: 'Done',
    current: 'Do this now',
    later: 'Later',
};

export default function TakeoffSteps({
    guide,
    onOpen,
}: {
    guide: TakeoffGuide;
    onOpen?: (step: TakeoffGuideStep) => void;
}) {
    return (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/20">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">How to price this takeoff</h3>
                <p className="text-sm text-emerald-800 dark:text-emerald-200">{guide.next}</p>
            </div>
            <ol className="grid gap-2 lg:grid-cols-4">
                {guide.steps.map((step, index) => {
                    const body = (
                        <>
                            <span className="flex items-center justify-between gap-2">
                                <span className={cn(
                                    'flex size-5 items-center justify-center rounded-full text-[11px] font-semibold',
                                    step.state === 'current' ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
                                )}>
                                    {index + 1}
                                </span>
                                <span className="text-[11px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">{stateLabel[step.state]}</span>
                            </span>
                            <span className="mt-2 block text-sm font-medium text-foreground">{step.title}</span>
                            <span className="mt-1 block text-xs leading-5 text-muted-foreground">{step.detail}</span>
                        </>
                    );
                    const className = cn(
                        'h-full rounded-lg border p-3 text-left',
                        step.state === 'current' ? 'border-emerald-500 bg-white dark:bg-emerald-950/40' : 'border-emerald-200/80 bg-white/70 dark:border-emerald-900 dark:bg-transparent',
                    );

                    if (!onOpen) {
                        return <li key={step.key} className={className}>{body}</li>;
                    }

                    return (
                        <li key={step.key}>
                            <button type="button" className={cn(className, 'w-full')} onClick={() => onOpen(step)}>
                                {body}
                            </button>
                        </li>
                    );
                })}
            </ol>
        </section>
    );
}
