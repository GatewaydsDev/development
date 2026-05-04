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
            className={`object-contain ${className}`}
            src="/images/App-Logo.png"
        />
    );
}
