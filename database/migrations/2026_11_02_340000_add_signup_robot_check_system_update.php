<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    private function entries(): array
    {
        return [
            [
                'title' => 'Robot check on sign-up',
                'category' => 'Improvement',
                'summary' => 'The sign-up form now confirms the visitor is a person before any email is sent.',
                'details' => [
                    'A Cloudflare Turnstile check must pass before a sign-up request is accepted.',
                    'A hidden trap field and a request limit stop automated sign-ups.',
                ],
            ],
        ];
    }

    public function up(): void
    {
        foreach ($this->entries() as $entry) {
            if (DB::table('system_updates')->where('title', $entry['title'])->exists()) {
                continue;
            }

            DB::table('system_updates')->insert([
                'uuid' => (string) Str::uuid(),
                'title' => $entry['title'],
                'summary' => $entry['summary'],
                'category' => $entry['category'],
                'released_on' => '2026-11-02',
                'details' => json_encode($entry['details']),
                'commits' => json_encode([]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        DB::table('system_updates')->whereIn('title', array_column($this->entries(), 'title'))->delete();
    }
};
