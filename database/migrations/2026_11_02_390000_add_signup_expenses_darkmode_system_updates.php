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
                'title' => 'Sign-up requests managed from the Login block log',
                'category' => 'Feature',
                'summary' => 'Super administrators can approve, deny or reopen sign-up requests and email people straight from User management.',
                'details' => [
                    'Sign-up requests appear in the Login block log with a status dropdown (Pending, Approved, Denied).',
                    'Clicking "Admin email" opens a popup to email the person, and you can type a different, validated address.',
                    'The person who asked gets a confirmation email, and a result email when approved or denied.',
                    'Emails now include a clickable button and a plain link, so nothing needs to be copied.',
                ],
            ],
            [
                'title' => 'Stronger password setup for new accounts',
                'category' => 'Improvement',
                'summary' => 'Creating a password during sign-up shows a live checklist and strength meter.',
                'details' => [
                    'Passwords need at least 8 characters with upper and lower case letters, a number and a symbol.',
                    'The password cannot contain the start of the email address.',
                    'The Create account button stays disabled until every rule is met.',
                ],
            ],
            [
                'title' => 'Recurring expenses and receipt scanning',
                'category' => 'Feature',
                'summary' => 'Subscriptions can repeat on a schedule, and receipt photos fill in the expense for you.',
                'details' => [
                    'Mark an expense as repeating weekly, monthly, every 3 months or yearly, with a first-charge date and an optional end date.',
                    'The expense list shows the schedule and the next charge date.',
                    'Taking or choosing a receipt photo reads the date, total, tax, address and store, and fills only the empty fields.',
                    'New Tax and Store address fields were added to expenses.',
                ],
            ],
            [
                'title' => 'Dark mode and email status fixes',
                'category' => 'Fix',
                'summary' => 'Status labels are readable in dark mode, and a mail problem now shows a warning instead of silently hiding the unread count.',
                'details' => [
                    'Status badges in User management are readable in every dashboard theme in dark mode.',
                    'Pale green panels no longer stay light in dark mode.',
                    'If the inbox cannot be checked, the mail icon shows an amber dot and the cause is written to the server log.',
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
