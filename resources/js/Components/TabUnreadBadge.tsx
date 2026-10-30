import { useUnreadChat } from '@/lib/unreadChat';
import { useUnreadMail } from '@/lib/unreadMail';
import { useEffect } from 'react';

const SOURCE = '/images/App-Logo.png';
const SIZE = 64;

let plainIcon: string | null = null;
let badgedIcon: string | null = null;
let showingBadge = false;

function iconLink(): HTMLLinkElement {
    const current = document.querySelector<HTMLLinkElement>('link[rel="icon"]');

    if (current) {
        plainIcon ??= current.href;

        return current;
    }

    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    document.head.appendChild(link);
    plainIcon ??= '/images/Gateway_Door_Systems_Logo.png';

    return link;
}

function replaceIcon(href: string): void {
    const current = iconLink();
    const next = current.cloneNode() as HTMLLinkElement;
    next.type = 'image/png';
    next.href = href;
    current.replaceWith(next);
}

function drawBadge(): Promise<string> {
    if (badgedIcon) {
        return Promise.resolve(badgedIcon);
    }

    return new Promise((resolve) => {
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = SIZE;
            canvas.height = SIZE;
            const context = canvas.getContext('2d');

            if (!context) {
                resolve(plainIcon ?? SOURCE);

                return;
            }

            context.clearRect(0, 0, SIZE, SIZE);
            context.drawImage(image, 0, 0, SIZE, SIZE);

            const radius = 11;
            const x = SIZE - radius - 2;
            const y = radius + 2;
            context.beginPath();
            context.arc(x, y, radius + 2.5, 0, Math.PI * 2);
            context.fillStyle = '#ffffff';
            context.fill();
            context.beginPath();
            context.arc(x, y, radius, 0, Math.PI * 2);
            context.fillStyle = '#dc2626';
            context.fill();

            badgedIcon = canvas.toDataURL('image/png');
            resolve(badgedIcon);
        };
        image.onerror = () => resolve(plainIcon ?? SOURCE);
        image.src = SOURCE;
    });
}

export default function TabUnreadBadge() {
    const unread = useUnreadMail() + useUnreadChat();

    useEffect(() => {
        let cancelled = false;
        iconLink();

        if (unread < 1) {
            if (showingBadge && plainIcon) {
                replaceIcon(plainIcon);
                showingBadge = false;
            }

            return;
        }

        void drawBadge().then((href) => {
            if (!cancelled) {
                replaceIcon(href);
                showingBadge = true;
            }
        });

        return () => {
            cancelled = true;
        };
    }, [unread]);

    return null;
}
