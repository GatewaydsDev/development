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
            className={`shrink-0 object-contain ${className}`}
            src="/images/Gateway_Door_Systems_Logo.png"
        />
    );
}
