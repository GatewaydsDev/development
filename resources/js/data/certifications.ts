export const lockmastersWebsite = 'https://www.lockmasters.com/';

export const certificationImageSize = {
    width: 320,
    height: 240,
} as const;

export const certifications = [
    {
        key: 'lockmasters',
        logo: '/images/lockmasters-logo.webp',
        image: '/images/certification-lockmasters.webp',
        website: lockmastersWebsite,
        monogram: 'LKM',
        plate: 'dark',
    },
    {
        key: 'rf',
        logo: null,
        image: '/images/certification-rf.webp',
        website: null,
        monogram: 'RF',
        plate: 'emerald',
    },
    {
        key: 'scifRooms',
        logo: null,
        image: '/images/certification-scif.webp',
        website: null,
        monogram: 'SCIF',
        plate: 'slate',
    },
] as const;

export type Certification = (typeof certifications)[number];
export type CertificationKey = Certification['key'];
