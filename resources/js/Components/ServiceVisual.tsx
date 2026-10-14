import { cn } from '@/lib/utils';

type ServiceVisualProps = {
    src: string | null;
    alt: string;
    label: string;
    fit?: 'cover' | 'contain';
    crop?: 'left';
    loading?: 'eager' | 'lazy';
    className?: string;
};

export default function ServiceVisual({
    src,
    alt,
    label,
    fit = 'contain',
    crop,
    loading = 'lazy',
    className,
}: ServiceVisualProps) {
    if (!src) {
        return (
            <div
                role="img"
                aria-label={label}
                className={cn(
                    'flex items-center justify-center border border-[#111827]/10 bg-[#F3F4F6] px-6 text-center text-[#111827]',
                    className,
                )}
            >
                <p className="max-w-xs text-base font-semibold leading-6">
                    {label}
                </p>
            </div>
        );
    }

    if (crop === 'left') {
        return (
            <div className={cn('overflow-hidden bg-[#F3F4F6]', className)}>
                <img
                    src={src}
                    alt={alt}
                    loading={loading}
                    decoding="async"
                    className="h-full w-[230%] max-w-none object-cover object-left"
                />
            </div>
        );
    }

    return (
        <img
            src={src}
            alt={alt}
            loading={loading}
            decoding="async"
            className={cn(
                'w-full',
                fit === 'contain' ? 'bg-[#F3F4F6] object-contain' : 'object-cover',
                className,
            )}
        />
    );
}
