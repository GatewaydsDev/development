<?php

namespace App\Support;

use App\Models\Expense;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class ExpenseReceiptFile
{
    public function store(Expense $expense, UploadedFile $file): void
    {
        $name = $this->downloadName($file->getClientOriginalName(), 'pdf');

        if ($this->isImage($file)) {
            $this->storeImage($expense, (string) file_get_contents($file->getRealPath()), $name);

            return;
        }

        $this->delete($expense);
        $path = $file->storeAs('expenses/'.$expense->id, 'receipt.pdf', 'local');

        $expense->forceFill([
            'receipt_path' => $path,
            'receipt_name' => $name,
        ])->save();
    }

    public function normalize(Expense $expense): void
    {
        $path = $expense->receipt_path;

        if (! is_string($path) || $path === '' || ! Storage::disk('local')->exists($path)) {
            return;
        }

        if (! $this->pathIsImage($path, $expense->receipt_name)) {
            return;
        }

        $bytes = Storage::disk('local')->get($path);

        if (! is_string($bytes) || $bytes === '') {
            return;
        }

        $this->storeImage($expense, $bytes, $this->downloadName((string) $expense->receipt_name, 'pdf'));
    }

    public function delete(Expense $expense): void
    {
        $disk = Storage::disk('local');
        $directory = 'expenses/'.$expense->id;

        if (is_string($expense->receipt_path) && $expense->receipt_path !== '') {
            $disk->delete($expense->receipt_path);
        }

        $disk->delete([
            $directory.'/receipt.pdf',
            $directory.'/receipt.jpg',
            $directory.'/preview.jpg',
        ]);
    }

    public function previewPath(Expense $expense): ?string
    {
        $preview = 'expenses/'.$expense->id.'/preview.jpg';

        if (Storage::disk('local')->exists($preview)) {
            return $preview;
        }

        $path = $expense->receipt_path;

        if (! is_string($path) || $path === '' || ! Storage::disk('local')->exists($path)) {
            return null;
        }

        if ($this->pathIsImage($path, $expense->receipt_name)) {
            return $path;
        }

        $bytes = Storage::disk('local')->get($path);

        if (! is_string($bytes) || ! str_starts_with($bytes, '%PDF')) {
            return null;
        }

        $jpeg = $this->largestJpeg($bytes);

        if ($jpeg === null) {
            return null;
        }

        Storage::disk('local')->put($preview, $jpeg);

        return $preview;
    }

    private function largestJpeg(string $pdf): ?string
    {
        $best = null;
        $offset = 0;

        while (($filter = strpos($pdf, '/DCTDecode', $offset)) !== false) {
            $dictStart = strrpos(substr($pdf, 0, $filter), '<<');
            $stream = strpos($pdf, 'stream', $filter);

            if ($dictStart === false || $stream === false) {
                break;
            }

            $dictionary = substr($pdf, $dictStart, $stream - $dictStart);

            if (! preg_match('/\/Length\s+(\d+)/', $dictionary, $match)) {
                $offset = $filter + 10;

                continue;
            }

            $start = $stream + strlen('stream');

            if (substr($pdf, $start, 2) === "\r\n") {
                $start += 2;
            } elseif (isset($pdf[$start]) && ($pdf[$start] === "\n" || $pdf[$start] === "\r")) {
                $start++;
            }

            $chunk = substr($pdf, $start, (int) $match[1]);

            if (! str_starts_with($chunk, "\xFF\xD8")) {
                $offset = $filter + 10;

                continue;
            }

            $end = strpos($chunk, "\xFF\xD9");

            if ($end !== false) {
                $chunk = substr($chunk, 0, $end + 2);
            }

            if ($best === null || strlen($chunk) > strlen($best)) {
                $best = $chunk;
            }

            $offset = $filter + 10;
        }

        if (! is_string($best)) {
            return null;
        }

        $image = @imagecreatefromstring($best);

        if ($image === false) {
            return null;
        }

        imagedestroy($image);

        return $best;
    }

    private function storeImage(Expense $expense, string $bytes, string $downloadName): void
    {
        $compressed = $this->compressedJpeg($bytes);
        $directory = 'expenses/'.$expense->id;
        $disk = Storage::disk('local');

        $this->delete($expense);

        if ($compressed === null) {
            $disk->put($directory.'/receipt.jpg', $bytes);
            $expense->forceFill([
                'receipt_path' => $directory.'/receipt.jpg',
                'receipt_name' => $this->downloadName($downloadName, 'jpg'),
            ])->save();

            return;
        }

        $disk->put($directory.'/preview.jpg', $compressed['bytes']);
        $disk->put(
            $directory.'/receipt.pdf',
            $this->pdf($compressed['bytes'], $compressed['width'], $compressed['height']),
        );

        $expense->forceFill([
            'receipt_path' => $directory.'/receipt.pdf',
            'receipt_name' => $downloadName,
        ])->save();
    }

    /**
     * @return array{bytes: string, width: int, height: int}|null
     */
    private function compressedJpeg(string $bytes): ?array
    {
        $source = @imagecreatefromstring($bytes);

        if ($source === false) {
            return null;
        }

        $source = $this->oriented($source, $bytes);
        $width = imagesx($source);
        $height = imagesy($source);
        $longest = max($width, $height, 1);
        $scale = min(1, 1200 / $longest);
        $targetWidth = max(1, (int) round($width * $scale));
        $targetHeight = max(1, (int) round($height * $scale));
        $canvas = imagecreatetruecolor($targetWidth, $targetHeight);

        if ($canvas === false) {
            imagedestroy($source);

            return null;
        }

        $white = imagecolorallocate($canvas, 255, 255, 255);
        imagefill($canvas, 0, 0, $white);
        imagecopyresampled($canvas, $source, 0, 0, 0, 0, $targetWidth, $targetHeight, $width, $height);
        ob_start();
        imagejpeg($canvas, null, 50);
        $jpeg = ob_get_clean();
        imagedestroy($source);
        imagedestroy($canvas);

        if (! is_string($jpeg) || $jpeg === '') {
            return null;
        }

        return [
            'bytes' => $jpeg,
            'width' => $targetWidth,
            'height' => $targetHeight,
        ];
    }

    /**
     * @param  \GdImage  $image
     * @return \GdImage
     */
    private function oriented($image, string $bytes)
    {
        if (! function_exists('exif_read_data')) {
            return $image;
        }

        $temporary = tempnam(sys_get_temp_dir(), 'receipt');

        if ($temporary === false) {
            return $image;
        }

        file_put_contents($temporary, $bytes);
        $exif = @exif_read_data($temporary);
        @unlink($temporary);
        $orientation = (int) ($exif['Orientation'] ?? 1);
        $rotated = match ($orientation) {
            3 => imagerotate($image, 180, 0),
            6 => imagerotate($image, -90, 0),
            8 => imagerotate($image, 90, 0),
            default => $image,
        };

        if ($rotated instanceof \GdImage && $rotated !== $image) {
            imagedestroy($image);

            return $rotated;
        }

        return $image;
    }

    private function pdf(string $jpeg, int $pixelWidth, int $pixelHeight): string
    {
        $landscape = $pixelWidth > $pixelHeight;
        $pageWidth = $landscape ? 792 : 612;
        $pageHeight = $landscape ? 612 : 792;
        $scale = min(($pageWidth - 72) / $pixelWidth, ($pageHeight - 72) / $pixelHeight);
        $drawWidth = round($pixelWidth * $scale, 2);
        $drawHeight = round($pixelHeight * $scale, 2);
        $x = round(($pageWidth - $drawWidth) / 2, 2);
        $y = round(($pageHeight - $drawHeight) / 2, 2);
        $content = "q\n{$drawWidth} 0 0 {$drawHeight} {$x} {$y} cm\n/Im0 Do\nQ\n";
        $objects = [
            "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
            "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
            "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {$pageWidth} {$pageHeight}] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>\nendobj\n",
            "4 0 obj\n<< /Length ".strlen($content)." >>\nstream\n{$content}endstream\nendobj\n",
            "5 0 obj\n<< /Type /XObject /Subtype /Image /Width {$pixelWidth} /Height {$pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ".strlen($jpeg)." >>\nstream\n{$jpeg}\nendstream\nendobj\n",
        ];
        $pdf = "%PDF-1.4\n";
        $offsets = [0];

        foreach ($objects as $object) {
            $offsets[] = strlen($pdf);
            $pdf .= $object;
        }

        $xref = strlen($pdf);
        $count = count($offsets);
        $pdf .= "xref\n0 {$count}\n";
        $pdf .= "0000000000 65535 f \n";

        for ($index = 1; $index < $count; $index++) {
            $pdf .= sprintf("%010d 00000 n \n", $offsets[$index]);
        }

        return $pdf."trailer\n<< /Size {$count} /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF";
    }

    private function isImage(UploadedFile $file): bool
    {
        $extension = strtolower($file->getClientOriginalExtension() ?: (string) $file->extension());

        return in_array($extension, ['jpg', 'jpeg', 'png', 'gif', 'webp'], true)
            || str_starts_with((string) $file->getMimeType(), 'image/');
    }

    private function pathIsImage(string $path, ?string $name): bool
    {
        $value = strtolower($name ?: $path);

        return preg_match('/\.(jpe?g|png|gif|webp)$/', $value) === 1;
    }

    private function downloadName(string $original, string $extension): string
    {
        $base = basename(str_replace('\\', '/', $original));
        $base = preg_replace('/\.[^.]+$/', '', $base) ?: 'receipt';
        $base = preg_replace('/[^A-Za-z0-9._ -]+/', '-', $base) ?: 'receipt';

        return $base.'.'.$extension;
    }
}
