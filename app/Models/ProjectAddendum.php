<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProjectAddendum extends Model
{
    protected $fillable = [
        'uuid',
        'project_id',
        'user_id',
        'number',
        'issued_on',
        'notes',
        'document_path',
        'document_name',
    ];

    protected function casts(): array
    {
        return [
            'issued_on' => 'date',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (ProjectAddendum $addendum): void {
            $addendum->uuid ??= (string) Str::uuid();
            $addendum->user_id ??= auth()->id();
        });
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function storeDocument(UploadedFile $file): void
    {
        $this->deleteStoredDocument();

        $extension = strtolower((string) ($file->getClientOriginalExtension() ?: 'bin'));
        $extension = preg_replace('/[^a-z0-9]/', '', $extension) ?: 'bin';
        $path = $file->storeAs(
            'project-addendums/'.$this->project_id,
            (string) Str::uuid().'.'.$extension,
            'local',
        );

        if ($path === false) {
            return;
        }

        $this->document_path = $path;
        $this->document_name = $this->cleanDocumentName($file->getClientOriginalName());
    }

    public function deleteStoredDocument(): void
    {
        if (filled($this->document_path)) {
            Storage::disk('local')->delete($this->document_path);
        }

        $this->document_path = null;
        $this->document_name = null;
    }

    public function documentResponse(): StreamedResponse|BinaryFileResponse
    {
        abort_unless(
            filled($this->document_path) && Storage::disk('local')->exists($this->document_path),
            404,
        );

        $name = $this->document_name ?: basename((string) $this->document_path);
        $mime = Storage::disk('local')->mimeType($this->document_path) ?: 'application/octet-stream';
        $inline = str_starts_with($mime, 'image/') || $mime === 'application/pdf' || $mime === 'text/plain';

        if ($inline) {
            return Storage::disk('local')->response($this->document_path, $name, [
                'Content-Type' => $mime,
                'Content-Disposition' => 'inline; filename="'.$this->downloadName($name).'"',
            ]);
        }

        return Storage::disk('local')->download($this->document_path, $name);
    }

    private function cleanDocumentName(string $name): string
    {
        $name = basename(str_replace('\\', '/', $name));
        $name = preg_replace('/[^\w.\- ()]+/u', '', $name) ?: 'addendum';

        return mb_substr($name, 0, 180);
    }

    private function downloadName(string $name): string
    {
        return str_replace(['"', "\r", "\n"], '', $name);
    }
}
