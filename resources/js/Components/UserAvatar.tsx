import { cn } from '@/lib/utils';

function computeInitials(name?: string | null): string {
    const words = (name ?? '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (words.length === 0) {
        return '?';
    }

    const first = words[0].charAt(0);
    const second = words.length > 1 ? words[words.length - 1].charAt(0) : '';

    return (first + second).toUpperCase();
}

type UserAvatarProps = {
    name?: string | null;
    avatarUrl?: string | null;
    initials?: string;
    className?: string;
};

export default function UserAvatar({
    name,
    avatarUrl,
    initials,
    className,
}: UserAvatarProps) {
    const fallbackInitials = initials || computeInitials(name);

    return (
        <span
            className={cn(
                'inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-600 text-sm font-semibold uppercase text-white ring-1 ring-border',
                className,
            )}
            aria-hidden="true"
        >
            {avatarUrl ? (
                <img
                    src={avatarUrl}
                    alt={name ?? 'User avatar'}
                    className="size-full object-cover"
                />
            ) : (
                <span>{fallbackInitials}</span>
            )}
        </span>
    );
}
