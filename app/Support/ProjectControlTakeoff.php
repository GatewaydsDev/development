<?php

namespace App\Support;

use App\Models\Project;
use App\Models\ProjectControl;
use App\Models\ProjectControlOpening;
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
