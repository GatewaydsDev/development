<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ClearDocumentRecords extends Command
{
    protected $signature = 'documents:clear {--force : Delete the records without asking}';

    protected $description = 'Delete print layouts, quotations, bids, projects, and the rows that belong to them, then restart their id counters';

    /**
     * Child rows first, then the parent records. Catalogs such as statuses,
     * titles, products, contractors, and employees stay in place.
     *
     * @var list<string>
     */
    private const TABLES = [
        'quotation_contact',
        'quotation_line_items',
        'quotation_product_fields',
        'quotation_revisions',
        'quotation_tables',
        'bid_pricing_items',
        'bid_pricings',
        'bid_scope_products',
        'bid_scopes',
        'bid_stages',
        'bid_revisions',
        'work_schedule_employees',
        'employee_work_schedules',
        'employee_project_assignments',
        'pre_bids',
        'project_contractor',
        'project_revisions',
        'project_scopes',
        'document_layout_assignments',
        'bids',
        'quotations',
        'projects',
        'print_layouts',
    ];

    public function handle(): int
    {
        if (! $this->option('force') && ! $this->confirm('Delete every print layout, quotation, bid, and project, including their related rows?')) {
            $this->info('Cleanup cancelled.');

            return self::SUCCESS;
        }

        $driver = DB::getDriverName();

        if (! in_array($driver, ['mysql', 'mariadb'], true)) {
            $this->error('This cleanup runs on MySQL so the id counters can be restarted.');

            return self::FAILURE;
        }

        DB::statement('SET FOREIGN_KEY_CHECKS=0');

        try {
            if (Schema::hasTable('employee_check_ins') && Schema::hasColumn('employee_check_ins', 'project_id')) {
                DB::table('employee_check_ins')->update(['project_id' => null]);
            }

            foreach (self::TABLES as $table) {
                if (! Schema::hasTable($table)) {
                    $this->warn("Skipped missing table {$table}.");

                    continue;
                }

                $count = DB::table($table)->count();
                DB::statement('TRUNCATE TABLE `'.$table.'`');
                DB::statement('ALTER TABLE `'.$table.'` AUTO_INCREMENT = 0');
                $this->line("Cleared {$table} ({$count} rows).");
            }
        } finally {
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        }

        $this->newLine();
        $this->info('Cleanup finished. The next saved record in each table starts at 1. MySQL does not keep an auto-increment counter at 0.');

        return self::SUCCESS;
    }
}
