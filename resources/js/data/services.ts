import {
    BombIcon,
    Building2Icon,
    CloudLightningIcon,
    ExpandIcon,
    LockKeyholeIcon,
    RadioTowerIcon,
    ShieldIcon,
    Volume2Icon,
    type LucideIcon,
} from 'lucide-react';

export type ServiceKey =
    | 'scifRoomsConstruction'
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
        key: 'scifRoomsConstruction',
        slug: 'scif-rooms-construction',
        Icon: Building2Icon,
        images: {
            hero: '/images/certification-scif.webp',
            detail: '/images/high-security-reinforced-door.jpeg',
            support: '/images/high-security-door-row.jpeg',
        },
    },
    {
        key: 'radioFrequencyDoors',
        slug: 'radio-frequency-doors',
        Icon: RadioTowerIcon,
        images: {
            hero: '/images/radio-frequency-hero.png',
            detail: '/images/Gateway-Radio-Frequency.png',
            support: '/images/Radio_Frequency_Doors.png',
        },
    },
    {
        key: 'soundTransmission',
        slug: 'sound-transmission',
        Icon: Volume2Icon,
        images: {
            hero: '/images/rf_door_0_1.webp',
            detail: '/images/rf_door_0_2.webp',
            support: '/images/rf_door_0_3.webp',
        },
    },
    {
        key: 'bullet',
        slug: 'bullet-resistant-doors',
        Icon: ShieldIcon,
        images: {
            hero: '/images/rf_door_0_2.webp',
            detail: '/images/rf_door_0_3.webp',
            support: '/images/rf_door_1_0.webp',
        },
    },
    {
        key: 'blast',
        slug: 'blast-resistant-doors',
        Icon: BombIcon,
        images: {
            hero: '/images/rf_door_0_3.webp',
            detail: '/images/rf_door_1_0.webp',
            support: '/images/rf_door_1_1.webp',
        },
    },
    {
        key: 'oversizedAssemblies',
        slug: 'oversized-door-assemblies',
        Icon: ExpandIcon,
        images: {
            hero: '/images/rf_door_1_0.webp',
            detail: '/images/rf_door_1_1.webp',
            support: '/images/rf_door_1_2.webp',
        },
    },
    {
        key: 'hurricaneAndTornado',
        slug: 'hurricane-tornado-doors',
        Icon: CloudLightningIcon,
        images: {
            hero: '/images/rf_door_1_1.webp',
            detail: '/images/rf_door_1_2.webp',
            support: '/images/rf_door_1_3.webp',
        },
    },
    {
        key: 'forcedEntryDoors',
        slug: 'forced-entry-doors',
        Icon: LockKeyholeIcon,
        images: {
            hero: '/images/rf_door_1_2.webp',
            detail: '/images/rf_door_1_3.webp',
            support: '/images/rf_door_0_0.webp',
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

