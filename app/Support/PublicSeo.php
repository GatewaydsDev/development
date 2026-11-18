<?php

namespace App\Support;

use App\Models\Company;
use Illuminate\Http\Request;

class PublicSeo
{
    /** @var array<string, array<string, mixed>> */
    private array $files = [];

    /** @var array<string, string> */
    private const SERVICE_IMAGES = [
        'scifRoomsConstruction' => '/images/products/scif.svg',
        'radioFrequencyDoors' => '/images/products/rf.svg',
        'soundTransmission' => '/images/products/acoustic.svg',
        'bullet' => '/images/products/bullet.svg',
        'blast' => '/images/products/blast.svg',
        'oversizedAssemblies' => '/images/products/oversized.svg',
        'hurricaneAndTornado' => '/images/products/hurricane.svg',
        'forcedEntryDoors' => '/images/products/forced-entry.svg',
        'hollowMetal' => '/images/products/hollow-metal.svg',
        'aluminumStorefront' => '/images/products/storefront.svg',
        'securityGrilles' => '/images/products/grille.svg',
        'overheadSectional' => '/images/products/overhead.svg',
        'highSpeedDoors' => '/images/products/high-speed.svg',
        'rollingSteel' => '/images/products/rolling-steel.svg',
        'dockEquipment' => '/images/products/dock.svg',
        'securityEquipment' => '/images/products/security-equipment.svg',
        'pipeBollards' => '/images/products/bollards.svg',
        'bathroomPartitions' => '/images/products/partitions.svg',
        'commercial' => '/images/products/commercial-set.svg',
        'equipment' => '/images/products/equipment-set.svg',
    ];

    public function __construct(private Request $request) {}

    /**
     * @return array{
     *     titles: array{en: string, es: string},
     *     descriptions: array{en: string, es: string},
     *     canonical: string,
     *     image: string,
     *     jsonLd: string
     * }|null
     */
    public static function forRequest(Request $request): ?array
    {
        if ($request->attributes->has('public_seo.resolved')) {
            return $request->attributes->get('public_seo');
        }

        $seo = (new self($request))->build();
        $request->attributes->set('public_seo.resolved', true);
        $request->attributes->set('public_seo', $seo);

        return $seo;
    }

    /**
     * @return array{
     *     titles: array{en: string, es: string},
     *     descriptions: array{en: string, es: string},
     *     canonical: string,
     *     image: string,
     *     jsonLd: string
     * }|null
     */
    private function build(): ?array
    {
        return match ($this->request->route()?->getName()) {
            'home' => $this->fromMeta('home', '/images/products/hero.svg', $this->homeGraph()),
            'about' => $this->fromMeta('about', '/images/products/door-row.svg', $this->aboutGraph()),
            'certifications' => $this->fromMeta('certifications', '/images/products/kaba-mas-x10.svg', $this->certificationsGraph()),
            'services.show' => $this->servicePage(),
            default => null,
        };
    }

    /**
     * @param  array<int, array<string, mixed>>  $graph
     * @return array{
     *     titles: array{en: string, es: string},
     *     descriptions: array{en: string, es: string},
     *     canonical: string,
     *     image: string,
     *     jsonLd: string
     * }
     */
    private function fromMeta(string $file, string $imagePath, array $graph): array
    {
        $en = $this->file($file, 'en')['meta'] ?? [];
        $es = $this->file($file, 'es')['meta'] ?? [];

        return $this->payload(
            (string) ($en['title'] ?? ''),
            (string) ($es['title'] ?? ''),
            (string) ($en['description'] ?? ''),
            (string) ($es['description'] ?? ''),
            $imagePath,
            $graph,
        );
    }

    /**
     * @return array{
     *     titles: array{en: string, es: string},
     *     descriptions: array{en: string, es: string},
     *     canonical: string,
     *     image: string,
     *     jsonLd: string
     * }|null
     */
    private function servicePage(): ?array
    {
        $slug = (string) $this->request->route('service');
        $groups = config('public_service_groups');
        $services = config('public_services');

        if (is_array($groups) && isset($groups[$slug])) {
            return $this->servicePayload('groups', (string) $groups[$slug], $slug);
        }

        if (is_array($services) && isset($services[$slug])) {
            return $this->servicePayload('services', (string) $services[$slug], $slug);
        }

        return null;
    }

    /**
     * @return array{
     *     titles: array{en: string, es: string},
     *     descriptions: array{en: string, es: string},
     *     canonical: string,
     *     image: string,
     *     jsonLd: string
     * }|null
     */
    private function servicePayload(string $group, string $key, string $slug): ?array
    {
        $en = $this->file('services', 'en')[$group][$key] ?? null;
        $es = $this->file('services', 'es')[$group][$key] ?? null;

        if (! is_array($en)) {
            return null;
        }

        $imagePath = self::SERVICE_IMAGES[$key] ?? '/images/products/hero.svg';
        $title = (string) ($en['title'] ?? '');
        $description = (string) ($en['metaDescription'] ?? '');

        return $this->payload(
            (string) ($en['metaTitle'] ?? $title),
            (string) (is_array($es) ? ($es['metaTitle'] ?? $en['metaTitle'] ?? $title) : $title),
            $description,
            (string) (is_array($es) ? ($es['metaDescription'] ?? $description) : $description),
            $imagePath,
            $this->serviceGraph($title, $description, $imagePath, $slug, $group === 'groups'),
        );
    }

    /**
     * @param  array<int, array<string, mixed>>  $graph
     * @return array{
     *     titles: array{en: string, es: string},
     *     descriptions: array{en: string, es: string},
     *     canonical: string,
     *     image: string,
     *     jsonLd: string
     * }
     */
    private function payload(
        string $titleEn,
        string $titleEs,
        string $descriptionEn,
        string $descriptionEs,
        string $imagePath,
        array $graph,
    ): array {
        return [
            'titles' => [
                'en' => $this->short($titleEn),
                'es' => $this->short($titleEs !== '' ? $titleEs : $titleEn),
            ],
            'descriptions' => [
                'en' => $descriptionEn,
                'es' => $descriptionEs !== '' ? $descriptionEs : $descriptionEn,
            ],
            'canonical' => url()->current(),
            'image' => url($imagePath),
            'jsonLd' => $this->document($graph),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function homeGraph(): array
    {
        $home = $this->file('home', 'en');
        $services = $this->file('services', 'en')['services'] ?? [];
        $offers = [];

        foreach (config('public_services') as $slug => $key) {
            $item = is_array($services) ? ($services[$key] ?? null) : null;

            if (! is_array($item)) {
                continue;
            }

            $offers[] = [
                '@type' => 'Offer',
                'itemOffered' => [
                    '@type' => 'Service',
                    'name' => $item['title'] ?? $key,
                    'description' => $item['metaDescription'] ?? '',
                    'url' => url('/services/'.$slug),
                ],
            ];
        }

        foreach ([
            'kabaMasX10' => 'kaba-mas-x-10',
            'lkm10k' => 'lkm10k',
        ] as $key => $anchor) {
            $item = $home['publicSite']['supplies'][$key] ?? null;

            if (! is_array($item)) {
                continue;
            }

            $offers[] = [
                '@type' => 'Offer',
                'itemOffered' => [
                    '@type' => 'Service',
                    'name' => $item['title'] ?? $key,
                    'description' => $item['description'] ?? '',
                    'url' => url('/certifications').'#'.$anchor,
                ],
            ];
        }

        return [
            $this->business(),
            [
                '@type' => 'WebSite',
                '@id' => $this->id('website'),
                'name' => 'Gateway Door Systems',
                'url' => url('/'),
                'publisher' => ['@id' => $this->id('business')],
                'inLanguage' => ['en', 'es'],
            ],
            [
                '@type' => 'OfferCatalog',
                'name' => 'Doors, windows, and high-security locks',
                'itemListElement' => $offers,
            ],
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function aboutGraph(): array
    {
        $meta = $this->file('about', 'en')['meta'] ?? [];

        return [
            $this->business(),
            [
                '@type' => 'AboutPage',
                'name' => $this->short((string) ($meta['title'] ?? 'About')),
                'description' => (string) ($meta['description'] ?? ''),
                'url' => url('/about'),
                'primaryImageOfPage' => url('/images/products/door-row.svg'),
                'publisher' => ['@id' => $this->id('business')],
                'mainEntity' => [
                    $this->person('Larry Deminski'),
                    $this->person('Ricardo Scarpim'),
                ],
            ],
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function certificationsGraph(): array
    {
        $meta = $this->file('certifications', 'en')['meta'] ?? [];
        $items = $this->file('certifications', 'en')['items'] ?? [];
        $anchors = [
            'lockmasters' => 'lockmasters',
            'kabaMasX10' => 'kaba-mas-x-10',
            'lkm10k' => 'lkm10k',
            'rf' => 'rf',
            'scifRooms' => 'scif-rooms',
        ];
        $credentials = [];

        foreach ($anchors as $key => $anchor) {
            $item = is_array($items) ? ($items[$key] ?? null) : null;

            if (! is_array($item)) {
                continue;
            }

            $credentials[] = [
                '@type' => 'EducationalOccupationalCredential',
                'name' => $item['title'] ?? $key,
                'description' => $item['summary'] ?? '',
                'url' => url('/certifications').'#'.$anchor,
            ];
        }

        return [
            $this->business(),
            [
                '@type' => 'WebPage',
                'name' => $this->short((string) ($meta['title'] ?? 'Certifications')),
                'description' => (string) ($meta['description'] ?? ''),
                'url' => url('/certifications'),
                'about' => $credentials,
                'publisher' => ['@id' => $this->id('business')],
            ],
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function serviceGraph(
        string $title,
        string $description,
        string $imagePath,
        string $slug,
        bool $isGroup,
    ): array {
        $canonical = url('/services/'.$slug);

        $crumbs = [
            [
                '@type' => 'ListItem',
                'position' => 1,
                'name' => 'Home',
                'item' => url('/'),
            ],
        ];

        if (! $isGroup) {
            $crumbs[] = [
                '@type' => 'ListItem',
                'position' => 2,
                'name' => 'Services',
                'item' => url('/').'#services',
            ];
        }

        $crumbs[] = [
            '@type' => 'ListItem',
            'position' => count($crumbs) + 1,
            'name' => $title,
            'item' => $canonical,
        ];

        return [
            $this->business(),
            [
                '@type' => 'Service',
                'name' => $title,
                'description' => $description,
                'serviceType' => $title,
                'url' => $canonical,
                'image' => url($imagePath),
                'provider' => ['@id' => $this->id('business')],
                'areaServed' => $this->areas(),
                'mainEntityOfPage' => $canonical,
            ],
            [
                '@type' => 'BreadcrumbList',
                'itemListElement' => $crumbs,
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function business(): array
    {
        $company = Company::query()->where('is_active', true)->latest('id')->first();
        $node = [
            '@type' => 'LocalBusiness',
            '@id' => $this->id('business'),
            'name' => 'Gateway Door Systems',
            'url' => url('/'),
            'image' => url('/images/products/hero.svg'),
            'logo' => url('/images/Gateway_Door_Systems_Logo.png'),
            'areaServed' => $this->areas(),
            'knowsAbout' => [
                'Specialty door installation',
                'Specialty window installation',
                'SCIF room construction',
                'Radio frequency shielded doors',
                'Kaba Mas X-10',
                'Lockmasters LKM10K',
                'Hollow metal doors',
                'Commercial door installation',
            ],
        ];

        $phone = $company?->contact_phone_number;
        if (is_string($phone) && $phone !== '') {
            $node['telephone'] = $phone;
        }

        $email = $company?->email;
        if (is_string($email) && $email !== '') {
            $node['email'] = $email;
        }

        if (
            $company instanceof Company
            && is_string($company->address_line_1)
            && $company->address_line_1 !== ''
            && is_string($company->city)
            && $company->city !== ''
            && is_string($company->state)
            && $company->state !== ''
        ) {
            $street = trim($company->address_line_1.' '.(string) $company->address_line_2);
            $node['address'] = [
                '@type' => 'PostalAddress',
                'streetAddress' => $street,
                'addressLocality' => $company->city,
                'addressRegion' => $company->state,
                'postalCode' => $company->postal_code,
                'addressCountry' => $company->country ?: 'US',
            ];
        }

        return $node;
    }

    /**
     * @return array<string, mixed>
     */
    private function person(string $name): array
    {
        return [
            '@type' => 'Person',
            'name' => $name,
            'jobTitle' => 'Owner',
                'worksFor' => ['@id' => $this->id('business')],
        ];
    }

    /**
     * @return array<int, array<string, string>>
     */
    private function areas(): array
    {
        return [
            ['@type' => 'State', 'name' => 'New York'],
            ['@type' => 'State', 'name' => 'New Jersey'],
            ['@type' => 'State', 'name' => 'Pennsylvania'],
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $graph
     */
    private function document(array $graph): string
    {
        return json_encode(
            [
                '@context' => 'https://schema.org',
                '@graph' => $graph,
            ],
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_THROW_ON_ERROR,
        );
    }

    private function id(string $fragment): string
    {
        return rtrim(url('/'), '/').'/#'.$fragment;
    }

    private function short(string $title): string
    {
        $title = trim($title);
        $stripped = preg_replace('/\s+[|\-]\s+Gateway Door Systems$/u', '', $title);

        return trim(is_string($stripped) ? $stripped : $title);
    }

    /**
     * @return array<string, mixed>
     */
    private function file(string $name, string $locale): array
    {
        $key = $locale.'/'.$name;

        if (! isset($this->files[$key])) {
            $path = resource_path("js/i18n/locales/{$locale}/{$name}.json");
            $decoded = json_decode((string) file_get_contents($path), true);
            $this->files[$key] = is_array($decoded) ? $decoded : [];
        }

        return $this->files[$key];
    }
}
