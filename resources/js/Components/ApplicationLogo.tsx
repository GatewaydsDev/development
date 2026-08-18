import { ImgHTMLAttributes } from 'react';

export default function ApplicationLogo({
    alt = 'Gateway Door Systems',
    className = '',
    ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
    return (
        <img
            {...props}
            alt={alt}
            className={`shrink-0 rounded-full object-contain p-2 ${className}`}
            src="/images/App-Logo.webp"
        />
    );
}
