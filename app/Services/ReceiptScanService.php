<?php

namespace App\Services;

use App\Exceptions\AiDraftException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;

class ReceiptScanService
{
    /**
     * Reads a receipt picture and returns only the values it could find.
     *
     * @return array{spent_on?: string, amount?: string, tax_amount?: string, address?: string, payee?: string}
     */
    public function scan(UploadedFile $image): array
    {
        $baseUrl = rtrim((string) config('services.ai.base_url'), '/');
        $model = trim((string) config('services.ai.model'));

        if ($baseUrl === '' || $model === '') {
            throw new AiDraftException('Set AI_BASE_URL and AI_MODEL to read receipts automatically.');
        }

        $key = trim((string) config('services.ai.key'));
        $request = Http::connectTimeout(8)->timeout(60)->acceptJson();

        if ($key !== '') {
            $request = $request->withToken($key);
        }

        $dataUrl = 'data:'.($image->getMimeType() ?: 'image/jpeg').';base64,'.base64_encode((string) file_get_contents($image->getRealPath()));

        try {
            $response = $request->post($baseUrl.'/chat/completions', [
                'model' => $model,
                'temperature' => 0,
                'stream' => false,
                'messages' => [
                    ['role' => 'system', 'content' => implode(' ', [
                        'You read photos of store receipts.',
                        'Reply with one JSON object and nothing else, using these keys:',
                        'date (YYYY-MM-DD), total (final amount paid, number only), tax (total sales tax, number only),',
                        'address (street, city, state, zip of the store), store (store name).',
                        'Use null for anything you cannot read. Never guess.',
                    ])],
                    ['role' => 'user', 'content' => [
                        ['type' => 'text', 'text' => 'Read this receipt.'],
                        ['type' => 'image_url', 'image_url' => ['url' => $dataUrl]],
                    ]],
                ],
            ]);
        } catch (ConnectionException) {
            throw new AiDraftException('The receipt reader could not be reached.', 502);
        }

        if ($response->failed()) {
            throw new AiDraftException('The receipt reader could not read this picture.', 502);
        }

        return $this->parse((string) $response->json('choices.0.message.content'));
    }

    /**
     * @return array{spent_on?: string, amount?: string, tax_amount?: string, address?: string, payee?: string}
     */
    public function parse(string $text): array
    {
        if (! preg_match('/\{.*\}/s', $text, $match)) {
            return [];
        }

        $data = json_decode($match[0], true);

        if (! is_array($data)) {
            return [];
        }

        $found = [];
        $date = is_string($data['date'] ?? null) ? trim($data['date']) : '';

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) && checkdate((int) substr($date, 5, 2), (int) substr($date, 8, 2), (int) substr($date, 0, 4))) {
            $found['spent_on'] = $date;
        }

        foreach (['total' => 'amount', 'tax' => 'tax_amount'] as $from => $to) {
            $value = $data[$from] ?? null;
            $number = is_string($value) ? preg_replace('/[^0-9.]/', '', $value) : $value;

            if (is_numeric($number) && (float) $number > 0 && (float) $number < 100000000) {
                $found[$to] = number_format((float) $number, 2, '.', '');
            }
        }

        foreach (['address' => 'address', 'store' => 'payee'] as $from => $to) {
            $value = is_string($data[$from] ?? null) ? trim(preg_replace('/\s+/', ' ', $data[$from])) : '';

            if ($value !== '') {
                $found[$to] = mb_substr($value, 0, $to === 'payee' ? 160 : 255);
            }
        }

        return $found;
    }
}
