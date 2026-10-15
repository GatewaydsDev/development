<?php

namespace App\Support;

use App\Models\Project;
use App\Models\Takeoff;

class TakeoffNamer
{
    /**
     * @param  array{sheet_number?: ?string, sheet_title?: ?string, openings?: list<array<string, mixed>>}  $scope
     */
    public static function title(Project $project, array $scope = [], ?int $ignoreId = null): string
    {
        $sheet = trim(implode(' ', array_filter([
            $scope['sheet_number'] ?? null,
            $scope['sheet_title'] ?? null,
        ])));
        $summary = self::countPhrase($scope['openings'] ?? []);
        $identity = self::identity($project);

        $title = match (true) {
            $sheet !== '' && $summary !== '' => $identity.' — '.$sheet.' ('.$summary.')',
            $sheet !== '' => $identity.' — '.$sheet,
            $summary !== '' => $identity.' — '.$summary,
            default => self::generic($project),
        };

        $title = trim((string) preg_replace('/\s+/', ' ', $title));
        $base = mb_substr($title, 0, 240);
        $candidate = $base;
        $suffix = 2;

        while (self::taken($project, $candidate, $ignoreId)) {
            $candidate = $base.' ('.$suffix.')';
            $suffix++;

            if ($suffix > 50) {
                break;
            }
        }

        return $candidate;
    }

    public static function generic(Project $project): string
    {
        return self::identity($project).' — Takeoff';
    }

    public static function shouldReplace(Project $project, string $title): bool
    {
        $generic = self::generic($project);

        return $title === $generic || preg_match('/^'.preg_quote($generic, '/').' \(\d+\)$/', $title) === 1;
    }

    /**
     * @param  array{sheet_number?: ?string, sheet_title?: ?string, openings?: list<array<string, mixed>>}  $scope
     */
    public static function apply(Takeoff $takeoff, array $scope): bool
    {
        $takeoff->loadMissing('project');
        $project = $takeoff->project;

        if (! $project || ! self::shouldReplace($project, $takeoff->title)) {
            return false;
        }

        $next = self::title($project, $scope, $takeoff->id);

        if ($next === $takeoff->title) {
            return false;
        }

        $takeoff->forceFill(['title' => $next])->save();

        return true;
    }

    /**
     * @param  list<array<string, mixed>>  $openings
     */
    public static function countPhrase(array $openings): string
    {
        $doors = 0;
        $windows = 0;

        foreach ($openings as $opening) {
            $count = (int) round((float) ($opening['quantity'] ?? 1));
            $count = max(1, $count);

            if (($opening['opening_type'] ?? 'door') === 'window') {
                $windows += $count;
            } else {
                $doors += $count;
            }
        }

        $parts = [];

        if ($doors > 0) {
            $parts[] = $doors.' '.($doors === 1 ? 'door' : 'doors');
        }

        if ($windows > 0) {
            $parts[] = $windows.' '.($windows === 1 ? 'window' : 'windows');
        }

        return implode(', ', $parts);
    }

    private static function identity(Project $project): string
    {
        $parts = array_values(array_filter([
            trim((string) $project->project_number),
            trim((string) $project->name),
        ], fn (string $part): bool => $part !== ''));

        return $parts === [] ? 'Takeoff' : implode(' ', $parts);
    }

    private static function taken(Project $project, string $title, ?int $ignoreId): bool
    {
        return Takeoff::query()
            ->where('project_id', $project->id)
            ->when($ignoreId, fn ($query) => $query->whereKeyNot($ignoreId))
            ->where('title', $title)
            ->exists();
    }
}
