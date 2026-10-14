import { serviceVisuals } from '@/data/serviceVisuals';
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
    hero: string | null;
    detail: string | null;
    support: string | null;
};

function serviceImages(key: CatalogItemKey): ServiceImages {
    const visual = serviceVisuals[key];

    return {
        hero: visual.hero,
        detail: visual.detail,
        support: null,
    };
}

export type CatalogItem = {
    key: CatalogItemKey;
    group: ServiceGroupKey;
    slug?: string;
    Icon: LucideIcon;
    images?: ServiceImages;
};

type ServiceDefinition = CatalogItem & {
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
        images: serviceImages('scifRoomsConstruction'),
    },
    {
        key: 'radioFrequencyDoors',
        group: 'specialty',
        slug: 'radio-frequency-doors',
        Icon: RadioTowerIcon,
        images: serviceImages('radioFrequencyDoors'),
    },
    {
        key: 'soundTransmission',
        group: 'specialty',
        slug: 'sound-transmission',
        Icon: Volume2Icon,
        images: serviceImages('soundTransmission'),
    },
    {
        key: 'bullet',
        group: 'specialty',
        slug: 'bullet-resistant-doors',
        Icon: ShieldIcon,
        images: serviceImages('bullet'),
    },
    {
        key: 'blast',
        group: 'specialty',
        slug: 'blast-resistant-doors',
        Icon: BombIcon,
        images: serviceImages('blast'),
    },
    {
        key: 'oversizedAssemblies',
        group: 'specialty',
        slug: 'oversized-door-assemblies',
        Icon: ExpandIcon,
        images: serviceImages('oversizedAssemblies'),
    },
    {
        key: 'hurricaneAndTornado',
        group: 'specialty',
        slug: 'hurricane-tornado-doors',
        Icon: CloudLightningIcon,
        images: serviceImages('hurricaneAndTornado'),
    },
    {
        key: 'forcedEntryDoors',
        group: 'specialty',
        slug: 'forced-entry-doors',
        Icon: LockKeyholeIcon,
        images: serviceImages('forcedEntryDoors'),
    },
    {
        key: 'hollowMetal',
        group: 'commercial',
        slug: 'hollow-metal-doors',
        Icon: DoorClosedIcon,
        images: serviceImages('hollowMetal'),
    },
    {
        key: 'aluminumStorefront',
        group: 'commercial',
        slug: 'aluminum-storefront',
        Icon: StoreIcon,
        images: serviceImages('aluminumStorefront'),
    },
    {
        key: 'securityGrilles',
        group: 'commercial',
        slug: 'security-grilles',
        Icon: Grid3x3Icon,
        images: serviceImages('securityGrilles'),
    },
    {
        key: 'overheadSectional',
        group: 'commercial',
        slug: 'overhead-sectional-doors',
        Icon: WarehouseIcon,
        images: serviceImages('overheadSectional'),
    },
    {
        key: 'highSpeedDoors',
        group: 'commercial',
        slug: 'high-speed-doors',
        Icon: GaugeIcon,
        images: serviceImages('highSpeedDoors'),
    },
    {
        key: 'rollingSteel',
        group: 'commercial',
        slug: 'rolling-steel-doors',
        Icon: LayersIcon,
        images: serviceImages('rollingSteel'),
    },
    {
        key: 'dockEquipment',
        group: 'equipment',
        slug: 'dock-equipment',
        Icon: ForkliftIcon,
        images: serviceImages('dockEquipment'),
    },
    {
        key: 'securityEquipment',
        group: 'equipment',
        slug: 'security-equipment',
        Icon: VideoIcon,
        images: serviceImages('securityEquipment'),
    },
    {
        key: 'pipeBollards',
        group: 'equipment',
        slug: 'pipe-bollards',
        Icon: CylinderIcon,
        images: serviceImages('pipeBollards'),
    },
    {
        key: 'bathroomPartitions',
        group: 'equipment',
        slug: 'bathroom-partitions',
        Icon: LayoutPanelLeftIcon,
        images: serviceImages('bathroomPartitions'),
    },
];

export const serviceDefinitions = catalogItems.filter(
    (item): item is ServiceDefinition =>
        typeof item.slug === 'string' && item.images !== undefined,
);

export const serviceDefinitionsByKey = serviceDefinitions.reduce(
    (services, service) => ({
        ...services,
        [service.key]: service,
    }),
    {} as Record<CatalogItemKey, ServiceDefinition>,
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

export function quoteInterestForService(key: string): 'doors' | 'windows' | 'both' {
    if (
        key === 'soundTransmission' ||
        key === 'aluminumStorefront' ||
        key === 'commercial'
    ) {
        return 'both';
    }

    return 'doors';
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
