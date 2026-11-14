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
                'title' => 'Sign-up by approval',
                'category' => 'Feature',
                'summary' => 'New users request access with their name and email, and an administrator approves them.',
                'details' => [
                    'The sign-up form asks only for name and email and emails Ricardo through Microsoft 365.',
                    'Ricardo chooses the user level and approves or denies the request.',
                    'An approved person receives a link that works for 8 minutes, with a live countdown clock.',
                    'After the link expires it cannot be used again and the email cannot request again.',
                ],
            ],
            [
                'title' => 'Better blocked-login email with one-click unlock',
                'category' => 'Improvement',
                'summary' => 'The blocked-login email has a clearer design and an Allow another try button that works with one click.',
                'details' => [
                    'The email shows the user, attempts, time, IP address and device in a clean table.',
                    'Clicking the button unlocks the account right away, once per block.',
                ],
            ],
            [
                'title' => 'Login block log in User management',
                'category' => 'Feature',
                'summary' => 'Every blocked login is recorded and shown as a table on the Users page.',
                'details' => [
                    'Each entry shows when, who, attempts, IP address, device and whether the admin email was sent.',
                    'It also shows when and how the block was released, and by whom.',
                ],
            ],
            [
                'title' => 'Log out confirmation and navbar button',
                'category' => 'Improvement',
                'summary' => 'The red log out icon moved to the top navbar and asks for confirmation.',
                'details' => [
                    'The log out icon is the last icon on the right of the top navbar.',
                    'A confirmation message prevents signing out by accident.',
                    'The Hide sidebar button is highlighted.',
                ],
            ],
            [
                'title' => 'Project control chart on the dashboard',
                'category' => 'Feature',
                'summary' => 'Super administrators see the project control pipeline value by status on the dashboard.',
                'details' => [
                    'Shows the dollar value of Active, On hold and Lost jobs, with the job count for each.',
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
