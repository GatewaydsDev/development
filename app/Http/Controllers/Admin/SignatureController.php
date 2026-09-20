<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class SignatureController extends Controller
{
    public function edit(Request $request): Response
    {
        $user = $request->user();

        abort_unless($user !== null, 403);

        return Inertia::render('Admin/Signature/Edit', [
            'signature' => [
                'url' => $user->signature_url,
                'has_signature' => filled($user->signature_path),
                'name' => $user->name,
            ],
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $user = $request->user();

        abort_unless($user !== null, 403);

        $validated = $request->validate([
            'signature' => ['required', 'string', 'max:800000'],
        ]);

        $path = $this->storeSignatureDataUrl($validated['signature'], $user->id);

        if ($user->signature_path && $user->signature_path !== $path) {
            Storage::disk('public')->delete($user->signature_path);
        }

        $user->signature_path = $path;
        $user->save();

        return redirect()
            ->route('admin.signature.edit')
            ->with('success', 'Signature saved successfully.');
    }

    public function destroy(Request $request): RedirectResponse
    {
        $user = $request->user();

        abort_unless($user !== null, 403);

        if ($user->signature_path) {
            Storage::disk('public')->delete($user->signature_path);
        }

        $user->signature_path = null;
        $user->save();

        return redirect()
            ->route('admin.signature.edit')
            ->with('success', 'Signature removed successfully.');
    }

    private function storeSignatureDataUrl(string $dataUrl, int $userId): string
    {
        if (! preg_match('/^data:image\/png;base64,/', $dataUrl)) {
            throw ValidationException::withMessages([
                'signature' => 'Choose a style or draw a signature before saving.',
            ]);
        }

        $binary = base64_decode(substr($dataUrl, strlen('data:image/png;base64,')), true);

        if ($binary === false || $binary === '') {
            throw ValidationException::withMessages([
                'signature' => 'The signature could not be read.',
            ]);
        }

        if (strlen($binary) > 400000) {
            throw ValidationException::withMessages([
                'signature' => 'The signature image is too large. Draw it again.',
            ]);
        }

        $path = 'signatures/user-'.$userId.'.png';

        Storage::disk('public')->put($path, $binary);

        return $path;
    }
}
