<?php

use Inertia\Testing\AssertableInertia as Assert;

it('serves a sitemap with public pages and services', function () {
    $this->get('/sitemap.xml')
        ->assertOk()
        ->assertHeader('Content-Type', 'application/xml; charset=UTF-8')
        ->assertSee(url('/'), false)
        ->assertSee(url('/about'), false)
        ->assertSee(url('/certifications'), false)
        ->assertSee(url('/services/scif-rooms-construction'), false)
        ->assertSee(url('/services/radio-frequency-doors'), false)
        ->assertSee(url('/services/commercial-doors'), false)
        ->assertSee(url('/services/facility-equipment'), false);
});

it('serves robots.txt with a sitemap directive and private path blocks', function () {
    $this->get('/robots.txt')
        ->assertOk()
        ->assertSee('Allow: /', false)
        ->assertSee('Disallow: /dashboard', false)
        ->assertSee('Disallow: /administration', false)
        ->assertSee('Disallow: /portal', false)
        ->assertSee('Disallow: /email', false)
        ->assertSee('Disallow: /contact-directory', false)
        ->assertSee('Sitemap: '.url('/sitemap.xml'), false);
});

it('renders the commercial doors group page', function () {
    $this->get('/services/commercial-doors')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Services/Group')
            ->where('groupKey', 'commercial')
            ->where('groupSlug', 'commercial-doors')
        );
});

it('renders the facility equipment group page', function () {
    $this->get('/services/facility-equipment')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Services/Group')
            ->where('groupKey', 'equipment')
            ->where('groupSlug', 'facility-equipment')
        );
});

it('renders the scif rooms construction service page', function () {
    $this->get('/services/scif-rooms-construction')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Services/Show')
            ->where('serviceKey', 'scifRoomsConstruction')
            ->where('serviceSlug', 'scif-rooms-construction')
        );
});

it('prints indexable metadata for the home page before javascript runs', function () {
    $this->get('/')
        ->assertOk()
        ->assertSee('<title inertia>Specialty Doors &amp; Windows in NY, NJ &amp; PA - '.e(config('app.name')).'</title>', false)
        ->assertSee('name="description" content="Supply and installation of specialty doors, windows, SCIF rooms, RF doors, and Kaba Mas X-10 and LKM10K locks', false)
        ->assertSee('rel="canonical"', false)
        ->assertSee('Kaba Mas X-10', false)
        ->assertSee('Lockmasters LKM10K', false)
        ->assertSee('application/ld+json', false)
        ->assertSee('content="index, follow"', false);
});

it('asks search engines not to index the sign-in page', function () {
    $this->get('/login')
        ->assertOk()
        ->assertSee('name="robots" content="noindex, nofollow"', false);
});
