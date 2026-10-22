<?php

namespace App\Console\Commands;

use App\Support\PrintLayoutCleanup;
use Illuminate\Console\Command;

class ClearOldQuoteAndBidLayouts extends Command
{
    protected $signature = 'layouts:clear-quotes-bids {--force : Delete the old layouts without asking}';

    protected $description = 'Remove older quotation and bid print layouts and clear the layout copy stored on each quotation and bid';

    public function handle(): int
    {
        if (! $this->option('force') && ! $this->confirm('Remove older quotation and bid print layouts? The newest layout of each type stays. Saved quotations and bids will print with that layout instead of their old copy.')) {
            $this->info('Cleanup cancelled.');

            return self::SUCCESS;
        }

        $result = PrintLayoutCleanup::clearOldQuoteAndBidLayouts();

        foreach ($result['kept'] as $type => $name) {
            $this->line($name
                ? "Kept the newest {$type} layout: {$name}."
                : "No {$type} layout was left to keep.");
        }

        $this->line("Removed {$result['removed']} old layout(s).");
        $this->line("Cleared the stored layout on {$result['quotations']} quotation(s) and {$result['bids']} bid(s).");
        $this->newLine();
        $this->info('Print quotation and print bid now use the layout that was kept.');

        return self::SUCCESS;
    }
}
