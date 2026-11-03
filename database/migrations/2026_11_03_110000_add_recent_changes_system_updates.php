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
                'title' => 'Convert a job to a project or takeoff',
                'category' => 'Feature',
                'summary' => 'Create a Project or a Takeoff straight from a Project Control job.',
                'details' => [
                    'The job edit page has a "Convert this job" section with Project and Takeoff cards.',
                    'The project is filled from the job (name, location, value, notes, customer as contractor).',
                    'Converting twice never duplicates: an existing project or takeoff is reused.',
                    'The job list also has a folder button to create the project quickly.',
                ],
            ],
            [
                'title' => 'More tables in Record Corrections',
                'category' => 'Improvement',
                'summary' => 'Lookup lists such as priorities, scope types, job titles and bid templates can now be corrected.',
                'details' => [
                    'Added project priorities, scope types, job titles, project control terms and daily task titles.',
                    'Added bid pricing statuses, bid stage types, quotation statuses and titles, and bid text templates.',
                ],
            ],
            [
                'title' => 'User update 404 fixed',
                'category' => 'Fix',
                'summary' => 'Super administrators can open and update every user again.',
                'details' => [
                    'Only the private owner account is hidden from other users, matched by email.',
                    'A second user with the same name no longer causes a 404 page.',
                ],
            ],
            [
                'title' => 'Contacts & Follow-ups',
                'category' => 'Feature',
                'summary' => 'Contact directory with suppliers, price requests, quote comparison, follow-ups and My Day.',
                'details' => [
                    'Contacts, companies, suppliers, price requests and quote comparison in one module.',
                    'Follow-ups and email templates, with a My Day view to act on today\'s tasks.',
                    'Run the latest migrations on the server before using it.',
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
                'released_on' => '2026-11-03',
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
