<?php

namespace App\Http\Controllers\WebAuthn;

use Illuminate\Contracts\Support\Responsable;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Laragear\WebAuthn\Http\Requests\AttestationRequest;
use Laragear\WebAuthn\Http\Requests\AttestedRequest;
use Laragear\WebAuthn\Models\WebAuthnCredential;

class WebAuthnRegisterController
{
    public function options(AttestationRequest $request): Responsable
    {
        return $request->fastRegistration()->userless()->toCreate();
    }

    public function register(AttestedRequest $request): Response
    {
        $alias = trim((string) $request->input('alias', ''));

        $request->save(['alias' => $alias !== '' ? mb_substr($alias, 0, 60) : 'This device']);

        return response()->noContent();
    }

    public function destroy(Request $request, string $credential): Response
    {
        $request->user()->webAuthnCredentials()->whereKey($credential)->delete();

        return response()->noContent();
    }
}
