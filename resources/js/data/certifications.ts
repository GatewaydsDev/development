export const lockmastersWebsite = 'https://www.lockmasters.com/';
export const lockmastersInstituteWebsite = 'https://lsieducation.com/';
export const kabaMasWebsite = 'https://www.kabamas.com/';

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
        mark: null,
        plate: 'dark',
    },
    {
        key: 'kabaMasX10',
        logo: '/images/lockmasters-logo.webp',
        image: null,
        website: kabaMasWebsite,
        monogram: 'X-10',
        mark: 'X-10',
        plate: 'navy',
    },
    {
        key: 'lkm10k',
        logo: '/images/lockmasters-logo.webp',
        image: null,
        website: lockmastersInstituteWebsite,
        monogram: '10K',
        mark: '10K',
        plate: 'bronze',
    },
    {
        key: 'rf',
        logo: null,
        image: '/images/products/rf.svg',
        website: null,
        monogram: 'RF',
        mark: null,
        plate: 'emerald',
    },
    {
        key: 'scifRooms',
        logo: null,
        image: '/images/products/scif.svg',
        website: null,
        monogram: 'SCIF',
        mark: null,
        plate: 'slate',
    },
] as const;

export type Certification = (typeof certifications)[number];
export type CertificationKey = Certification['key'];
