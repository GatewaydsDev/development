<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * @return list<array{title: string, category: string, summary: string, released_on: string, details: list<string>}>
     */
    private function entries(): array
    {
        return [
            [
                'title' => 'Forms follow the directory contact layout',
                'category' => 'Improvement',
                'released_on' => '2026-11-27',
                'summary' => 'Add and update forms use the same colored sections, add buttons, and remove buttons as directory contacts.',
                'details' => [
                    'Each section has a colored background, an icon, and a title.',
                    'Add sits at the bottom right as a small red button, in light and dark mode.',
                    'Remove on a repeating row is the same rose trash button used on directory contacts.',
                    'A repeating list stays empty until Add is clicked. Saved rows still show.',
                    'Bid stages no longer open with a row. The row appears when Add stage is clicked.',
                ],
            ],
            [
                'title' => 'Directory contact types and phone labels',
                'category' => 'Feature',
                'released_on' => '2026-11-27',
                'summary' => 'Contact type and each phone label can be chosen from a list, or added while the contact is open.',
                'details' => [
                    'One contact has one type. New types, such as Architect, are saved for the next contact.',
                    'Each phone number has one label, such as Office or Mobile, and that label can be reused.',
                    'The extension sits beside the primary checkbox.',
                    'Choosing a country keeps the number that fits that country.',
                ],
            ],
            [
                'title' => 'Project addendums, bid dates, and companies',
                'category' => 'Feature',
                'released_on' => '2026-11-27',
                'summary' => 'Bid dates, addendums, and companies are separate lists on a project, and an addendum file fills its own issued date.',
                'details' => [
                    'A project can have more than one company, chosen from the contact directory.',
                    'Choosing an addendum file fills the number, issued date, and notes from that document.',
                    'The issued date is the date of that addendum, not the bid date or an older revision.',
                    'The project list shows each addendum number and the date it was issued.',
                ],
            ],
            [
                'title' => 'Open a project on the section you clicked',
                'category' => 'Improvement',
                'released_on' => '2026-11-27',
                'summary' => 'The project list opens the project on the section that was clicked, and the project actions stay in view while scrolling.',
                'details' => [
                    'Quotation, bid, takeoff, schedule, addendums, and bid dates open that part of the project.',
                    'The page scrolls to the section.',
                    'Print, PDF, Word, Edit, and Remove stay available while the project page scrolls.',
                    'A takeoff shows breadcrumbs back to the list and the project.',
                ],
            ],
            [
                'title' => 'Takeoff openings and drawings',
                'category' => 'Improvement',
                'released_on' => '2026-11-27',
                'summary' => 'Openings can be edited from the list, and the drawing stays where it was left.',
                'details' => [
                    'Click an opening row to edit it. A category can be added from the list.',
                    'The drawing opens on the same horizontal and vertical position it was dragged to.',
                    'Specification fields appear only when that drawing supplies them.',
                    'The verified product, supplier price, and door setup are confirmed before the bid is sent.',
                ],
            ],
            [
                'title' => 'Dashboard charts',
                'category' => 'Improvement',
                'released_on' => '2026-11-27',
                'summary' => 'The dashboard shows labeled pie, bar, and line charts that stay inside the card on a phone.',
                'details' => [
                    'Charts use a regular color theme and stay inside their cards on small screens.',
                    'Mailbox activity loads with the page.',
                ],
            ],
            [
                'title' => 'Bid dates on the project list',
                'category' => 'Improvement',
                'released_on' => '2026-11-20',
                'summary' => 'Each project bid date, its note, and the days left until the bid opens show on the project list.',
                'details' => [
                    'Bid dates use month, day, and year.',
                    'Addendum files stay with the project.',
                    'Signing in opens the dashboard.',
                ],
            ],
            [
                'title' => 'Email drafts and smaller photos',
                'category' => 'Feature',
                'released_on' => '2026-11-19',
                'summary' => 'An unsent message can be saved as a draft, and large photos are reduced before they are sent.',
                'details' => [
                    'Save a draft and continue it later.',
                    'Each dropped file is attached once.',
                    'Large photo attachments are made smaller before sending.',
                ],
            ],
            [
                'title' => 'Project list totals',
                'category' => 'Improvement',
                'released_on' => '2026-11-16',
                'summary' => 'The projects list shows bid, won, and lost totals, and can scroll sideways to the actions.',
                'details' => [
                    'Bid, won, and lost totals are on the projects list.',
                    'On a narrow screen the list scrolls sideways to reach the row actions.',
                ],
            ],
            [
                'title' => 'Schedule, job progress, and attendance',
                'category' => 'Feature',
                'released_on' => '2026-11-04',
                'summary' => 'Work schedule, job progress, daily tasks, and attendance are grouped together, with hours and pay on the job.',
                'details' => [
                    'Those tools are grouped in the sidebar.',
                    'Job progress shows weekly hours and pay.',
                    'Hours can be saved for each rate type, with dates in month, day, and year.',
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
                'released_on' => $entry['released_on'],
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
