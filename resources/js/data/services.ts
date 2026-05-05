import {
    BombIcon,
    CloudLightningIcon,
    ExpandIcon,
    LockKeyholeIcon,
    RadioTowerIcon,
    ShieldIcon,
    Volume2Icon,
    type LucideIcon,
} from 'lucide-react';

export type ServiceKey =
    | 'radioFrequencyDoors'
    | 'soundTransmission'
    | 'bullet'
    | 'blast'
    | 'oversizedAssemblies'
    | 'hurricaneAndTornado'
    | 'forcedEntryDoors';

type ServiceDefinition = {
    key: ServiceKey;
    slug: string;
    Icon: LucideIcon;
    images: {
        hero: string;
        detail: string;
        support: string;
    };
};

export const serviceDefinitions: ServiceDefinition[] = [
    {
        key: 'radioFrequencyDoors',
        slug: 'radio-frequency-doors',
        Icon: RadioTowerIcon,
        images: {
            hero: '/images/gateway-hero-section.png',
            detail: '/images/high-security-reinforced-door.jpeg',
            support: '/images/high-security-access-card-door.jpeg',
        },
    },
    {
        key: 'soundTransmission',
        slug: 'sound-transmission',
        Icon: Volume2Icon,
        images: {
            hero: '/images/high-security-door-row.jpeg',
            detail: '/images/gateway-hero-section.png',
            support: '/images/high-security-reinforced-door.jpeg',
        },
    },
    {
        key: 'bullet',
        slug: 'bullet-resistant-doors',
        Icon: ShieldIcon,
        images: {
            hero: '/images/high-security-reinforced-door.jpeg',
            detail: '/images/high-security-door-row.jpeg',
            support: '/images/gateway-hero-section.png',
        },
    },
    {
        key: 'blast',
        slug: 'blast-resistant-doors',
        Icon: BombIcon,
        images: {
            hero: '/images/high-security-reinforced-door.jpeg',
            detail: '/images/gateway-hero-section.png',
            support: '/images/high-security-door-row.jpeg',
        },
    },
    {
        key: 'oversizedAssemblies',
        slug: 'oversized-door-assemblies',
        Icon: ExpandIcon,
        images: {
            hero: '/images/high-security-door-row.jpeg',
            detail: '/images/high-security-reinforced-door.jpeg',
            support: '/images/high-security-access-card-door.jpeg',
        },
    },
    {
        key: 'hurricaneAndTornado',
        slug: 'hurricane-tornado-doors',
        Icon: CloudLightningIcon,
        images: {
            hero: '/images/gateway-hero-section.png',
            detail: '/images/high-security-door-row.jpeg',
            support: '/images/high-security-reinforced-door.jpeg',
        },
    },
    {
        key: 'forcedEntryDoors',
        slug: 'forced-entry-doors',
        Icon: LockKeyholeIcon,
        images: {
            hero: '/images/high-security-access-card-door.jpeg',
            detail: '/images/high-security-reinforced-door.jpeg',
            support: '/images/gateway-hero-section.png',
        },
    },
];

export const serviceDefinitionsByKey = serviceDefinitions.reduce(
    (services, service) => ({
        ...services,
        [service.key]: service,
    }),
    {} as Record<ServiceKey, ServiceDefinition>,
);

