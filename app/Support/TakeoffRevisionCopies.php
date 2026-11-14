<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class TakeoffRevisionCopies
{
    public static function remove(): void
    {
        if (! Schema::hasTable('takeoffs') || ! Schema::hasColumn('takeoffs', 'source_takeoff_id')) {
            return;
        }

        $copies = DB::table('takeoffs')
            ->where(function ($query): void {
                $query->whereNotNull('source_takeoff_id')
                    ->orWhere(function ($query): void {
                        $query->whereNotNull('root_takeoff_id')
                            ->whereColumn('root_takeoff_id', '!=', 'id')
                            ->where('revision_number', '>', 1);
                    });
            })
            ->get(['id', 'root_takeoff_id', 'source_takeoff_id']);

        if ($copies->isEmpty()) {
            self::clearSelfRoots();

            return;
        }

        $copyIds = $copies->pluck('id')->map(fn (mixed $id): int => (int) $id)->all();
        $copySet = array_fill_keys($copyIds, true);
        $keeperFor = [];

        foreach ($copies as $copy) {
            $id = (int) $copy->id;
            $root = (int) ($copy->root_takeoff_id ?? 0);
            $source = (int) ($copy->source_takeoff_id ?? 0);
            $keeper = $root > 0 && $root !== $id ? $root : $source;

            if ($keeper > 0) {
                $keeperFor[$id] = $keeper;
            }
        }

        foreach ($keeperFor as $copyId => $keeper) {
            $guard = 0;

            while (isset($copySet[$keeper]) && isset($keeperFor[$keeper]) && $guard < 20) {
                $keeper = $keeperFor[$keeper];
                $guard++;
            }

            $keeperFor[$copyId] = $keeper;
        }

        if (Schema::hasTable('takeoff_quotation_lines')) {
            foreach ($keeperFor as $copyId => $keeper) {
                if ($keeper === $copyId || isset($copySet[$keeper])) {
                    continue;
                }

                DB::table('takeoff_quotation_lines')->where('takeoff_id', $copyId)->update([
                    'takeoff_id' => $keeper,
                ]);
            }
        }

        $paths = self::storedPaths($copyIds);

        DB::table('takeoffs')->whereIn('id', $copyIds)->update([
            'source_takeoff_id' => null,
            'root_takeoff_id' => null,
        ]);
        DB::table('takeoffs')->whereIn('id', $copyIds)->delete();
        self::clearSelfRoots();
        self::deleteFiles($paths);
    }

    private static function clearSelfRoots(): void
    {
        DB::table('takeoffs')->whereColumn('root_takeoff_id', 'id')->update([
            'root_takeoff_id' => null,
        ]);
    }

    /**
     * @param  list<int>  $takeoffIds
     * @return list<string>
     */
    private static function storedPaths(array $takeoffIds): array
    {
        $paths = [];

        foreach (['takeoff_documents', 'takeoff_supplier_quotes'] as $table) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            $paths = array_merge(
                $paths,
                DB::table($table)
                    ->whereIn('takeoff_id', $takeoffIds)
                    ->whereNotNull('storage_path')
                    ->pluck('storage_path')
                    ->all(),
            );
        }

        return array_values(array_filter($paths, fn (mixed $path): bool => is_string($path) && $path !== ''));
    }

    /**
     * @param  list<string>  $paths
     */
    private static function deleteFiles(array $paths): void
    {
        $disk = (string) config('takeoffs.disk', 'local');

        foreach ($paths as $path) {
            if (Storage::disk($disk)->exists($path)) {
                Storage::disk($disk)->delete($path);
            }
        }
    }
}
