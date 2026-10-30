<?php

namespace App\Support;

use App\Models\ProjectControl;
use App\Models\ProjectControlBid;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ProjectControlImporter
{
    /**
     * @return array{created: int, skipped: int}
     */
    public function import(string $path): array
    {
        $book = SimpleXlsx::read($path);
        $jobs = $this->table($book, 'Jobs & Bids', ['Job ID']);

        if ($jobs === []) {
            throw new RuntimeException('That workbook has no Jobs & Bids sheet.');
        }

        $created = 0;
        $skipped = 0;
        $imported = [];

        DB::transaction(function () use ($book, $jobs, &$created, &$skipped, &$imported): void {
            foreach ($jobs as $row) {
                $code = trim((string) ($row['Job ID'] ?? ''));

                if ($code === '' || strcasecmp($code, 'Job ID') === 0 || ! preg_match('/^J-\d+$/i', $code)) {
                    continue;
                }

                $code = strtoupper($code);

                if (ProjectControl::query()->where('job_code', $code)->exists()) {
                    $skipped++;

                    continue;
                }

                $status = trim((string) ($row['Status'] ?? ''));
                $control = ProjectControl::query()->create([
                    'job_code' => $code,
                    'name' => $this->text($row['Project / Job'] ?? '') ?: $code,
                    'customer' => $this->text($row['Customer / Prime'] ?? ''),
                    'location' => $this->text($row['Location'] ?? ''),
                    'bid_date' => $this->date($row['Bid / Quote Date'] ?? ''),
                    'current_value' => $this->money($row['Current Value'] ?? ''),
                    'pipeline_status' => ProjectControl::pipelineStatusFromNote($status),
                    'status_note' => $this->text($status),
                    'award_status' => $this->text($row['Award / PO Status'] ?? ''),
                    'probability' => $this->probability($row['Probability'] ?? ''),
                    'scope_summary' => $this->text($row['Scope Summary'] ?? ''),
                    'assembly_count' => $this->whole($row['Known Door / Opening Assemblies'] ?? ''),
                    'pricing_class' => $this->text($row['Pricing Class'] ?? ''),
                    'material_cost' => $this->money($row['Est Material / Supplier Cost'] ?? ''),
                    'freight_cost' => $this->money($row['Freight / Handling Allowance'] ?? ''),
                    'labor_cost' => $this->money($row['Est Labor / Payroll Burden'] ?? ''),
                    'other_cost' => $this->money($row['Other Direct Cost / Contingency'] ?? ''),
                    'deposit_percent' => $this->percent($row['Customer Deposit %'] ?? ''),
                    'bid_due_date' => $this->date($row['Bid Due Date'] ?? ''),
                    'next_follow_up_date' => $this->date($row['Next Follow-Up Date'] ?? ''),
                    'material_payment_date' => $this->date($row['Expected Material Payment Date'] ?? ''),
                    'customer_payment_date' => $this->date($row['Expected Customer Payment Date'] ?? ''),
                    'lead_time' => $this->text($row['Lead Time (Weeks)'] ?? ''),
                    'bonding_required' => $this->text($row['Bonding Required?'] ?? ''),
                    'payment_plan' => $this->text($row['Payment / Billing Plan'] ?? ''),
                    'cash_flag' => $this->text($row['Cash / Follow-Up Flag'] ?? ''),
                    'next_step' => $this->text($row['Next Procurement / Sales Step'] ?? ''),
                    'bid_document' => $this->text($row['Current Bid Source'] ?? ''),
                    'counts_in_demonstrated' => $this->yes($this->columnStarting($row, 'Counts in')),
                ]);

                $imported[$code] = $control;
                $created++;
            }

            $this->importBids($book, $imported);
            $this->importOpenings($book, $imported);
            $this->importProcurements($book, $imported);
            $this->importBlastDetail($book, $imported);
        });

        return ['created' => $created, 'skipped' => $skipped];
    }

    /**
     * @param  array<string, ProjectControl>  $imported
     */
    private function importBids(array $book, array $imported): void
    {
        $sort = [];

        foreach ($this->table($book, 'Bid Versions', ['Job ID', 'Bid / Quote Version']) as $row) {
            $control = $this->imported($imported, $row['Job ID'] ?? '');
            $name = $this->text($row['Bid / Quote Version'] ?? '');

            if ($control === null || $name === null) {
                continue;
            }

            $sort[$control->id] = ($sort[$control->id] ?? 0) + 1;
            $control->bids()->create([
                'sort_order' => $sort[$control->id],
                'name' => $name,
                'quoted_on' => $this->date($row['Date'] ?? ''),
                'amount' => $this->money($row['Amount'] ?? ''),
                'standing' => ProjectControlBid::standingFromLabel((string) ($row['Current?'] ?? '')),
                'count_rule' => $this->text($row['Double-Count Rule'] ?? ''),
                'document' => $this->text($row['Document'] ?? ''),
                'notes' => $this->text($row['Notes'] ?? ''),
            ]);
        }
    }

    /**
     * @param  array<string, ProjectControl>  $imported
     */
    private function importOpenings(array $book, array $imported): void
    {
        $sort = [];

        foreach ($this->table($book, 'Door & Material Inventory', ['Job ID', 'Item / Door Description']) as $row) {
            $control = $this->imported($imported, $row['Job ID'] ?? '');
            $description = $this->text($row['Item / Door Description'] ?? '');

            if ($control === null || $description === null) {
                continue;
            }

            $sort[$control->id] = ($sort[$control->id] ?? 0) + 1;
            $control->openings()->create([
                'sort_order' => $sort[$control->id],
                'category' => $this->text($row['Category'] ?? ''),
                'description' => $description,
                'mark' => $this->text($row['Mark / Building'] ?? ''),
                'size' => $this->text($row['Size'] ?? ''),
                'quantity' => $this->money($row['Qty'] ?? ''),
                'requirement' => $this->text($row['Fire / Acoustic / Blast Requirement'] ?? ''),
                'hardware' => $this->text($row['Included Hardware / Accessories'] ?? ''),
                'additional_needed' => $this->text($row['Additional Inventory Needed'] ?? ''),
                'procurement_status' => $this->text($row['Procurement Status'] ?? ''),
                'supplier' => $this->text($row['Supplier / Basis'] ?? ''),
                'unit_sell' => $this->money($row['Quoted Unit Sell'] ?? ''),
                'notes' => $this->text($row['Notes'] ?? ''),
            ]);
        }
    }

    /**
     * @param  array<string, ProjectControl>  $imported
     */
    private function importProcurements(array $book, array $imported): void
    {
        $sort = [];

        foreach ($this->table($book, 'Procurement Tracker', ['Job ID', 'Door / Assembly']) as $row) {
            $control = $this->imported($imported, $row['Job ID'] ?? '');
            $assembly = $this->text($row['Door / Assembly'] ?? '');

            if ($control === null || $assembly === null) {
                continue;
            }

            $sort[$control->id] = ($sort[$control->id] ?? 0) + 1;
            $control->procurements()->create([
                'sort_order' => $sort[$control->id],
                'assembly' => $assembly,
                'quantity' => $this->money($row['Qty'] ?? ''),
                'manufacturer' => $this->text($row['Manufacturer / Vendor'] ?? ''),
                'quote_number' => $this->text($row['Quote / Bid #'] ?? ''),
                'quoted_on' => $this->date($row['Manufacturer Quote Date'] ?? ''),
                'supplier_cost' => $this->money($row['Supplier Quote / Cost Basis'] ?? ''),
                'order_status' => $this->text($row['Order Status'] ?? ''),
                'po_number' => $this->text($row['PO #'] ?? ''),
                'lead_time' => $this->text($row['Expected Lead Time'] ?? ''),
                'next_action' => $this->text($row['Evidence / Next Action'] ?? ''),
            ]);
        }
    }

    /**
     * @param  array<string, ProjectControl>  $imported
     */
    private function importBlastDetail(array $book, array $imported): void
    {
        $control = null;

        foreach ($imported as $job) {
            if (str_contains(strtolower($job->name), 'parker-lord')) {
                $control = $job;
                break;
            }
        }

        if ($control === null) {
            return;
        }

        $sort = (int) $control->openings()->max('sort_order');

        foreach ($this->table($book, 'Parker-Lord Blast Detail', ['Building', 'Door Size / Description']) as $row) {
            $building = $this->text($row['Building'] ?? '');
            $description = $this->text($row['Door Size / Description'] ?? '');

            if ($building === null || $description === null || str_starts_with(strtolower($building), 'total')) {
                continue;
            }

            $allocated = $this->money($row['Allocated Install/Freight/Handling Per Door'] ?? '');
            $buildingTotal = $this->money($row['Building Total'] ?? '');
            $note = trim((string) ($row['Notes'] ?? ''));
            $parts = array_filter([
                $note,
                $allocated !== null ? 'Allocated install/freight/handling '.$allocated.' per door.' : null,
                $buildingTotal !== null ? 'Building total '.$buildingTotal.' is a subset and stays out of the project value.' : null,
            ]);

            $sort++;
            $control->openings()->create([
                'sort_order' => $sort,
                'category' => 'Blast door',
                'description' => $description,
                'mark' => $building,
                'quantity' => $this->money($row['Qty'] ?? ''),
                'requirement' => 'Blast',
                'unit_sell' => $this->money($row['Door Material Unit Price'] ?? ''),
                'procurement_status' => 'Building detail',
                'notes' => $parts === [] ? null : implode(' ', $parts),
            ]);
        }
    }

    /**
     * @param  array<string, list<array<int, string>>>  $book
     * @param  list<string>  $markers
     * @return list<array<string, string>>
     */
    private function table(array $book, string $sheetName, array $markers): array
    {
        $rows = null;

        foreach ($book as $name => $sheetRows) {
            if (strcasecmp($name, $sheetName) === 0) {
                $rows = $sheetRows;
                break;
            }
        }

        if ($rows === null) {
            return [];
        }

        $headerIndex = null;
        $headers = [];

        foreach ($rows as $index => $row) {
            $values = array_map(fn (string $value): string => trim($value), $row);
            $matched = 0;

            foreach ($markers as $marker) {
                if (in_array($marker, $values, true)) {
                    $matched++;
                }
            }

            if ($matched === count($markers)) {
                $headerIndex = $index;
                $headers = $values;
                break;
            }
        }

        if ($headerIndex === null) {
            return [];
        }

        $records = [];

        foreach (array_slice($rows, $headerIndex + 1) as $row) {
            $record = [];
            $any = false;

            foreach ($headers as $column => $header) {
                if ($header === '') {
                    continue;
                }

                $value = trim((string) ($row[$column] ?? ''));
                $record[$header] = $value;
                $any = $any || $value !== '';
            }

            if ($any) {
                $records[] = $record;
            }
        }

        return $records;
    }

    /**
     * @param  array<string, ProjectControl>  $imported
     */
    private function imported(array $imported, string $code): ?ProjectControl
    {
        $code = strtoupper(trim($code));

        return $imported[$code] ?? null;
    }

    /**
     * @param  array<string, string>  $row
     */
    private function columnStarting(array $row, string $prefix): string
    {
        foreach ($row as $header => $value) {
            if (str_starts_with($header, $prefix)) {
                return $value;
            }
        }

        return '';
    }

    private function text(mixed $value): ?string
    {
        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }

    private function money(mixed $value): ?string
    {
        $value = str_replace([',', '$', ' '], '', trim((string) $value));

        if ($value === '' || ! is_numeric($value)) {
            return null;
        }

        return number_format((float) $value, 2, '.', '');
    }

    private function percent(mixed $value): ?string
    {
        $value = rtrim(trim((string) $value), '%');

        if ($value === '' || ! is_numeric($value)) {
            return null;
        }

        $number = (float) $value;

        if ($number > 0 && $number <= 1) {
            $number *= 100;
        }

        return number_format($number, 2, '.', '');
    }

    private function probability(mixed $value): ?string
    {
        $text = trim((string) $value);

        if ($text === '') {
            return null;
        }

        if (is_numeric($text)) {
            $number = (float) $text;

            if ($number > 0 && $number <= 1) {
                $number *= 100;
            }

            return rtrim(rtrim(number_format($number, 2, '.', ''), '0'), '.').'%';
        }

        return $text;
    }

    private function whole(mixed $value): ?int
    {
        $value = trim((string) $value);

        if ($value === '' || ! is_numeric($value)) {
            return null;
        }

        return (int) round((float) $value);
    }

    private function yes(mixed $value): bool
    {
        $text = strtolower(trim((string) $value));

        return $text !== '' && (str_starts_with($text, 'y') || $text === '1');
    }

    private function date(mixed $value): ?string
    {
        $value = trim((string) $value);

        if ($value === '') {
            return null;
        }

        if (preg_match('/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/', $value, $matches) === 1) {
            return sprintf('%04d-%02d-%02d', (int) $matches[3], (int) $matches[1], (int) $matches[2]);
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}/', $value) === 1) {
            return substr($value, 0, 10);
        }

        if (is_numeric($value)) {
            $serial = (float) $value;

            if ($serial < 20000 || $serial > 80000) {
                return null;
            }

            return Carbon::parse('1899-12-30')->addDays((int) round($serial))->toDateString();
        }

        return null;
    }
}
