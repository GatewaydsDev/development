import { Badge } from '@/Components/ui/badge';
import { cn } from '@/lib/utils';
import type { NamedOption } from './types';

export type CatalogChange = {
    id: number;
    name: string;
    kind: 'profession' | 'skill';
    action: 'added' | 'removed';
};

type CatalogSnapshot = {
    professions: NamedOption[];
    skills: NamedOption[];
};

export function catalogChanges(
    previous: CatalogSnapshot,
    next: CatalogSnapshot,
): CatalogChange[] {
    return [
        ...diffItems(previous.professions, next.professions, 'profession'),
        ...diffItems(previous.skills, next.skills, 'skill'),
    ];
}

function diffItems(
    previous: NamedOption[],
    next: NamedOption[],
    kind: CatalogChange['kind'],
): CatalogChange[] {
    const previousIds = new Set(previous.map((item) => item.id));
    const nextIds = new Set(next.map((item) => item.id));

    return [
        ...next
            .filter((item) => !previousIds.has(item.id))
            .map((item) => ({
                id: item.id,
                name: item.name,
                kind,
                action: 'added' as const,
            })),
        ...previous
            .filter((item) => !nextIds.has(item.id))
            .map((item) => ({
                id: item.id,
                name: item.name,
                kind,
                action: 'removed' as const,
            })),
    ];
}

export function CatalogChangeBadges({
    changes,
}: {
    changes: CatalogChange[];
}) {
    if (changes.length === 0) {
        return null;
    }

    return (
        <div className="mt-2 flex flex-wrap gap-1.5">
            {changes.map((change) => (
                <Badge
                    key={`${change.kind}-${change.action}-${change.id}`}
                    variant="outline"
                    className={cn(
                        change.action === 'added' &&
                            'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                        change.action === 'removed' &&
                            'border-rose-500/40 bg-rose-500/10 text-rose-700 line-through decoration-rose-700/70 dark:text-rose-300',
                    )}
                >
                    {change.action === 'added' ? 'Added' : 'Removed'}{' '}
                    {change.kind} {change.name}
                </Badge>
            ))}
        </div>
    );
}
