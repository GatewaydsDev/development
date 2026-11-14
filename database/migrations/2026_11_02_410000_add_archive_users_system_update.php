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
                'title' => 'Archive users',
                'category' => 'Feature',
                'summary' => 'Super administrators can archive a user instead of deleting them.',
                'details' => [
                    'Use the Archive button in the user list; the user can no longer sign in and leaves the lists.',
                    'Their emails and phone numbers are archived with them and any employee record is set to inactive.',
                    'Nothing is permanently deleted, so an archived user can be restored.',
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
