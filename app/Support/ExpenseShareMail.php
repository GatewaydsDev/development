<?php

namespace App\Support;

use App\Exceptions\MicrosoftGraphException;
use App\Models\Expense;
use App\Models\ExpensePayment;
use App\Models\User;
use App\Services\MicrosoftGraphMailService;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class ExpenseShareMail
{
    /**
     * @param  list<int>  $expenseIds
     * @param  list<int>  $receiptIds
     */
    public function send(User $sender, array $expenseIds, array $receiptIds, string $recipient, ?string $message, ?string $group): void
    {
        $mailbox = strtolower(trim((string) $sender->microsoft_mailbox));

        if ($mailbox === '' || filter_var($mailbox, FILTER_VALIDATE_EMAIL) === false) {
            throw ValidationException::withMessages([
                'email' => 'Assign a Microsoft 365 mailbox to your account before emailing expenses.',
            ]);
        }

        $expenses = Expense::query()
            ->with('payments')
            ->whereIn('id', $expenseIds)
            ->orderByDesc('spent_on')
            ->orderByDesc('id')
            ->get();

        if ($expenses->isEmpty()) {
            throw ValidationException::withMessages([
                'expenses' => 'Choose at least one expense to share.',
            ]);
        }

        $wantedReceipts = array_fill_keys($receiptIds, true);
        $attachments = [];
        $bytes = 0;
        $missing = [];

        foreach ($expenses as $expense) {
            if (! isset($wantedReceipts[$expense->id])) {
                continue;
            }

            $path = $expense->receipt_path;

            if (! is_string($path) || $path === '' || ! Storage::disk('local')->exists($path)) {
                $missing[] = $expense->description;

                continue;
            }

            $contents = Storage::disk('local')->get($path);

            if (! is_string($contents) || $contents === '') {
                $missing[] = $expense->description;

                continue;
            }

            $bytes += strlen($contents);

            if ($bytes > 3_000_000) {
                throw ValidationException::withMessages([
                    'receipts' => 'Those documents are too large to email together. Uncheck some receipts and try again.',
                ]);
            }

            $attachments[] = [
                'name' => $expense->id.'-'.$this->filename($expense),
                'contentType' => $this->contentType($path),
                'bytes' => $contents,
            ];
        }

        $groupName = trim((string) $group);
        $subject = mb_substr(
            $groupName !== '' ? 'Expenses: '.$groupName : 'Expense details',
            0,
            255,
        );

        try {
            app(MicrosoftGraphMailService::class)->actingAs($sender)->sendComposed(
                $mailbox,
                [$recipient],
                $subject,
                $this->html($sender, $expenses->all(), $groupName, $message, $attachments, $missing),
                'HTML',
                [],
                [],
                'normal',
                $attachments,
            );
        } catch (MicrosoftGraphException $exception) {
            throw ValidationException::withMessages([
                'email' => $exception->getMessage(),
            ]);
        }
    }

    /**
     * @param  list<Expense>  $expenses
     * @param  list<array{name: string, contentType: string, bytes: string}>  $attachments
     * @param  list<string>  $missing
     */
    private function html(User $sender, array $expenses, string $group, ?string $message, array $attachments, array $missing): string
    {
        $intro = e($sender->name).' shared expense details';

        if ($group !== '') {
            $intro .= ' for '.e($group);
        }

        $blocks = ['<p>'.$intro.'.</p>'];
        $note = trim((string) $message);

        if ($note !== '') {
            $blocks[] = '<p>'.nl2br(e($note), false).'</p>';
        }

        foreach ($expenses as $expense) {
            $rows = [
                ['Date', $expense->spent_on?->format('m/d/Y') ?? ''],
                ['Person', (string) $expense->person_name],
                ['Paid to', $expense->payee],
                ['What it was for', $expense->description],
                ['Category', Expense::CATEGORIES[$expense->category] ?? $expense->category],
                ['Group', (string) ($expense->group_name ?: '')],
                ['Total', '$'.number_format((float) $expense->amount, 2)],
                ['Notes', (string) ($expense->notes ?: '')],
            ];
            $body = '';

            foreach ($rows as [$label, $value]) {
                if (trim($value) === '') {
                    continue;
                }

                $body .= '<tr><th align="left" style="padding:4px 12px 4px 0;">'.e($label).'</th><td>'.e($value).'</td></tr>';
            }

            if ($expense->payments->isNotEmpty()) {
                $payments = $expense->payments->map(function (ExpensePayment $payment): string {
                    $when = $payment->status === 'paid'
                        ? ($payment->paid_on?->format('m/d/Y') ?? $payment->due_on?->format('m/d/Y') ?? '')
                        : ($payment->due_on?->format('m/d/Y') ?? '');

                    return e(trim(implode(' · ', array_filter([
                        $when,
                        '$'.number_format((float) $payment->amount, 2),
                        ExpensePayment::STATUSES[$payment->status] ?? $payment->status,
                        ExpensePayment::METHODS[$payment->method] ?? $payment->method,
                    ]))));
                })->implode('<br>');

                $body .= '<tr><th align="left" style="padding:4px 12px 4px 0;vertical-align:top;">Payments</th><td>'.$payments.'</td></tr>';
            }

            $blocks[] = '<h2 style="font-size:16px;margin:16px 0 8px;">'.e($expense->description).'</h2><table>'.$body.'</table>';
        }

        if ($attachments !== []) {
            $names = array_map(
                fn (array $file): string => e($file['name']),
                $attachments,
            );
            $blocks[] = '<p>Attached documents:<br>'.implode('<br>', $names).'</p>';
        } else {
            $blocks[] = '<p>No documents were attached.</p>';
        }

        if ($missing !== []) {
            $blocks[] = '<p>A receipt could not be attached for: '.e(implode(', ', $missing)).'.</p>';
        }

        return implode('', $blocks);
    }

    private function filename(Expense $expense): string
    {
        $name = basename(str_replace('\\', '/', (string) ($expense->receipt_name ?: 'receipt')));
        $name = preg_replace('/[^A-Za-z0-9._-]+/', '-', $name) ?: 'receipt';

        $extension = strtolower(pathinfo((string) $expense->receipt_path, PATHINFO_EXTENSION));

        if ($extension !== '' && ! str_ends_with(strtolower($name), '.'.$extension)) {
            $name .= '.'.$extension;
        }

        return $name;
    }

    private function contentType(string $path): string
    {
        return match (strtolower(pathinfo($path, PATHINFO_EXTENSION))) {
            'pdf' => 'application/pdf',
            'jpg', 'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            default => 'application/octet-stream',
        };
    }
}
