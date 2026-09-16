import {
    BombIcon,
    Building2Icon,
    CloudLightningIcon,
    CylinderIcon,
    DoorClosedIcon,
    ExpandIcon,
    ForkliftIcon,
    GaugeIcon,
    Grid3x3Icon,
    LayersIcon,
    LayoutPanelLeftIcon,
    LockKeyholeIcon,
    RadioTowerIcon,
    ShieldIcon,
    StoreIcon,
    VideoIcon,
    Volume2Icon,
    WarehouseIcon,
    type LucideIcon,
} from 'lucide-react';

export type ServiceGroupKey = 'specialty' | 'commercial' | 'equipment';

export type ServiceKey =
    | 'scifRoomsConstruction'
    | 'radioFrequencyDoors'
    | 'soundTransmission'
    | 'bullet'
    | 'blast'
    | 'oversizedAssemblies'
    | 'hurricaneAndTornado'
    | 'forcedEntryDoors';

export type CatalogItemKey =
    | ServiceKey
    | 'hollowMetal'
    | 'aluminumStorefront'
    | 'securityGrilles'
    | 'overheadSectional'
    | 'highSpeedDoors'
    | 'rollingSteel'
    | 'dockEquipment'
    | 'securityEquipment'
    | 'pipeBollards'
    | 'bathroomPartitions';

export type ServiceGroupDefinition = {
    key: ServiceGroupKey;
    slug: string | null;
};

type ServiceImages = {
    hero: string;
    detail: string;
    support: string;
};

export type CatalogItem = {
    key: CatalogItemKey;
    group: ServiceGroupKey;
    slug?: string;
    Icon: LucideIcon;
    images?: ServiceImages;
};

type ServiceDefinition = CatalogItem & {
    key: ServiceKey;
    slug: string;
    images: ServiceImages;
};

export const serviceGroups: ServiceGroupDefinition[] = [
    { key: 'specialty', slug: null },
    { key: 'commercial', slug: 'commercial-doors' },
    { key: 'equipment', slug: 'facility-equipment' },
];

export const catalogItems: CatalogItem[] = [
    {
        key: 'scifRoomsConstruction',
        group: 'specialty',
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
        group: 'specialty',
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
        group: 'specialty',
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
        group: 'specialty',
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
        group: 'specialty',
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
        group: 'specialty',
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
        group: 'specialty',
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
        group: 'specialty',
        slug: 'forced-entry-doors',
        Icon: LockKeyholeIcon,
        images: {
            hero: '/images/rf_door_1_2.webp',
            detail: '/images/rf_door_1_3.webp',
            support: '/images/rf_door_0_0.webp',
        },
    },
    {
        key: 'hollowMetal',
        group: 'commercial',
        Icon: DoorClosedIcon,
    },
    {
        key: 'aluminumStorefront',
        group: 'commercial',
        Icon: StoreIcon,
    },
    {
        key: 'securityGrilles',
        group: 'commercial',
        Icon: Grid3x3Icon,
    },
    {
        key: 'overheadSectional',
        group: 'commercial',
        Icon: WarehouseIcon,
    },
    {
        key: 'highSpeedDoors',
        group: 'commercial',
        Icon: GaugeIcon,
    },
    {
        key: 'rollingSteel',
        group: 'commercial',
        Icon: LayersIcon,
    },
    {
        key: 'dockEquipment',
        group: 'equipment',
        Icon: ForkliftIcon,
    },
    {
        key: 'securityEquipment',
        group: 'equipment',
        Icon: VideoIcon,
    },
    {
        key: 'pipeBollards',
        group: 'equipment',
        Icon: CylinderIcon,
    },
    {
        key: 'bathroomPartitions',
        group: 'equipment',
        Icon: LayoutPanelLeftIcon,
    },
];

export const serviceDefinitions = catalogItems.filter(
    (item): item is ServiceDefinition =>
        item.group === 'specialty' &&
        typeof item.slug === 'string' &&
        item.images !== undefined,
);

export const serviceDefinitionsByKey = serviceDefinitions.reduce(
    (services, service) => ({
        ...services,
        [service.key]: service,
    }),
    {} as Record<ServiceKey, ServiceDefinition>,
);

export const serviceGroupByKey = serviceGroups.reduce(
    (groups, group) => ({
        ...groups,
        [group.key]: group,
    }),
    {} as Record<ServiceGroupKey, ServiceGroupDefinition>,
);

export function catalogItemsForGroup(group: ServiceGroupKey): CatalogItem[] {
    return catalogItems.filter((item) => item.group === group);
}

export function catalogItemHref(item: CatalogItem): string {
    if (item.slug) {
        return `/services/${item.slug}`;
    }

    const group = serviceGroupByKey[item.group];

    if (!group.slug) {
        return '/#services';
    }

    return `/services/${group.slug}#${item.key}`;
}
