<?php

namespace App\Http\Controllers\Admin;

use App\Exceptions\AiDraftException;
use App\Http\Controllers\Controller;
use App\Services\AiDraftService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AiDraftController extends Controller
{
    public function store(Request $request, AiDraftService $drafts): JsonResponse
    {
        $validated = $request->validate([
            'surface' => ['required', 'string', Rule::in(['quotation', 'bid', 'print_layout'])],
            'question' => ['nullable', 'string', 'max:2000'],
            'current_text' => ['nullable', 'string', 'max:8000'],
            'facts' => ['nullable', 'array', 'max:30'],
            'facts.*' => ['nullable', 'string', 'max:500'],
        ]);

        $surface = $validated['surface'];
        $user = $request->user();
        $allowed = match ($surface) {
            'quotation' => $user?->can('create-quotations') || $user?->can('update-quotations'),
            'bid' => $user?->can('create-bids') || $user?->can('update-bids'),
            'print_layout' => (bool) $user?->isSuperAdmin(),
            default => false,
        };
        abort_unless($allowed, 403);

        $facts = collect($validated['facts'] ?? [])
            ->mapWithKeys(function (mixed $value, mixed $key): array {
                $name = trim(strip_tags((string) $key));
                $text = trim(strip_tags((string) $value));

                return $name !== '' && $text !== '' ? [mb_substr($name, 0, 40) => mb_substr($text, 0, 500)] : [];
            })
            ->all();

        $question = mb_substr(trim(strip_tags((string) ($validated['question'] ?? ''))), 0, 2000);

        try {
            $text = $drafts->draft($surface, (string) ($validated['current_text'] ?? ''), $facts, $question);
        } catch (AiDraftException $exception) {
            return response()->json(['message' => $exception->getMessage()], $exception->status);
        }

        return response()->json(['text' => $text]);
    }
}
