<?php

namespace App\Support;

use App\Exceptions\MicrosoftGraphException;
use App\Models\Employee;
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
        $receiptNames = [];
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

            $name = $expense->id.'-'.$this->filename($expense);
            $receiptNames[$expense->id] = $name;
            $attachments[] = [
                'name' => $name,
                'contentType' => $this->contentType($path),
                'bytes' => $contents,
            ];
        }

        $groupName = trim((string) $group);
        $csvName = $this->quickBooksFilename($groupName);
        $csv = $this->quickBooksCsv($expenses->all(), $receiptNames);
        $bytes += strlen($csv);

        if ($bytes > 3_000_000) {
            throw ValidationException::withMessages([
                'receipts' => 'Those documents are too large to email together. Uncheck some receipts and try again.',
            ]);
        }

        array_unshift($attachments, [
            'name' => $csvName,
            'contentType' => 'text/csv',
            'bytes' => $csv,
        ]);
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
                $this->html($sender, $expenses->all(), $groupName, $message, $csvName, $receiptNames, $missing),
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
     * @param  array<int, string>  $receiptNames
     * @param  list<string>  $missing
     */
    private function html(User $sender, array $expenses, string $group, ?string $message, string $csvName, array $receiptNames, array $missing): string
    {
        $intro = e($sender->name).' shared expense details';

        if ($group !== '') {
            $intro .= ' for '.e($group);
        }

        $blocks = [$this->letterhead($sender), '<p style="font-family:Arial,sans-serif;font-size:14px;">'.$intro.'.</p>'];
        $note = trim((string) $message);

        if ($note !== '') {
            $blocks[] = '<p style="font-family:Arial,sans-serif;font-size:14px;">'.nl2br(e($note), false).'</p>';
        }

        $headers = [
            ['Date', '120'],
            ['Person', '150'],
            ['Paid to', '170'],
            ['What it was for', '280'],
            ['Category', '120'],
            ['Total', '110'],
            ['Paid', '110'],
            ['To be paid', '120'],
            ['Receipt', '220'],
        ];
        $head = '';

        foreach ($headers as [$header, $width]) {
            $head .= '<th align="left" width="'.$width.'" style="padding:16px 18px;border:1px solid #d7e3dc;font-size:16px;line-height:22px;font-family:Arial,sans-serif;">'.e($header).'</th>';
        }

        $body = '';

        foreach ($expenses as $index => $expense) {
            $paid = (float) $expense->payments->where('status', 'paid')->sum('amount');
            $scheduled = (float) $expense->payments->where('status', 'scheduled')->sum('amount');
            $background = $index % 2 === 0 ? '#ffffff' : '#f4faf7';
            $cells = [
                $expense->spent_on?->format('m/d/Y') ?? '',
                (string) $expense->person_name,
                $expense->payee,
                trim($expense->description.(filled($expense->notes) ? ' — '.$expense->notes : '')),
                Expense::CATEGORIES[$expense->category] ?? $expense->category,
                '$'.number_format((float) $expense->amount, 2),
                '$'.number_format($paid, 2),
                '$'.number_format($scheduled, 2),
                $receiptNames[$expense->id] ?? '',
            ];
            $body .= '<tr style="background:'.$background.';">';

            foreach ($cells as $cellIndex => $cell) {
                $body .= '<td width="'.$headers[$cellIndex][1].'" style="padding:16px 18px;border:1px solid #d7e3dc;font-size:16px;line-height:24px;font-family:Arial,sans-serif;">'.e($cell).'</td>';
            }

            $body .= '</tr>';
        }

        $blocks[] = '<table width="1400" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:1400px;font-family:Arial,sans-serif;font-size:16px;color:#111827;">'
            .'<thead><tr style="background:#0f3d32;color:#ffffff;">'.$head.'</tr></thead>'
            .'<tbody>'.$body.'</tbody></table>';
        $blocks[] = '<p style="font-family:Arial,sans-serif;font-size:14px;">'
            .e($csvName).' is attached for QuickBooks. Open it in Excel, or import it and map Date, Payee, Account, Amount, and Memo. '
            .'Receipt files use the names in the Receipt column so they can be attached to those transactions.'
            .'</p>';

        if ($missing !== []) {
            $blocks[] = '<p style="font-family:Arial,sans-serif;font-size:14px;">A receipt could not be attached for: '.e(implode(', ', $missing)).'.</p>';
        }

        return implode('', $blocks);
    }

    private function letterhead(User $sender): string
    {
        $company = DocumentLogo::company();
        $companyName = trim((string) ($company?->name ?: 'Gateway Door Systems'));
        $logoUrl = is_string($company?->logo_path) && $company->logo_path !== ''
            ? asset('storage/'.$company->logo_path)
            : asset('images/Gateway_Door_Systems_Logo.png');
        $employee = Employee::query()->where('user_id', $sender->id)->first();
        $name = trim((string) $sender->name);

        if ($name === '') {
            $name = trim((string) ($employee?->fullName() ?? ''));
        }

        $position = trim((string) ($sender->job_title ?: $employee?->job_title));
        $senderLines = '';

        if ($name !== '') {
            $senderLines .= '<div style="font-size:15px;line-height:20px;color:#111827;">'.e($name).'</div>';
        }

        if ($position !== '') {
            $senderLines .= '<div style="font-size:14px;line-height:20px;color:#4b5563;">'.e($position).'</div>';
        }

        return '<table cellpadding="0" cellspacing="0" style="margin:0 0 18px;font-family:Arial,sans-serif;">'
            .'<tr>'
            .'<td style="padding:0 14px 0 0;vertical-align:middle;">'
            .'<img src="'.e($logoUrl).'" alt="'.e($companyName).'" width="72" style="display:block;width:72px;max-width:72px;height:auto;border:0;">'
            .'</td>'
            .'<td style="vertical-align:middle;">'
            .'<div style="font-size:18px;line-height:24px;font-weight:bold;color:#0f3d32;">'.e($companyName).'</div>'
            .$senderLines
            .'</td>'
            .'</tr></table>';
    }

    /**
     * @param  list<Expense>  $expenses
     * @param  array<int, string>  $receiptNames
     */
    private function quickBooksCsv(array $expenses, array $receiptNames): string
    {
        $handle = fopen('php://temp', 'r+');

        if ($handle === false) {
            return '';
        }

        fwrite($handle, "\xEF\xBB\xBF");
        fputcsv($handle, [
            'Date',
            'Payee',
            'Account',
            'Amount',
            'Memo',
            'Payment Method',
            'Person',
            'Group',
            'Paid',
            'To Be Paid',
            'Receipt File',
        ]);

        foreach ($expenses as $expense) {
            $methods = $expense->payments
                ->map(fn (ExpensePayment $payment): string => ExpensePayment::METHODS[$payment->method] ?? $payment->method)
                ->filter()
                ->unique()
                ->implode('; ');
            $memo = trim($expense->description.(filled($expense->notes) ? ' - '.$expense->notes : ''));

            fputcsv($handle, [
                $expense->spent_on?->format('m/d/Y') ?? '',
                $expense->payee,
                Expense::CATEGORIES[$expense->category] ?? $expense->category,
                number_format((float) $expense->amount, 2, '.', ''),
                $memo,
                $methods,
                (string) $expense->person_name,
                (string) ($expense->group_name ?: ''),
                number_format((float) $expense->payments->where('status', 'paid')->sum('amount'), 2, '.', ''),
                number_format((float) $expense->payments->where('status', 'scheduled')->sum('amount'), 2, '.', ''),
                $receiptNames[$expense->id] ?? '',
            ]);
        }

        rewind($handle);
        $csv = stream_get_contents($handle);
        fclose($handle);

        return is_string($csv) ? $csv : '';
    }

    private function quickBooksFilename(string $group): string
    {
        $slug = trim((string) preg_replace('/[^A-Za-z0-9]+/', '-', $group), '-');

        return 'QuickBooks-'.($slug !== '' ? $slug : 'expenses').'.csv';
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
