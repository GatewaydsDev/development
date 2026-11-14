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
                'title' => 'Foreman attendance check-in from the daily checklist',
                'category' => 'Field',
                'summary' => 'Foremen record who is on site, and the hours worked, directly from their daily checklist.',
                'details' => [
                    'Each work schedule shows a "Who is on site today" panel with the foreman, competent person, quality control and crew.',
                    'Mark each person present, and enter hours for anyone paid hourly.',
                    'Attendance is saved to the weekly attendance records, linked to the work schedule.',
                    'A person already recorded on another job that day is locked, so nobody is counted twice.',
                ],
            ],
            [
                'title' => 'Attendance entry starts from a work schedule',
                'category' => 'Feature',
                'summary' => 'Pick the work schedule first, then enter hours or days worked for the people on it.',
                'details' => [
                    'Add attendance week and Add several both begin with a work schedule dropdown.',
                    'Choosing a schedule loads its crew and keeps the dates inside the schedule period.',
                    'An employee added on the fly is automatically added to the work schedule.',
                    'Attendance days are linked to the schedule so jobs and payroll hours match.',
                ],
            ],
            [
                'title' => 'Attendance list redesign with employee skills',
                'category' => 'Improvement',
                'summary' => 'The attendance list uses the same colored-icon style as the rest of the app.',
                'details' => [
                    'Colored icon tiles, filters, week totals and day cells.',
                    'Employee skills appear under each employee name.',
                    'The start and end date filters are now clean single inputs with a calendar button.',
                ],
            ],
            [
                'title' => 'New mobile menu',
                'category' => 'Improvement',
                'summary' => 'The phone menu was rebuilt so it is up to date and easy to scroll.',
                'details' => [
                    'The dashboard menu opens as a side drawer with the same up-to-date navigation as desktop.',
                    'Scrolling the menu no longer scrolls the page underneath.',
                    'On the public site, Services is collapsed until opened, with collapsible groups.',
                    'Language and light/dark selectors sit at the top of the public mobile menu and open as small popups.',
                ],
            ],
            [
                'title' => 'Light and dark mode on the public website',
                'category' => 'Fix',
                'summary' => 'The Home page and mobile menu now follow the selected light, dark or system theme.',
                'details' => [
                    'Home page sections, cards and text switch between light and dark.',
                    'The public mobile menu changes with the theme instead of staying dark.',
                ],
            ],
            [
                'title' => 'Login protection after 3 failed attempts',
                'category' => 'Feature',
                'summary' => 'An account is blocked after 3 wrong passwords and super administrators are emailed.',
                'details' => [
                    'After 3 failed attempts the account cannot sign in, even with the right password.',
                    'Super administrators receive a Microsoft 365 email with the name, email, IP address, browser and time.',
                    'The email has a button that opens a page to allow the user to try again, or keep them blocked.',
                    'Super administrator accounts are never blocked. Remember me keeps working as before.',
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
