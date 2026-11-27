<?php

namespace App\Support;

use App\Models\DoorConfiguration;
use App\Models\Product;
use App\Models\Project;
use App\Models\Takeoff;
use App\Models\TakeoffAudit;
use App\Models\TakeoffCost;
use App\Models\TakeoffDocument;
use App\Models\TakeoffGroup;
use App\Models\TakeoffMarker;
use App\Models\TakeoffMarkup;
use App\Models\TakeoffOpening;
use App\Models\TakeoffReference;
use App\Models\TakeoffOverview;
use App\Models\TakeoffSection;
use App\Models\TakeoffSupplierQuote;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

class TakeoffOverviewHydrator
{
    public function apply(Takeoff $takeoff, TakeoffOverview $overview): void
    {
        $takeoff->setRelation('project', $this->model(Project::class, [
            'id' => $overview->project_id,
            'uuid' => $overview->project_uuid,
            'name' => $overview->project_name,
            'project_number' => $overview->project_number,
        ]));
        $takeoff->setRelation('documents', $this->documents($overview->documents ?? []));

        $groups = $this->groups($overview->groups ?? []);
        $openings = $this->openings($overview->openings ?? [], $groups);

        foreach ($groups as $group) {
            $group->setRelation('openings', $openings->filter(
                fn (TakeoffOpening $opening): bool => (int) $opening->group_id === (int) $group->id,
            )->values());
        }

        $takeoff->setRelation('openings', $openings->values());
        $takeoff->setRelation('groups', $groups->values());
        $takeoff->setRelation('markups', $this->rows(TakeoffMarkup::class, $overview->markups ?? []));
        $takeoff->setRelation('sections', $this->rows(TakeoffSection::class, $overview->sections ?? []));
        $takeoff->setRelation('supplierQuotes', $this->rows(TakeoffSupplierQuote::class, $overview->supplier_quotes ?? []));
        $takeoff->setRelation('audits', $this->audits($overview->audits ?? []));
        $takeoff->setRelation('source', $this->source(is_array($overview->source) ? $overview->source : null));
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    private function documents(array $rows): Collection
    {
        return new Collection(array_map(function (array $row): TakeoffDocument {
            $document = $this->model(TakeoffDocument::class, $row, ['uploader_name']);
            $document->setRelation('uploader', $this->namedUser($row['uploaded_by'] ?? null, $row['uploader_name'] ?? null));

            return $document;
        }, $rows));
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    private function groups(array $rows): Collection
    {
        return new Collection(array_map(function (array $row): TakeoffGroup {
            $group = $this->model(TakeoffGroup::class, $row, ['opening_ids', 'costs']);
            $group->setRelation('costs', $this->costs($row['costs'] ?? []));

            return $group;
        }, $rows));
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    private function openings(array $rows, Collection $groups): Collection
    {
        return new Collection(array_map(function (array $row) use ($groups): TakeoffOpening {
            $opening = $this->model(TakeoffOpening::class, $row, [
                'door_type_name',
                'product_name',
                'product_sku',
                'verifier_name',
                'costs',
                'markers',
                'references',
            ]);
            $opening->setRelation('product', $this->product($row));
            $opening->setRelation('doorConfiguration', filled($row['door_configuration_id'] ?? null)
                ? $this->model(DoorConfiguration::class, [
                    'id' => $row['door_configuration_id'],
                    'name' => $row['door_type_name'] ?? null,
                ])
                : null);
            $opening->setRelation('verifier', $this->namedUser($row['verified_by'] ?? null, $row['verifier_name'] ?? null));
            $opening->setRelation('costs', $this->costs($row['costs'] ?? []));
            $opening->setRelation('markers', $this->rows(TakeoffMarker::class, $row['markers'] ?? []));
            $opening->setRelation('references', $this->rows(TakeoffReference::class, $row['references'] ?? []));
            $group = $groups->first(fn (TakeoffGroup $item): bool => (int) $item->id === (int) ($row['group_id'] ?? 0));
            $opening->setRelation('group', $group);

            return $opening;
        }, $rows));
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    private function costs(array $rows): Collection
    {
        return new Collection(array_map(function (array $row): TakeoffCost {
            $cost = $this->model(TakeoffCost::class, $row, ['product_name', 'product_sku']);
            $cost->setRelation('product', $this->product($row));

            return $cost;
        }, $rows));
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    private function audits(array $rows): Collection
    {
        return new Collection(array_map(function (array $row): TakeoffAudit {
            $audit = $this->model(TakeoffAudit::class, $row, ['user_name']);
            $audit->setRelation('user', $this->namedUser($row['user_id'] ?? null, $row['user_name'] ?? null));

            return $audit;
        }, $rows));
    }

    /**
     * @param  array<string, mixed>|null  $source
     */
    private function source(?array $source): ?Takeoff
    {
        if ($source === null) {
            return null;
        }

        $takeoff = $this->model(Takeoff::class, $source, ['documents', 'openings']);
        $takeoff->setRelation('documents', $this->documents($source['documents'] ?? []));
        $takeoff->setRelation('openings', new Collection(array_map(
            fn (array $row): TakeoffOpening => $this->model(TakeoffOpening::class, $row),
            $source['openings'] ?? [],
        )));

        return $takeoff;
    }

    /**
     * @param  array<string, mixed>  $row
     */
    private function product(array $row): ?Product
    {
        if (! filled($row['product_id'] ?? null)) {
            return null;
        }

        return $this->model(Product::class, [
            'id' => $row['product_id'],
            'name' => $row['product_name'] ?? null,
            'sku' => $row['product_sku'] ?? null,
        ]);
    }

    private function namedUser(mixed $id, mixed $name): ?User
    {
        if (! filled($id)) {
            return null;
        }

        return $this->model(User::class, [
            'id' => $id,
            'name' => $name,
        ]);
    }

    /**
     * @param  class-string<Model>  $class
     * @param  list<array<string, mixed>>  $rows
     */
    private function rows(string $class, array $rows): Collection
    {
        return new Collection(array_map(
            fn (array $row): Model => $this->model($class, $row),
            $rows,
        ));
    }

    /**
     * @param  class-string<Model>  $class
     * @param  array<string, mixed>  $attributes
     * @param  list<string>  $except
     */
    private function model(string $class, array $attributes, array $except = []): Model
    {
        foreach ($except as $key) {
            unset($attributes[$key]);
        }

        $model = new $class;
        $model->forceFill($attributes);
        $model->exists = true;
        $model->syncOriginal();

        return $model;
    }
}
