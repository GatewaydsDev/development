import { InertiaLinkProps, Link } from '@inertiajs/react';

export default function ResponsiveNavLink({
    active = false,
    className = '',
    children,
    ...props
}: InertiaLinkProps & { active?: boolean }) {
    return (
        <Link
            {...props}
            className={`flex w-full items-start border-l-4 py-2 pe-4 ps-3 ${
                active
                    ? 'border-emerald-400 bg-emerald-400/10 text-emerald-600 focus:border-emerald-500 focus:bg-emerald-400/15 dark:text-emerald-300'
                    : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground focus:border-border focus:bg-muted focus:text-foreground'
            } text-base font-medium transition duration-150 ease-in-out focus:outline-none ${className}`}
        >
            {children}
        </Link>
    );
}
