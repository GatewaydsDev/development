<?php

namespace App\Http\Controllers;

use Illuminate\Http\Response;

class SeoController extends Controller
{
    public function sitemap(): Response
    {
        $urls = [
            [
                'loc' => url('/'),
                'changefreq' => 'weekly',
                'priority' => '1.0',
            ],
            [
                'loc' => url('/about'),
                'changefreq' => 'monthly',
                'priority' => '0.8',
            ],
            [
                'loc' => url('/certifications'),
                'changefreq' => 'monthly',
                'priority' => '0.8',
            ],
        ];

        foreach (array_keys(config('public_service_groups')) as $slug) {
            $urls[] = [
                'loc' => url('/services/'.$slug),
                'changefreq' => 'monthly',
                'priority' => '0.85',
            ];
        }

        foreach (array_keys(config('public_services')) as $slug) {
            $urls[] = [
                'loc' => url('/services/'.$slug),
                'changefreq' => 'monthly',
                'priority' => $slug === 'scif-rooms-construction' ? '0.9' : '0.8',
            ];
        }

        $xml = '<?xml version="1.0" encoding="UTF-8"?>'."\n";
        $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'."\n";

        foreach ($urls as $url) {
            $xml .= '    <url>'."\n";
            $xml .= '        <loc>'.e($url['loc']).'</loc>'."\n";
            $xml .= '        <changefreq>'.e($url['changefreq']).'</changefreq>'."\n";
            $xml .= '        <priority>'.e($url['priority']).'</priority>'."\n";
            $xml .= '    </url>'."\n";
        }

        $xml .= '</urlset>'."\n";

        return response($xml, 200)
            ->header('Content-Type', 'application/xml; charset=UTF-8');
    }

    public function robots(): Response
    {
        $lines = [
            'User-agent: *',
            'Allow: /',
            'Disallow: /dashboard',
            'Disallow: /administration',
            'Disallow: /profile',
            'Disallow: /login',
            'Disallow: /register',
            'Disallow: /forgot-password',
            'Disallow: /reset-password',
            'Disallow: /verify-email',
            'Disallow: /confirm-password',
            'Disallow: /notifications',
            'Disallow: /send-sms',
            '',
            'Sitemap: '.url('/sitemap.xml'),
        ];

        return response(implode("\n", $lines)."\n", 200)
            ->header('Content-Type', 'text/plain; charset=UTF-8');
    }
}
