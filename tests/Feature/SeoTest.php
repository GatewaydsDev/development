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
