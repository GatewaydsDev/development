<?php

namespace App\Services;

use App\Exceptions\AiDraftException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

class AiDraftService
{
    /**
     * @param  array<string, string>  $facts
     */
    public function draft(string $surface, string $currentText, array $facts, string $question = ''): string
    {
        $baseUrl = rtrim((string) config('services.ai.base_url'), '/');
        $model = trim((string) config('services.ai.model'));

        if ($baseUrl === '') {
            throw new AiDraftException('Set AI_BASE_URL to the address of your AI service before drafting.');
        }

        if ($model === '') {
            throw new AiDraftException('Set AI_MODEL to the model name on your AI service.');
        }

        $key = trim((string) config('services.ai.key'));
        $request = Http::connectTimeout(8)->timeout(20)->acceptJson();

        if ($key !== '') {
            $request = $request->withToken($key);
        }

        try {
            $response = $request->post($baseUrl.'/chat/completions', [
                'model' => $model,
                'temperature' => 0.4,
                'stream' => false,
                'messages' => [
                    ['role' => 'system', 'content' => $this->instructions($surface, $question)],
                    ['role' => 'user', 'content' => $this->prompt($surface, $currentText, $facts, $question)],
                ],
            ]);
        } catch (ConnectionException) {
            throw new AiDraftException('The AI service could not be reached.', 502);
        }

        if ($response->failed()) {
            throw new AiDraftException('The AI service rejected the draft request.', 502);
        }

        return $this->clean($surface, $this->messageText($response->json('choices.0.message.content')));
    }

    private function instructions(string $surface, string $question): string
    {
        if (trim($question) !== '') {
            return implode(' ', [
                'You answer questions for Gateway Door Systems staff.',
                'The company sells and installs commercial doors, frames, and hardware.',
                'Use only the facts provided. If a fact is missing, say you do not have it.',
                'Do not invent prices, dates, ratings, or specifications.',
                'Keep any {{token}} placeholder exactly as written.',
                'Reply with plain text only. Do not use HTML or Markdown.',
            ]);
        }

        $format = $surface === 'print_layout' || $surface === 'takeoff'
            ? 'Reply with plain text only. Do not use HTML or Markdown.'
            : 'Reply with a few short HTML paragraphs using only p, br, strong, and em tags. Do not use Markdown.';

        return implode(' ', [
            'You draft text for Gateway Door Systems, a commercial door, frame, and hardware contractor.',
            'Use only the facts provided. Do not invent prices, dates, ratings, or specifications.',
            'Keep any {{token}} placeholder exactly as written.',
            $format,
        ]);
    }

    /**
     * @param  array<string, string>  $facts
     */
    private function prompt(string $surface, string $currentText, array $facts, string $question): string
    {
        $question = trim($question);

        if ($question !== '') {
            $lines = ["Question:\n".$question, 'Answer the question using the facts below.'];
        } else {
            $task = match ($surface) {
                'bid' => 'Draft the bid page for this project.',
                'print_layout' => 'Draft the text for this print layout component.',
                'takeoff' => 'Summarize this takeoff from the openings and notes below. Do not invent sizes or prices.',
                default => 'Draft the quotation layout text for this quote.',
            };
            $lines = [$task];
        }

        foreach ($facts as $name => $value) {
            $lines[] = $name.': '.$value;
        }

        $current = trim($currentText);

        if ($current !== '') {
            $lines[] = "Current text:\n".$current;
        }

        return implode("\n", $lines);
    }

    private function messageText(mixed $content): string
    {
        if (is_string($content)) {
            return $content;
        }

        if (! is_array($content)) {
            return '';
        }

        $text = '';

        foreach ($content as $part) {
            if (is_string($part)) {
                $text .= $part;
            } elseif (is_array($part)) {
                $text .= (string) ($part['text'] ?? '');
            }
        }

        return $text;
    }

    private function clean(string $surface, string $text): string
    {
        $text = trim($text);

        if ($text === '') {
            throw new AiDraftException('The AI service returned an empty draft.');
        }

        if ($surface === 'print_layout' || $surface === 'takeoff') {
            return trim(html_entity_decode(strip_tags($text)));
        }

        $text = strip_tags($text, '<p><br><strong><em>');

        if (! str_contains($text, '<p')) {
            $text = '<p>'.htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8').'</p>';
        }

        return $text;
    }
}
