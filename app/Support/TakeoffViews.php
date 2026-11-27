<?php

namespace App\Support;

use App\Models\TakeoffTemplateForm;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class TakeoffViews
{
    public static function ready(): bool
    {
        if (DB::getDriverName() !== 'mysql') {
            return false;
        }

        static $ready = null;

        return $ready ??= Schema::hasTable('takeoff_overview');
    }

    /**
     * @return list<array{id: int, name: string, project_number: ?string}>
     */
    public static function projects(): array
    {
        return DB::table('takeoff_project_options')
            ->orderBy('name')
            ->get(['id', 'name', 'project_number'])
            ->map(fn (object $project): array => [
                'id' => (int) $project->id,
                'name' => $project->name,
                'project_number' => $project->project_number,
            ])
            ->all();
    }

    /**
     * @return list<array{id: int, name: string, sku: ?string}>
     */
    public static function products(): array
    {
        return DB::table('takeoff_product_options')
            ->orderBy('name')
            ->limit(400)
            ->get(['id', 'name', 'sku'])
            ->map(fn (object $product): array => [
                'id' => (int) $product->id,
                'name' => $product->name,
                'sku' => $product->sku,
            ])
            ->all();
    }

    /**
     * @return list<array{id: int, number: ?string, title: ?string, status: string}>
     */
    public static function quotations(int $projectId): array
    {
        return DB::table('takeoff_quotation_options')
            ->where('project_id', $projectId)
            ->orderByDesc('id')
            ->get(['id', 'quotation_number', 'title', 'status'])
            ->map(fn (object $quotation): array => [
                'id' => (int) $quotation->id,
                'number' => $quotation->quotation_number,
                'title' => $quotation->title,
                'status' => $quotation->status,
            ])
            ->all();
    }

    /**
     * @return list<array{id: int, name: string}>
     */
    public static function doorTypes(): array
    {
        return DB::table('takeoff_door_type_options')
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (object $type): array => [
                'id' => (int) $type->id,
                'name' => $type->name,
            ])
            ->all();
    }

    /**
     * @return list<array{id: int, name: string, opening_type: string, product_category: ?string, frame_type: ?string, hardware_set: ?string, glazing: ?string, finish: ?string, manufacturer: ?string, product_model: ?string, default_costs: array<int, mixed>}>
     */
    public static function templates(): array
    {
        return TakeoffTemplateForm::query()
            ->orderBy('name')
            ->get()
            ->map(fn (TakeoffTemplateForm $template): array => [
                'id' => $template->id,
                'name' => $template->name,
                'opening_type' => $template->opening_type,
                'product_category' => $template->product_category,
                'frame_type' => $template->frame_type,
                'hardware_set' => $template->hardware_set,
                'glazing' => $template->glazing,
                'finish' => $template->finish,
                'manufacturer' => $template->manufacturer,
                'product_model' => $template->product_model,
                'default_costs' => $template->default_costs ?? [],
            ])
            ->values()
            ->all();
    }
}
