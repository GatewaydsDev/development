<?php

namespace App\Support;

use App\Models\Project;
use App\Models\ProjectControl;
use App\Models\ProjectControlOpening;
use App\Models\ProjectControlTerm;
use App\Models\Takeoff;
use App\Models\TakeoffOpening;
use App\Models\User;

class ProjectControlTakeoff
{
    public function ensure(ProjectControl $control, ProjectControlOpening $opening, User $user): Takeoff
    {
        $project = $this->project($control, $user);
        $takeoff = Takeoff::query()
            ->where('project_id', $project->id)
            ->latest('id')
            ->first();

        if (! $takeoff instanceof Takeoff) {
            $takeoff = Takeoff::query()->create([
                'project_id' => $project->id,
                'title' => TakeoffNamer::title($project),
                'status' => 'draft',
                'pricing_method' => 'markup',
                'markup_rate' => '0.000000',
                'created_by' => $user->id,
                'updated_by' => $user->id,
            ]);
        }

        $linked = $opening->takeoffOpening;

        if (! $linked instanceof TakeoffOpening || $linked->takeoff_id !== $takeoff->id) {
            $linked = $takeoff->openings()->create($this->openingAttributes($opening, $takeoff));
            $opening->forceFill(['takeoff_opening_id' => $linked->id])->save();
        }

        return $takeoff;
    }

    public function sync(ProjectControl $control): void
    {
        if (! $control->project_id) {
            return;
        }

        $takeoff = Takeoff::query()
            ->where('project_id', $control->project_id)
            ->latest('id')
            ->first();

        if (! $takeoff instanceof Takeoff) {
            return;
        }

        $this->pull($control, $takeoff);
        $control->unsetRelation('openings');
        $this->push($control, $takeoff);
    }

    private function pull(ProjectControl $control, Takeoff $takeoff): void
    {
        $control->load('openings');
        $takeoff->load('openings');
        $linked = $control->openings->pluck('takeoff_opening_id')->filter()->map(fn ($id) => (int) $id)->all();
        $sort = (int) $control->openings->max('sort_order');

        foreach ($takeoff->openings as $takeoffOpening) {
            if (in_array($takeoffOpening->id, $linked, true)) {
                continue;
            }

            $match = $this->matchOpening($control, $takeoffOpening);

            if ($match instanceof ProjectControlOpening) {
                $match->forceFill(['takeoff_opening_id' => $takeoffOpening->id])->save();
                $linked[] = $takeoffOpening->id;

                continue;
            }

            $sort++;
            $created = $control->openings()->create($this->fromTakeoff($takeoffOpening, $sort));
            $control->openings->push($created);
            $linked[] = $takeoffOpening->id;
        }
    }

    private function push(ProjectControl $control, Takeoff $takeoff): void
    {
        $control->load('openings');
        $takeoffIds = $takeoff->openings()->pluck('id')->map(fn ($id) => (int) $id)->all();
        $sort = (int) $takeoff->openings()->max('sort_order');

        foreach ($control->openings as $opening) {
            if (in_array((int) $opening->takeoff_opening_id, $takeoffIds, true)) {
                continue;
            }

            $sort++;
            $attributes = $this->openingAttributes($opening, $takeoff);
            $attributes['sort_order'] = $sort;
            $created = $takeoff->openings()->create($attributes);
            $opening->forceFill(['takeoff_opening_id' => $created->id])->save();
            $takeoffIds[] = $created->id;
        }
    }

    private function matchOpening(ProjectControl $control, TakeoffOpening $takeoffOpening): ?ProjectControlOpening
    {
        $needles = array_values(array_filter([
            mb_strtolower(trim((string) $takeoffOpening->tag)),
            mb_strtolower(trim((string) $takeoffOpening->location)),
        ]));

        if ($needles === []) {
            return null;
        }

        return $control->openings->first(function (ProjectControlOpening $opening) use ($needles): bool {
            if (filled($opening->takeoff_opening_id)) {
                return false;
            }

            $mark = mb_strtolower(trim((string) $opening->mark));

            return $mark !== '' && in_array($mark, $needles, true);
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function fromTakeoff(TakeoffOpening $opening, int $sort): array
    {
        $category = $this->limited($opening->product_category, 120);
        $term = ProjectControlTerm::findOrCreate('opening_category', (string) $category);
        $description = $this->plain($opening->notes) ?? '';

        if (str_contains($description, "\n")) {
            $description = trim(strtok($description, "\n") ?: '');
        }

        if ($description === '') {
            $description = trim(implode(' ', array_filter([
                $category,
                $opening->tag,
                $opening->location,
            ])));
        }

        if ($description === '') {
            $description = ucfirst((string) $opening->opening_type).' opening';
        }

        $requirement = $this->limited(implode(' · ', array_filter([
            $this->plain($opening->fire_requirement),
            $this->plain($opening->acoustic_requirement),
            $this->plain($opening->ballistic_requirement),
            $this->plain($opening->rf_requirement),
            $this->plain($opening->other_requirements),
        ])), 255);

        return [
            'sort_order' => $sort,
            'takeoff_opening_id' => $opening->id,
            'category' => $category,
            'category_id' => $term?->id,
            'description' => $this->limited($description, 500) ?: 'Opening',
            'mark' => $this->limited($opening->tag ?: $opening->location, 120),
            'size' => $this->sizeLabel($opening->width, $opening->height),
            'quantity' => $opening->quantity ?? 1,
            'requirement' => $requirement,
            'hardware' => $this->plain($opening->hardware_set),
            'notes' => $this->plain($opening->notes),
        ];
    }

    private function sizeLabel(mixed $width, mixed $height): ?string
    {
        if ($width === null || $height === null || $width === '' || $height === '') {
            return null;
        }

        $format = function (mixed $value): string {
            $number = rtrim(rtrim(number_format((float) $value, 3, '.', ''), '0'), '.');

            return $number === '' ? '0' : $number;
        };

        return $format($width).' x '.$format($height);
    }

    private function limited(?string $value, int $limit): ?string
    {
        $text = trim((string) $value);

        if ($text === '') {
            return null;
        }

        return mb_substr($text, 0, $limit);
    }

    private function project(ProjectControl $control, User $user): Project
    {
        $project = $control->project;

        if ($project instanceof Project) {
            return $project;
        }

        $project = Project::query()->create([
            'name' => $control->name,
            'site_address_line_1' => $control->location === null ? null : mb_substr($control->location, 0, 255),
            'budget_amount' => $control->current_value,
            'created_by' => $user->id,
            'public_notes' => $this->plain($control->scope_summary),
            'internal_notes' => $this->plain($control->status_note),
        ]);

        $control->forceFill(['project_id' => $project->id])->save();

        return $project;
    }

    /**
     * @return array<string, mixed>
     */
    private function openingAttributes(ProjectControlOpening $opening, Takeoff $takeoff): array
    {
        $category = strtolower((string) $opening->category);
        [$width, $height] = $this->size((string) $opening->size);

        return [
            'tag' => $opening->mark ?: null,
            'opening_type' => str_contains($category, 'window') ? 'window' : 'door',
            'location' => $opening->mark,
            'quantity' => $opening->quantity ?? 1,
            'product_category' => $opening->category,
            'width' => $width,
            'height' => $height,
            'hardware_set' => ($hardware = $this->plain($opening->hardware)) === null ? null : mb_substr($hardware, 0, 255),
            'notes' => $this->plain(trim(implode("\n", array_filter([
                $opening->description,
                $opening->requirement,
                $opening->notes,
                $opening->additional_needed,
            ])))),
            'sort_order' => (int) $takeoff->openings()->count() + 1,
        ];
    }

    /**
     * @return array{0: ?string, 1: ?string}
     */
    private function size(string $size): array
    {
        if (preg_match('/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/', $size, $matches) !== 1) {
            return [null, null];
        }

        return [$matches[1], $matches[2]];
    }

    private function plain(?string $value): ?string
    {
        $text = trim(html_entity_decode(strip_tags((string) $value)));

        return $text === '' ? null : $text;
    }
}
