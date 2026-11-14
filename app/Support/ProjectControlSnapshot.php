<?php

namespace App\Support;

use App\Models\Project;
use App\Models\ProjectControl;
use App\Models\ProjectControlTerm;
use Illuminate\Support\Facades\DB;

class ProjectControlSnapshot
{
    public function install(): void
    {
        $jobs = $this->jobs();

        DB::transaction(function () use ($jobs): void {
            $this->rememberTerms($jobs);

            foreach ($jobs as $job) {
                if (ProjectControl::query()->where('job_code', $job['job_code'])->exists()) {
                    continue;
                }

                $control = ProjectControl::query()->create($this->jobAttributes($job));

                foreach ($job['bids'] as $index => $bid) {
                    $control->bids()->create([
                        'sort_order' => $bid['sort_order'] ?? ($index + 1),
                        'name' => $bid['name'],
                        'quoted_on' => $bid['quoted_on'] ?? null,
                        'amount' => $bid['amount'] ?? null,
                        'standing' => $bid['standing'] ?? 'historical',
                        'count_rule' => $bid['count_rule'] ?? null,
                        'document' => $bid['document'] ?? null,
                        'notes' => $bid['notes'] ?? null,
                    ]);
                }

                foreach ($job['openings'] as $index => $opening) {
                    $control->openings()->create([
                        'sort_order' => $opening['sort_order'] ?? ($index + 1),
                        'category' => $opening['category'] ?? null,
                        'description' => $opening['description'],
                        'mark' => $opening['mark'] ?? null,
                        'size' => $opening['size'] ?? null,
                        'quantity' => $opening['quantity'] ?? null,
                        'requirement' => $opening['requirement'] ?? null,
                        'hardware' => $opening['hardware'] ?? null,
                        'additional_needed' => $opening['additional_needed'] ?? null,
                        'procurement_status' => $opening['procurement_status'] ?? null,
                        'supplier' => $opening['supplier'] ?? null,
                        'unit_sell' => $opening['unit_sell'] ?? null,
                        'notes' => $opening['notes'] ?? null,
                    ]);
                }

                foreach ($job['procurements'] as $index => $procurement) {
                    $control->procurements()->create([
                        'sort_order' => $procurement['sort_order'] ?? ($index + 1),
                        'assembly' => $procurement['assembly'],
                        'quantity' => $procurement['quantity'] ?? null,
                        'manufacturer' => $procurement['manufacturer'] ?? null,
                        'quote_number' => $procurement['quote_number'] ?? null,
                        'quoted_on' => $procurement['quoted_on'] ?? null,
                        'supplier_cost' => $procurement['supplier_cost'] ?? null,
                        'order_status' => $procurement['order_status'] ?? null,
                        'po_number' => $procurement['po_number'] ?? null,
                        'lead_time' => $procurement['lead_time'] ?? null,
                        'next_action' => $procurement['next_action'] ?? null,
                    ]);
                }
            }

            ProjectControl::query()->with(['openings', 'procurements'])->orderBy('id')->each(function (ProjectControl $control): void {
                $this->ensureProject($control);
                $this->linkTerms($control);
            });
        });
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function jobs(): array
    {
        $path = database_path('data/project-control-september-2026.json');
        $decoded = json_decode((string) file_get_contents($path), true);

        return is_array($decoded['jobs'] ?? null) ? $decoded['jobs'] : [];
    }

    /**
     * @param  list<array<string, mixed>>  $jobs
     */
    private function rememberTerms(array $jobs): void
    {
        foreach ($jobs as $job) {
            foreach (ProjectControlTerm::JOB_FIELDS as $kind => $map) {
                ProjectControlTerm::findOrCreate($kind, (string) ($job[$map['column']] ?? ''));
            }

            foreach ($job['openings'] ?? [] as $opening) {
                ProjectControlTerm::findOrCreate('opening_category', (string) ($opening['category'] ?? ''));
                ProjectControlTerm::findOrCreate('procurement_status', (string) ($opening['procurement_status'] ?? ''));
            }

            foreach ($job['procurements'] ?? [] as $procurement) {
                ProjectControlTerm::findOrCreate('order_status', (string) ($procurement['order_status'] ?? ''));
                ProjectControlTerm::findOrCreate('lead_time', (string) ($procurement['lead_time'] ?? ''));
            }
        }

        ProjectControl::query()->orderBy('id')->each(function (ProjectControl $control): void {
            foreach (ProjectControlTerm::JOB_FIELDS as $kind => $map) {
                ProjectControlTerm::findOrCreate($kind, (string) ($control->{$map['column']} ?? ''));
            }
        });

        foreach (['opening_category' => 'category', 'procurement_status' => 'procurement_status'] as $kind => $column) {
            DB::table('project_control_openings')->orderBy('id')->pluck($column)->each(function (mixed $name) use ($kind): void {
                ProjectControlTerm::findOrCreate($kind, (string) $name);
            });
        }

        foreach (['order_status' => 'order_status', 'lead_time' => 'lead_time'] as $kind => $column) {
            DB::table('project_control_procurements')->orderBy('id')->pluck($column)->each(function (mixed $name) use ($kind): void {
                ProjectControlTerm::findOrCreate($kind, (string) $name);
            });
        }
    }

    /**
     * @param  array<string, mixed>  $job
     * @return array<string, mixed>
     */
    private function jobAttributes(array $job): array
    {
        $attributes = [];

        foreach ([
            'job_code', 'name', 'customer', 'location', 'bid_date', 'current_value', 'pipeline_status',
            'status_note', 'award_status', 'probability', 'scope_summary', 'assembly_count', 'pricing_class',
            'material_cost', 'freight_cost', 'labor_cost', 'other_cost', 'deposit_percent', 'bid_due_date',
            'next_follow_up_date', 'material_payment_date', 'customer_payment_date', 'lead_time',
            'bonding_required', 'payment_plan', 'cash_flag', 'next_step', 'bid_document', 'counts_in_demonstrated',
        ] as $key) {
            $attributes[$key] = $job[$key] ?? null;
        }

        $attributes['pipeline_status'] = $attributes['pipeline_status'] ?: 'active';
        $attributes['counts_in_demonstrated'] = (bool) $attributes['counts_in_demonstrated'];

        return $attributes;
    }

    private function ensureProject(ProjectControl $control): void
    {
        if ($control->project_id && Project::query()->whereKey($control->project_id)->exists()) {
            return;
        }

        $name = trim($control->name);
        $project = Project::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->first();

        if (! $project instanceof Project) {
            $project = Project::query()->create([
                'name' => mb_substr($name, 0, 255),
                'site_address_line_1' => $control->location === null ? null : mb_substr((string) $control->location, 0, 255),
                'budget_amount' => $control->current_value,
            ]);
        }

        $control->forceFill(['project_id' => $project->id])->save();
    }

    private function linkTerms(ProjectControl $control): void
    {
        $updates = [];

        foreach (ProjectControlTerm::JOB_FIELDS as $kind => $map) {
            if (filled($control->{$map['foreign']})) {
                continue;
            }

            $term = ProjectControlTerm::findOrCreate($kind, (string) ($control->{$map['column']} ?? ''));

            if ($term instanceof ProjectControlTerm) {
                $updates[$map['foreign']] = $term->id;
            }
        }

        if ($updates !== []) {
            $control->forceFill($updates)->save();
        }

        foreach ($control->openings as $opening) {
            $line = [];

            if (! filled($opening->category_id)) {
                $term = ProjectControlTerm::findOrCreate('opening_category', (string) $opening->category);
                if ($term instanceof ProjectControlTerm) {
                    $line['category_id'] = $term->id;
                }
            }

            if (! filled($opening->procurement_status_id)) {
                $term = ProjectControlTerm::findOrCreate('procurement_status', (string) $opening->procurement_status);
                if ($term instanceof ProjectControlTerm) {
                    $line['procurement_status_id'] = $term->id;
                }
            }

            if ($line !== []) {
                $opening->forceFill($line)->save();
            }
        }

        foreach ($control->procurements as $procurement) {
            $line = [];

            if (! filled($procurement->order_status_id)) {
                $term = ProjectControlTerm::findOrCreate('order_status', (string) $procurement->order_status);
                if ($term instanceof ProjectControlTerm) {
                    $line['order_status_id'] = $term->id;
                }
            }

            if (! filled($procurement->lead_time_id)) {
                $term = ProjectControlTerm::findOrCreate('lead_time', (string) $procurement->lead_time);
                if ($term instanceof ProjectControlTerm) {
                    $line['lead_time_id'] = $term->id;
                }
            }

            if ($line !== []) {
                $procurement->forceFill($line)->save();
            }
        }
    }
}
