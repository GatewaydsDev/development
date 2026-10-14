/**
 * Public service images.
 *
 * Only files that show the named product are listed. A null image renders a
 * labeled placeholder. Do not point two services at the same file.
 *
 * Permission notes (not for the public site):
 * - public/images/rf_door_0_2.webp and public/images/rf_door_1_2.webp are
 *   Gateway Door Systems graphics already in this repository. Both show copper
 *   conductive seals and are captioned as RF shielding. They are used only on
 *   the radio-frequency door page. They were not downloaded from Krieger.
 * - public/images/Stell_Security_Doors.png is a Gateway graphic already in this
 *   repository. The photograph is a commercial steel door and frame. It is used
 *   only for hollow metal. The panel text says "Steel security doors". It is
 *   not a fire-rating document.
 * - radio-frequency-hero.png, Gateway-Radio-Frequency.png, and
 *   Radio-Frequency_transparent.png are the same commercial vision-lite door
 *   as high-security-reinforced-door.jpeg. The filenames say RF. The photos do
 *   not show shielding construction, so they are not used as RF images.
 * - hero/commercial-storefront.jpg is an interior glass corridor, not a
 *   storefront entrance. hero/warehouse-overhead.jpg is a warehouse interior,
 *   not an overhead or rolling door. hero/industrial-steel.jpg is a welding
 *   photo. high-security-door-row.jpeg is a row of personnel doors, not dock
 *   equipment.
 * - The saved Krieger page under public/images/ is a local browser archive.
 *   Those manufacturer files are not republished. Krieger and Allegion product
 *   photography needs written reuse permission before it can be added here.
 *   No manufacturer image was downloaded for this mapping.
 *
 * Where a verified product photograph is not in the repository, the page uses an
 * original line drawing in public/images/products. Those drawings are not
 * photographs and they are not manufacturer images.
 *
 * Photos still needed, with permission to publish:
 * - Acoustic door assembly, identified by the manufacturer or project record.
 * - Acoustic window or glazing system.
 * - Bullet-resistant door or window, only with documentation that Gateway
 *   supplies that product.
 * - Blast-resistant assembly.
 * - Fire-rated door and frame, with the rating documented. Do not infer it
 *   from a steel door photo.
 * - Commercial storefront entrance: glazed doors and storefront framing.
 * - Sectional overhead door.
 * - Rolling steel door, separate from a security grille.
 * - Security grille.
 * - High-speed door.
 * - Dock leveler, seal, or shelter.
 * - Forced-entry door assembly.
 * - Oversized door assembly.
 * - Hurricane or tornado door assembly.
 * - SCIF opening. Do not illustrate it with a generic door.
 * - Pipe bollards, bathroom partitions, and security equipment, if those
 *   group items stay on the public site.
 */

export type ServiceVisual = {
    hero: string | null;
    detail: string | null;
    fit: 'cover' | 'contain';
    /**
     * left: show the left half of a composite so a marketing panel is not
     * presented as the product.
     */
    crop?: 'left';
    identity: string;
};

const drawing = (file: string, identity: string): ServiceVisual => ({
    hero: `/images/products/${file}`,
    detail: `/images/products/${file}`,
    fit: 'contain',
    identity,
});

export const serviceVisuals = {
    radioFrequencyDoors: {
        hero: '/images/products/rf.svg',
        detail: '/images/products/rf-detail.svg',
        fit: 'contain',
        identity:
            'Original drawing of an RF door with a conductive seal, plus a detail of the seal. Not a photograph.',
    },
    hollowMetal: drawing(
        'hollow-metal.svg',
        'Original drawing of a hollow metal door, narrow vision lite, and frame. Not a photograph.',
    ),
    soundTransmission: drawing(
        'acoustic.svg',
        'Original drawing of an acoustic door and an acoustic window. Not a photograph.',
    ),
    bullet: drawing(
        'bullet.svg',
        'Original drawing of a layered bullet-resistant door. Not a photograph.',
    ),
    blast: drawing(
        'blast.svg',
        'Original drawing of a reinforced blast-resistant door. Not a photograph.',
    ),
    oversizedAssemblies: drawing(
        'oversized.svg',
        'Original drawing of a pair of oversized doors. Not a photograph.',
    ),
    hurricaneAndTornado: drawing(
        'hurricane.svg',
        'Original drawing of a storm-rated door. Not a photograph.',
    ),
    forcedEntryDoors: drawing(
        'forced-entry.svg',
        'Original drawing of a locked forced-entry door. Not a photograph.',
    ),
    scifRoomsConstruction: drawing(
        'scif.svg',
        'Original drawing of a controlled-room opening. Not a photograph.',
    ),
    aluminumStorefront: drawing(
        'storefront.svg',
        'Original drawing of a storefront entrance. Not a photograph.',
    ),
    securityGrilles: drawing(
        'grille.svg',
        'Original drawing of a security grille. Not a photograph.',
    ),
    overheadSectional: drawing(
        'overhead.svg',
        'Original drawing of a sectional overhead door. Not a photograph.',
    ),
    highSpeedDoors: drawing(
        'high-speed.svg',
        'Original drawing of a high-speed door curtain. Not a photograph.',
    ),
    rollingSteel: drawing(
        'rolling-steel.svg',
        'Original drawing of a rolling steel door. Not a photograph.',
    ),
    dockEquipment: drawing(
        'dock.svg',
        'Original drawing of a dock leveler between a building and a truck. Not a photograph.',
    ),
    securityEquipment: drawing(
        'security-equipment.svg',
        'Original drawing of a door with an access reader and a lock. Not a photograph.',
    ),
    pipeBollards: drawing(
        'bollards.svg',
        'Original drawing of pipe bollards. Not a photograph.',
    ),
    bathroomPartitions: drawing(
        'partitions.svg',
        'Original drawing of restroom partitions. Not a photograph.',
    ),
    specialty: drawing(
        'specialty-set.svg',
        'Original drawing of three specialty doors. Not a photograph of one product.',
    ),
    commercial: drawing(
        'commercial-set.svg',
        'Original drawing of a hollow metal door beside a storefront. Not a photograph.',
    ),
    equipment: drawing(
        'equipment-set.svg',
        'Original drawing of a dock leveler and bollards. Not a photograph.',
    ),
} as const satisfies Record<string, ServiceVisual>;

export type ServiceVisualKey = keyof typeof serviceVisuals;
