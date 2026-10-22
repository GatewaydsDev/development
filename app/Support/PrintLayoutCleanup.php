<?php

namespace App\Support;

use App\Models\Bid;
use App\Models\DocumentLayoutAssignment;
use App\Models\PrintLayout;
use App\Models\Quotation;
use Illuminate\Support\Facades\DB;

class PrintLayoutCleanup
{
    /**
     * Drop every older quotation layout and bid layout.
     * The newest layout of each type stays and becomes the print default.
     * Saved quotations and bids lose the copy of the layout they were printed with,
     * so the next print uses that default.
     *
     * @return array{kept: array<string, ?string>, removed: int, quotations: int, bids: int}
     */
    public static function clearOldQuoteAndBidLayouts(): array
    {
        return DB::transaction(function (): array {
            $quotations = Quotation::query()->update([
                'print_layout_id' => null,
                'print_layout_version' => null,
                'layout_elements' => null,
                'layout_header' => null,
            ]);
            $bids = Bid::query()->update([
                'print_layout_id' => null,
                'print_layout_version' => null,
                'layout_elements' => null,
            ]);

            $kept = [];
            $removed = 0;

            foreach (array_keys(PrintLayoutType::TYPES) as $type) {
                $keys = array_map(
                    fn (string $format): string => DocumentAppearance::key($type, $format),
                    array_keys(DocumentAppearance::FORMATS),
                );
                $candidates = PrintLayout::query()
                    ->with('assignments')
                    ->where(function ($query) use ($type, $keys): void {
                        $query->where('layout_type', $type)
                            ->orWhere(function ($query) use ($keys): void {
                                $query->whereNull('layout_type')
                                    ->whereHas('assignments', fn ($query) => $query->whereIn('document_key', $keys));
                            });
                    })
                    ->orderByDesc('updated_at')
                    ->orderByDesc('id')
                    ->get();

                $keep = $candidates->first();
                $kept[$type] = $keep?->name;

                foreach ($candidates->skip(1) as $layout) {
                    $onlyThisDocument = $layout->assignments->every(
                        fn ($assignment): bool => in_array($assignment->document_key, $keys, true),
                    );

                    if ($layout->layout_type === $type || $onlyThisDocument) {
                        $layout->assignments()->delete();
                        $layout->delete();
                        $removed++;

                        continue;
                    }

                    $layout->assignments()->whereIn('document_key', $keys)->delete();
                }

                if (! $keep) {
                    continue;
                }

                foreach ($keys as $key) {
                    $keep->assignments()->updateOrCreate(
                        ['document_key' => $key],
                        ['is_default' => true],
                    );
                    DocumentLayoutAssignment::query()
                        ->where('document_key', $key)
                        ->where('print_layout_id', '!=', $keep->id)
                        ->delete();
                }
            }

            return [
                'kept' => $kept,
                'removed' => $removed,
                'quotations' => $quotations,
                'bids' => $bids,
            ];
        });
    }
}
