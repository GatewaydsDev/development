<?php

namespace App\Support;

use App\Models\ProjectControl;
use App\Models\ProjectControlBid;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ProjectControlImporter
{
    /**
     * @var array{
     *     created: int,
     *     updated: int,
     *     unchanged: int,
     *     related_created: int,
     *     related_updated: int,
     *     related_unchanged: int,
     *     duplicates: int
     * }
     */
    private array $result = [];

    /**
     * @return array{
     *     created: int,
     *     updated: int,
     *     unchanged: int,
     *     related_created: int,
     *     related_updated: int,
     *     related_unchanged: int,
     *     duplicates: int
     * }
     */
    public function import(string $path): array
    {
        $book = SimpleXlsx::read($path);
        $jobs = $this->table($book, 'Jobs & Bids', ['Job ID']);

        if ($jobs === []) {
            throw new RuntimeException('That workbook has no Jobs & Bids sheet.');
        }

        $this->result = [
            'created' => 0,
            'updated' => 0,
            'unchanged' => 0,
            'related_created' => 0,
            'related_updated' => 0,
            'related_unchanged' => 0,
            'duplicates' => 0,
        ];
        $jobRows = $this->jobRows($jobs);

        DB::transaction(function () use ($book, $jobRows): void {
            $controls = [];

            foreach ($jobRows as $code => $row) {
                $control = ProjectControl::query()
                    ->where('job_code', $code)
                    ->lockForUpdate()
                    ->first();
                $attributes = $this->jobAttributes($code, $row);

                if ($control === null) {
                    $attributes['name'] ??= $code;
                    $control = ProjectControl::query()->create($attributes);
                    $this->result['created']++;
                } else {
                    $control->fill($attributes);

                    if ($control->isDirty()) {
                        $control->save();
                        $this->result['updated']++;
                    } else {
                        $this->result['unchanged']++;
                    }
                }

                $controls[$code] = $control;
            }

            $this->importBids($book, $controls);
            $this->importOpenings($book, $controls);
            $this->importProcurements($book, $controls);
            $this->importBlastDetail($book, $controls);
        });

        return $this->result;
    }

    /**
     * @param  list<array<string, string>>  $jobs
     * @return array<string, array<string, string>>
     */
    private function jobRows(array $jobs): array
    {
        $rows = [];

        foreach ($jobs as $row) {
            $code = strtoupper(trim((string) ($row['Job ID'] ?? '')));

            if ($code === '' || strcasecmp($code, 'Job ID') === 0 || preg_match('/^J-\d+$/', $code) !== 1) {
                continue;
            }

            if (isset($rows[$code])) {
                $this->result['duplicates']++;
            }

            // The last occurrence wins while the unique job code prevents a duplicate record.
            $rows[$code] = $row;
        }

        return $rows;
    }

    /**
     * @param  array<string, string>  $row
     * @return array<string, mixed>
     */
    private function jobAttributes(string $code, array $row): array
    {
        $attributes = [
            'job_code' => $code,
        ];

        foreach ([
            'Project / Job' => 'name',
            'Customer / Prime' => 'customer',
            'Location' => 'location',
            'Award / PO Status' => 'award_status',
            'Scope Summary' => 'scope_summary',
            'Pricing Class' => 'pricing_class',
            'Lead Time (Weeks)' => 'lead_time',
            'Bonding Required?' => 'bonding_required',
            'Payment / Billing Plan' => 'payment_plan',
            'Cash / Follow-Up Flag' => 'cash_flag',
            'Next Procurement / Sales Step' => 'next_step',
            'Current Bid Source' => 'bid_document',
        ] as $column => $field) {
            $this->mapColumn($attributes, $row, $column, $field, $this->text(...));
        }

        foreach ([
            'Bid / Quote Date' => 'bid_date',
            'Bid Due Date' => 'bid_due_date',
            'Next Follow-Up Date' => 'next_follow_up_date',
            'Expected Material Payment Date' => 'material_payment_date',
            'Expected Customer Payment Date' => 'customer_payment_date',
        ] as $column => $field) {
            $this->mapColumn($attributes, $row, $column, $field, $this->date(...));
        }

        foreach ([
            'Current Value' => 'current_value',
            'Est Material / Supplier Cost' => 'material_cost',
            'Freight / Handling Allowance' => 'freight_cost',
            'Est Labor / Payroll Burden' => 'labor_cost',
            'Other Direct Cost / Contingency' => 'other_cost',
        ] as $column => $field) {
            $this->mapColumn($attributes, $row, $column, $field, $this->money(...));
        }

        $this->mapColumn($attributes, $row, 'Probability', 'probability', $this->probability(...));
        $this->mapColumn($attributes, $row, 'Known Door / Opening Assemblies', 'assembly_count', $this->whole(...));
        $this->mapColumn($attributes, $row, 'Customer Deposit %', 'deposit_percent', $this->percent(...));

        if (array_key_exists('Status', $row)) {
            $status = trim((string) $row['Status']);
            $attributes['pipeline_status'] = ProjectControl::pipelineStatusFromNote($status);
            $attributes['status_note'] = $this->text($status);
        }

        foreach ($row as $column => $value) {
            if (str_starts_with($column, 'Counts in')) {
                $attributes['counts_in_demonstrated'] = $this->yes($value);
                break;
            }
        }

        return $attributes;
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @param  array<string, string>  $row
     */
    private function mapColumn(
        array &$attributes,
        array $row,
        string $column,
        string $field,
        callable $transform,
    ): void {
        if (array_key_exists($column, $row)) {
            $attributes[$field] = $transform($row[$column]);
        }
    }

    /**
     * @param  array<string, ProjectControl>  $imported
     */
    private function importBids(array $book, array $imported): void
    {
        $rows = [];

        foreach ($this->table($book, 'Bid Versions', ['Job ID', 'Bid / Quote Version']) as $row) {
            $control = $this->imported($imported, $row['Job ID'] ?? '');
            $name = $this->text($row['Bid / Quote Version'] ?? '');

            if ($control === null || $name === null) {
                continue;
            }

            $attributes = [
                'name' => $name,
            ];
            $this->mapColumn($attributes, $row, 'Date', 'quoted_on', $this->date(...));
            $this->mapColumn($attributes, $row, 'Amount', 'amount', $this->money(...));
            $this->mapColumn(
                $attributes,
                $row,
                'Current?',
                'standing',
                fn (mixed $value): string => ProjectControlBid::standingFromLabel((string) $value),
            );
            $this->mapColumn($attributes, $row, 'Double-Count Rule', 'count_rule', $this->text(...));
            $this->mapColumn($attributes, $row, 'Document', 'document', $this->text(...));
            $this->mapColumn($attributes, $row, 'Notes', 'notes', $this->text(...));
            $rows[$control->job_code][] = $attributes;
        }

        foreach ($rows as $code => $items) {
            $this->syncRelated($imported[$code], 'bids', $items, ['name']);
        }
    }

    /**
     * @param  array<string, ProjectControl>  $imported
     */
    private function importOpenings(array $book, array $imported): void
    {
        $rows = [];

        foreach ($this->table($book, 'Door & Material Inventory', ['Job ID', 'Item / Door Description']) as $row) {
            $control = $this->imported($imported, $row['Job ID'] ?? '');
            $description = $this->text($row['Item / Door Description'] ?? '');

            if ($control === null || $description === null) {
                continue;
            }

            $attributes = [
                'description' => $description,
            ];
            foreach ([
                'Category' => 'category',
                'Mark / Building' => 'mark',
                'Size' => 'size',
                'Fire / Acoustic / Blast Requirement' => 'requirement',
                'Included Hardware / Accessories' => 'hardware',
                'Additional Inventory Needed' => 'additional_needed',
                'Procurement Status' => 'procurement_status',
                'Supplier / Basis' => 'supplier',
                'Notes' => 'notes',
            ] as $column => $field) {
                $this->mapColumn($attributes, $row, $column, $field, $this->text(...));
            }
            $this->mapColumn($attributes, $row, 'Qty', 'quantity', $this->money(...));
            $this->mapColumn($attributes, $row, 'Quoted Unit Sell', 'unit_sell', $this->money(...));
            $rows[$control->job_code][] = $attributes;
        }

        foreach ($rows as $code => $items) {
            $this->syncRelated($imported[$code], 'openings', $items, ['description', 'mark', 'size']);
        }
    }

    /**
     * @param  array<string, ProjectControl>  $imported
     */
    private function importProcurements(array $book, array $imported): void
    {
        $rows = [];

        foreach ($this->table($book, 'Procurement Tracker', ['Job ID', 'Door / Assembly']) as $row) {
            $control = $this->imported($imported, $row['Job ID'] ?? '');
            $assembly = $this->text($row['Door / Assembly'] ?? '');

            if ($control === null || $assembly === null) {
                continue;
            }

            $attributes = [
                'assembly' => $assembly,
            ];
            foreach ([
                'Manufacturer / Vendor' => 'manufacturer',
                'Quote / Bid #' => 'quote_number',
                'Order Status' => 'order_status',
                'PO #' => 'po_number',
                'Expected Lead Time' => 'lead_time',
                'Evidence / Next Action' => 'next_action',
            ] as $column => $field) {
                $this->mapColumn($attributes, $row, $column, $field, $this->text(...));
            }
            $this->mapColumn($attributes, $row, 'Qty', 'quantity', $this->money(...));
            $this->mapColumn($attributes, $row, 'Manufacturer Quote Date', 'quoted_on', $this->date(...));
            $this->mapColumn($attributes, $row, 'Supplier Quote / Cost Basis', 'supplier_cost', $this->money(...));
            $rows[$control->job_code][] = $attributes;
        }

        foreach ($rows as $code => $items) {
            $this->syncRelated($imported[$code], 'procurements', $items, ['assembly', 'manufacturer']);
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

        $rows = [];

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

            $rows[] = [
                'category' => 'Blast door',
                'description' => $description,
                'mark' => $building,
                'quantity' => $this->money($row['Qty'] ?? ''),
                'requirement' => 'Blast',
                'unit_sell' => $this->money($row['Door Material Unit Price'] ?? ''),
                'procurement_status' => 'Building detail',
                'notes' => $parts === [] ? null : implode(' ', $parts),
            ];
        }

        if ($rows !== []) {
            $sortStart = (int) $control->openings()
                ->where(function ($query): void {
                    $query->whereNull('category')->orWhere('category', '!=', 'Blast door');
                })
                ->max('sort_order');
            $this->syncRelated($control, 'openings', $rows, ['description', 'mark', 'size'], $sortStart);
        }
    }

    /**
     * Synchronize rows present in the workbook without deleting manually added
     * database rows that are absent from it.
     *
     * @param  list<array<string, mixed>>  $rows
     * @param  list<string>  $identityFields
     */
    private function syncRelated(
        ProjectControl $control,
        string $relation,
        array $rows,
        array $identityFields,
        int $sortStart = 0,
    ): void {
        /** @var HasMany<Model, ProjectControl> $query */
        $query = $control->{$relation}();
        $existing = $query->orderBy('sort_order')->orderBy('id')->get()->values();
        $uniqueRows = [];
        $fingerprints = [];

        foreach ($rows as $row) {
            $fingerprint = hash('sha256', json_encode($row, JSON_THROW_ON_ERROR));

            if (isset($fingerprints[$fingerprint])) {
                $this->result['duplicates']++;

                continue;
            }

            $fingerprints[$fingerprint] = true;
            $row['sort_order'] = $sortStart + count($uniqueRows) + 1;
            $uniqueRows[] = $row;
        }

        $existingByKey = [];

        foreach ($existing as $model) {
            $existingByKey[$this->lineKey($model->getAttributes(), $identityFields)][] = $model;
        }

        $used = [];
        $sameCount = $existing->count() === count($uniqueRows);

        foreach ($uniqueRows as $index => $attributes) {
            $key = $this->lineKey($attributes, $identityFields);
            $model = null;

            while (($existingByKey[$key] ?? []) !== []) {
                $candidate = array_shift($existingByKey[$key]);

                if (! isset($used[$candidate->getKey()])) {
                    $model = $candidate;
                    break;
                }
            }

            if ($model === null && $sameCount) {
                $expectedSort = $sortStart + $index + 1;
                $model = $existing->first(
                    fn (Model $candidate): bool => ! isset($used[$candidate->getKey()])
                        && (int) $candidate->getAttribute('sort_order') === $expectedSort,
                );
            }

            if ($model === null) {
                $query->create($attributes);
                $this->result['related_created']++;

                continue;
            }

            $used[$model->getKey()] = true;
            $model->fill($attributes);

            if ($model->isDirty()) {
                $model->save();
                $this->result['related_updated']++;
            } else {
                $this->result['related_unchanged']++;
            }
        }
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @param  list<string>  $fields
     */
    private function lineKey(array $attributes, array $fields): string
    {
        return implode('|', array_map(
            fn (string $field): string => $this->normalizedKey($attributes[$field] ?? null),
            $fields,
        ));
    }

    private function normalizedKey(mixed $value): string
    {
        $value = mb_strtolower(trim((string) $value));

        return preg_replace('/\s+/', ' ', $value) ?? $value;
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
