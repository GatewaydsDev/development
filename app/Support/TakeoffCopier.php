<?php

namespace App\Support;

use App\Models\Takeoff;
use App\Models\TakeoffCost;
use App\Models\TakeoffDocument;
use App\Models\TakeoffGroup;
use App\Models\TakeoffOpening;
use App\Models\TakeoffSupplierQuote;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class TakeoffCopier
{
    public static function copy(Takeoff $source, User $user): Takeoff
    {
        return DB::transaction(function () use ($source, $user): Takeoff {
            $source->load([
                'documents',
                'groups',
                'openings.markers',
                'openings.references',
                'openings.costs',
                'groups.costs',
                'supplierQuotes',
            ]);

            $rootId = $source->rootId();
            $nextRevision = (int) Takeoff::query()
                ->where(function ($query) use ($rootId): void {
                    $query->where('root_takeoff_id', $rootId)->orWhere('id', $rootId);
                })
                ->max('revision_number') + 1;

            $copy = $source->replicate(['uuid', 'approved_by', 'approved_at']);
            $copy->forceFill([
                'uuid' => (string) Str::uuid(),
                'root_takeoff_id' => $rootId,
                'source_takeoff_id' => $source->id,
                'revision_number' => $nextRevision,
                'status' => 'draft',
                'approved_by' => null,
                'approved_at' => null,
                'created_by' => $user->id,
                'updated_by' => $user->id,
            ])->save();

            $documentIds = [];

            foreach ($source->documents as $document) {
                $documentIds[$document->id] = self::copyDocument($document, $copy, $user)->id;
            }

            $groupIds = [];

            foreach ($source->groups as $group) {
                $replica = $group->replicate(['uuid']);
                $replica->forceFill([
                    'uuid' => (string) Str::uuid(),
                    'takeoff_id' => $copy->id,
                    'origin_group_id' => $group->origin_group_id ?: $group->id,
                ])->save();
                $groupIds[$group->id] = $replica->id;

                foreach ($group->costs as $cost) {
                    self::copyCost($cost, $copy->id, null, $replica->id);
                }
            }

            foreach ($source->openings as $opening) {
                $replica = $opening->replicate(['uuid']);
                $replica->forceFill([
                    'uuid' => (string) Str::uuid(),
                    'takeoff_id' => $copy->id,
                    'origin_opening_id' => $opening->origin_opening_id ?: $opening->id,
                    'group_id' => $opening->group_id ? ($groupIds[$opening->group_id] ?? null) : null,
                    'requirement_document_id' => $opening->requirement_document_id
                        ? ($documentIds[$opening->requirement_document_id] ?? null)
                        : null,
                ])->save();

                foreach ($opening->markers as $marker) {
                    $replica->markers()->create([
                        'document_id' => $documentIds[$marker->document_id] ?? $marker->document_id,
                        'page' => $marker->page,
                        'x' => $marker->x,
                        'y' => $marker->y,
                        'label_x' => $marker->label_x,
                        'label_y' => $marker->label_y,
                    ]);
                }

                foreach ($opening->references as $reference) {
                    $replica->references()->create([
                        'document_id' => $reference->document_id ? ($documentIds[$reference->document_id] ?? null) : null,
                        'page' => $reference->page,
                        'section' => $reference->section,
                        'note' => $reference->note,
                    ]);
                }

                foreach ($opening->costs as $cost) {
                    self::copyCost($cost, $copy->id, $replica->id, null);
                }
            }

            $quoteIds = [];

            foreach ($source->supplierQuotes as $quote) {
                $replica = self::copyQuote($quote, $copy, $user);
                $quoteIds[$quote->id] = $replica->id;
            }

            foreach ($source->supplierQuotes as $quote) {
                if ($quote->supersedes_id && isset($quoteIds[$quote->id], $quoteIds[$quote->supersedes_id])) {
                    TakeoffSupplierQuote::query()->whereKey($quoteIds[$quote->id])->update([
                        'supersedes_id' => $quoteIds[$quote->supersedes_id],
                    ]);
                }
            }

            if ($source->root_takeoff_id === null) {
                $source->forceFill(['root_takeoff_id' => $source->id])->save();
            }

            $copy->record($user, 'revision.created', 'Revision '.$copy->revision_number.' was created from revision '.$source->revision_number.'.');
            $source->record($user, 'revision.created', 'Revision '.$copy->revision_number.' was created from this takeoff.');

            return $copy->fresh();
        });
    }

    private static function copyDocument(TakeoffDocument $document, Takeoff $copy, User $user): TakeoffDocument
    {
        $disk = config('takeoffs.disk');
        $path = 'takeoffs/'.$copy->id.'/'.Str::uuid().'.pdf';

        if ($document->storage_path && Storage::disk($disk)->exists($document->storage_path)) {
            Storage::disk($disk)->copy($document->storage_path, $path);
        }

        $replica = $document->replicate(['uuid']);
        $replica->forceFill([
            'uuid' => (string) Str::uuid(),
            'takeoff_id' => $copy->id,
            'storage_path' => $path,
            'uploaded_by' => $user->id,
        ])->save();

        return $replica;
    }

    private static function copyCost(TakeoffCost $cost, int $takeoffId, ?int $openingId, ?int $groupId): void
    {
        $replica = $cost->replicate();
        $replica->forceFill([
            'takeoff_id' => $takeoffId,
            'opening_id' => $openingId,
            'group_id' => $groupId,
        ])->save();
    }

    private static function copyQuote(TakeoffSupplierQuote $quote, Takeoff $copy, User $user): TakeoffSupplierQuote
    {
        $path = null;

        if ($quote->storage_path && Storage::disk(config('takeoffs.disk'))->exists($quote->storage_path)) {
            $path = 'takeoffs/'.$copy->id.'/quotes/'.Str::uuid().'.pdf';
            Storage::disk(config('takeoffs.disk'))->copy($quote->storage_path, $path);
        }

        $replica = $quote->replicate(['uuid']);
        $replica->forceFill([
            'uuid' => (string) Str::uuid(),
            'takeoff_id' => $copy->id,
            'opening_id' => null,
            'group_id' => null,
            'supersedes_id' => null,
            'storage_path' => $path,
            'created_by' => $user->id,
        ])->save();

        $opening = $quote->opening_id
            ? TakeoffOpening::query()->where('takeoff_id', $copy->id)->where('origin_opening_id', TakeoffOpening::query()->find($quote->opening_id)?->origin_opening_id ?: $quote->opening_id)->first()
            : null;
        $group = $quote->group_id
            ? TakeoffGroup::query()->where('takeoff_id', $copy->id)->where('origin_group_id', TakeoffGroup::query()->find($quote->group_id)?->origin_group_id ?: $quote->group_id)->first()
            : null;

        $replica->forceFill([
            'opening_id' => $opening?->id,
            'group_id' => $group?->id,
        ])->save();

        return $replica;
    }
}
