<?php

namespace App\Support;

use App\Models\Takeoff;
use App\Models\TakeoffCost;
use App\Models\TakeoffDocument;
use App\Models\TakeoffGroup;
use App\Models\TakeoffOpening;
use App\Models\TakeoffSupplierQuote;
use App\Models\User;

class TakeoffPresenter
{
    public static function summary(Takeoff $takeoff, User $user): array
    {
        $takeoff->loadMissing(['project:id,uuid,name,project_number', 'openings']);
        $pricing = TakeoffAccess::canViewPricing($user) ? TakeoffPricing::summarize($takeoff) : null;

        return [
            'id' => $takeoff->id,
            'uuid' => $takeoff->uuid,
            'title' => $takeoff->title,
            'status' => $takeoff->status,
            'revision_number' => $takeoff->revision_number,
            'revision_label' => $takeoff->revision_label,
            'opening_count' => $takeoff->openings->count(),
            'project' => $takeoff->project ? [
                'id' => $takeoff->project->id,
                'name' => $takeoff->project->name,
                'project_number' => $takeoff->project->project_number,
            ] : null,
            'estimate' => $pricing ? [
                'cost' => $pricing['cost'],
                'selling' => $pricing['selling'],
                'profit' => $pricing['profit'],
                'margin' => $pricing['margin'],
            ] : null,
            'updated_at' => $takeoff->updated_at?->toIso8601String(),
        ];
    }

    public static function detail(Takeoff $takeoff, User $user): array
    {
        $takeoff->load([
            'project:id,uuid,name,project_number',
            'documents.uploader:id,name',
            'openings.markers',
            'openings.references',
            'openings.costs',
            'openings.product:id,name',
            'openings.doorConfiguration:id,name',
            'openings.verifier:id,name',
            'openings.group',
            'groups.openings',
            'groups.costs',
            'supplierQuotes',
            'audits.user:id,name',
            'source.documents',
        ]);

        $showPricing = TakeoffAccess::canViewPricing($user);
        $pricing = $showPricing ? TakeoffPricing::summarize($takeoff) : null;
        $flags = TakeoffReview::flags($takeoff);
        $flagsByOpening = [];

        foreach ($flags as $flag) {
            $flagsByOpening[$flag['opening_id'] ?? 0][] = $flag;
        }

        $previous = null;

        if ($takeoff->source) {
            $previous = [
                'id' => $takeoff->source->id,
                'uuid' => $takeoff->source->uuid,
                'revision_number' => $takeoff->source->revision_number,
                'title' => $takeoff->source->title,
                'diff' => TakeoffRevision::diff($takeoff, $takeoff->source),
                'documents' => $takeoff->source->documents->map(fn (TakeoffDocument $document): array => self::document($document))->values()->all(),
            ];
        }

        return [
            'id' => $takeoff->id,
            'uuid' => $takeoff->uuid,
            'title' => $takeoff->title,
            'status' => $takeoff->status,
            'revision_number' => $takeoff->revision_number,
            'revision_label' => $takeoff->revision_label,
            'notes' => $takeoff->notes,
            'pricing_method' => $takeoff->pricing_method,
            'markup_percent' => $showPricing ? TakeoffMoney::percent($takeoff->markup_rate) : null,
            'margin_percent' => $showPricing ? TakeoffMoney::percent($takeoff->margin_rate) : null,
            'approved_at' => $takeoff->approved_at?->toIso8601String(),
            'updated_at' => $takeoff->updated_at?->toIso8601String(),
            'project' => $takeoff->project ? [
                'id' => $takeoff->project->id,
                'uuid' => $takeoff->project->uuid,
                'name' => $takeoff->project->name,
                'project_number' => $takeoff->project->project_number,
            ] : null,
            'estimate' => $pricing ? [
                'cost' => $pricing['cost'],
                'selling' => $pricing['selling'],
                'profit' => $pricing['profit'],
                'margin' => $pricing['margin'],
            ] : null,
            'documents' => $takeoff->documents->map(fn (TakeoffDocument $document): array => self::document($document))->values()->all(),
            'openings' => $takeoff->openings->map(function (TakeoffOpening $opening) use ($showPricing, $pricing, $flagsByOpening): array {
                return self::opening($opening, $showPricing, $pricing['openings'][$opening->id] ?? null, $flagsByOpening[$opening->id] ?? []);
            })->values()->all(),
            'groups' => $takeoff->groups->map(function (TakeoffGroup $group) use ($showPricing, $pricing): array {
                return self::group($group, $showPricing, $pricing['groups'][$group->id] ?? null);
            })->values()->all(),
            'supplier_quotes' => $takeoff->supplierQuotes->map(fn (TakeoffSupplierQuote $quote): array => self::quote($quote, $showPricing))->values()->all(),
            'flags' => $flags,
            'previous' => $previous,
            'audits' => $takeoff->audits->take(50)->map(fn ($audit): array => [
                'id' => $audit->id,
                'action' => $audit->action,
                'summary' => $audit->summary,
                'user' => $audit->user?->name,
                'created_at' => $audit->created_at?->toIso8601String(),
            ])->values()->all(),
            'show_pricing' => $showPricing,
        ];
    }

    private static function document(TakeoffDocument $document): array
    {
        return [
            'id' => $document->id,
            'uuid' => $document->uuid,
            'original_filename' => $document->original_filename,
            'document_type' => $document->document_type,
            'revision_label' => $document->revision_label,
            'sheet_number' => $document->sheet_number,
            'sheet_title' => $document->sheet_title,
            'page_count' => $document->page_count,
            'size' => $document->size,
            'uploaded_at' => $document->created_at?->toIso8601String(),
            'uploader' => $document->relationLoaded('uploader') ? $document->uploader?->name : null,
            'download_url' => route('admin.takeoffs.documents.show', ['takeoff' => $document->takeoff_id, 'document' => $document]),
        ];
    }

    /**
     * @param  list<array{code: string, message: string, opening_id: ?int}>  $flags
     * @param  array{cost: string, selling: string, profit: string, margin: ?string}|null  $estimate
     */
    private static function opening(TakeoffOpening $opening, bool $showPricing, ?array $estimate, array $flags): array
    {
        return [
            'id' => $opening->id,
            'uuid' => $opening->uuid,
            'tag' => $opening->tag,
            'callout' => $opening->callout,
            'label' => $opening->label(),
            'is_bulk' => $opening->is_bulk,
            'opening_type' => $opening->opening_type,
            'door_configuration_id' => $opening->door_configuration_id,
            'door_type' => $opening->doorConfiguration?->name,
            'location' => $opening->location,
            'quantity' => (string) $opening->quantity,
            'product_category' => $opening->product_category,
            'width' => $opening->width !== null ? (string) $opening->width : null,
            'height' => $opening->height !== null ? (string) $opening->height : null,
            'depth' => $opening->depth !== null ? (string) $opening->depth : null,
            'dimension_unit' => $opening->dimension_unit,
            'frame_type' => $opening->frame_type,
            'handing' => $opening->handing,
            'hardware_set' => $opening->hardware_set,
            'glazing' => $opening->glazing,
            'finish' => $opening->finish,
            'manufacturer' => $opening->manufacturer,
            'product_model' => $opening->product_model,
            'product_id' => $opening->product_id,
            'product_name' => $opening->product?->name,
            'scope' => $opening->scope,
            'notes' => $opening->notes,
            'exclusions' => $opening->exclusions,
            'assumptions' => $opening->assumptions,
            'disposition' => $opening->disposition,
            'disposition_reason' => $opening->disposition_reason,
            'waived_checks' => $opening->waived_checks ?? [],
            'acoustic_requirement' => $opening->acoustic_requirement,
            'rf_requirement' => $opening->rf_requirement,
            'fire_requirement' => $opening->fire_requirement,
            'ballistic_requirement' => $opening->ballistic_requirement,
            'other_requirements' => $opening->other_requirements,
            'verified_acoustic' => $opening->verified_acoustic,
            'verified_rf' => $opening->verified_rf,
            'verified_fire' => $opening->verified_fire,
            'verified_ballistic' => $opening->verified_ballistic,
            'verification_status' => $opening->verification_status,
            'verified_by' => $opening->verifier?->name,
            'verified_at' => $opening->verified_at?->toIso8601String(),
            'requirement_document_id' => $opening->requirement_document_id,
            'requirement_page' => $opening->requirement_page,
            'requirement_section' => $opening->requirement_section,
            'template_id' => $opening->template_id,
            'template_snapshot' => $opening->template_snapshot,
            'needs_review' => $opening->needs_review,
            'group_id' => $opening->group_id,
            'updated_at' => $opening->updated_at?->toIso8601String(),
            'markers' => $opening->markers->map(fn ($marker): array => [
                'id' => $marker->id,
                'document_id' => $marker->document_id,
                'page' => $marker->page,
                'x' => (string) $marker->x,
                'y' => (string) $marker->y,
                'label_x' => $marker->label_x !== null ? (string) $marker->label_x : null,
                'label_y' => $marker->label_y !== null ? (string) $marker->label_y : null,
            ])->values()->all(),
            'references' => $opening->references->map(fn ($reference): array => [
                'id' => $reference->id,
                'document_id' => $reference->document_id,
                'page' => $reference->page,
                'section' => $reference->section,
                'note' => $reference->note,
            ])->values()->all(),
            'costs' => $showPricing ? $opening->costs->map(fn (TakeoffCost $cost): array => self::cost($cost))->values()->all() : [],
            'estimate' => $showPricing ? $estimate : null,
            'flags' => $flags,
        ];
    }

    /**
     * @param  array{cost: string, selling: string, profit: string, margin: ?string, quantity: string}|null  $estimate
     */
    private static function group(TakeoffGroup $group, bool $showPricing, ?array $estimate): array
    {
        return [
            'id' => $group->id,
            'uuid' => $group->uuid,
            'name' => $group->name,
            'manual' => $group->manual,
            'mismatch' => $group->mismatch,
            'opening_ids' => $group->openings->pluck('id')->values()->all(),
            'costs' => $showPricing ? $group->costs->map(fn (TakeoffCost $cost): array => self::cost($cost))->values()->all() : [],
            'estimate' => $showPricing ? $estimate : null,
        ];
    }

    private static function cost(TakeoffCost $cost): array
    {
        return [
            'id' => $cost->id,
            'kind' => $cost->kind,
            'basis' => $cost->basis,
            'description' => $cost->description,
            'amount' => $cost->amount !== null ? (string) $cost->amount : null,
            'labor_hours' => $cost->labor_hours !== null ? (string) $cost->labor_hours : null,
            'hourly_rate' => $cost->hourly_rate !== null ? (string) $cost->hourly_rate : null,
            'from_template' => $cost->from_template,
        ];
    }

    private static function quote(TakeoffSupplierQuote $quote, bool $showPricing): array
    {
        $expired = $quote->expires_at ? $quote->expires_at->startOfDay()->lt(now()->startOfDay()) : false;

        return [
            'id' => $quote->id,
            'uuid' => $quote->uuid,
            'supplier_name' => $quote->supplier_name,
            'quote_number' => $quote->quote_number,
            'revision_label' => $quote->revision_label,
            'quote_date' => $quote->quote_date?->toDateString(),
            'expires_at' => $quote->expires_at?->toDateString(),
            'expired' => $expired,
            'opening_id' => $quote->opening_id,
            'group_id' => $quote->group_id,
            'supersedes_id' => $quote->supersedes_id,
            'included_scope' => $quote->included_scope,
            'exclusions' => $quote->exclusions,
            'pricing_notes' => $showPricing ? $quote->pricing_notes : null,
            'accepted_at' => $quote->accepted_at?->toIso8601String(),
            'has_attachment' => $showPricing && filled($quote->storage_path),
            'original_filename' => $showPricing ? $quote->original_filename : null,
        ];
    }

    public static function lineDescription(TakeoffOpening $opening): string
    {
        $size = self::size($opening);
        $scope = match ($opening->scope) {
            'supply' => 'Supply only',
            'installation' => 'Installation only',
            default => 'Supply and installation',
        };
        $parts = array_filter([
            $opening->label(),
            ucfirst($opening->opening_type),
            $opening->doorConfiguration?->name,
            $opening->product_category,
            $size,
            $scope,
            $opening->location ? 'Location: '.$opening->location : null,
            ($opening->manufacturer || $opening->product_model)
                ? 'Proposed: '.trim($opening->manufacturer.' '.$opening->product_model)
                : null,
        ]);

        return implode(' — ', $parts);
    }

    public static function size(TakeoffOpening $opening): ?string
    {
        if ($opening->width === null && $opening->height === null) {
            return null;
        }

        $parts = array_filter([
            $opening->width !== null ? (string) $opening->width : null,
            $opening->height !== null ? (string) $opening->height : null,
            $opening->depth !== null ? (string) $opening->depth.' deep' : null,
        ]);

        return implode(' x ', $parts).' '.$opening->dimension_unit;
    }
}
