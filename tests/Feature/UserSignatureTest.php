<?php

use App\Models\User;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

function signaturePngDataUrl(): string
{
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
}

test('an authenticated user can open the signature page', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('admin.signature.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Signature/Edit')
            ->where('signature.has_signature', false)
            ->where('signature.url', null)
            ->where('signature.name', $user->name));
});

test('a guest cannot open the signature page', function () {
    $this->get(route('admin.signature.edit'))
        ->assertRedirect(route('login'));
});

test('an authenticated user can save update and remove their signature', function () {
    Storage::fake('public');

    $user = User::factory()->create();
    $dataUrl = signaturePngDataUrl();

    $this->actingAs($user)
        ->patch(route('admin.signature.update'), [
            'signature' => $dataUrl,
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('admin.signature.edit'));

    $user->refresh();

    expect($user->signature_path)->toBe('signatures/user-'.$user->id.'.png')
        ->and(Storage::disk('public')->exists($user->signature_path))->toBeTrue()
        ->and($user->signature_url)->toContain('storage/signatures/user-'.$user->id.'.png');

    $this->actingAs($user)
        ->get(route('admin.signature.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('signature.has_signature', true));

    $this->actingAs($user)
        ->delete(route('admin.signature.destroy'))
        ->assertRedirect(route('admin.signature.edit'));

    $user->refresh();

    expect($user->signature_path)->toBeNull()
        ->and(Storage::disk('public')->exists('signatures/user-'.$user->id.'.png'))->toBeFalse();
});

test('an invalid signature payload is rejected', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from(route('admin.signature.edit'))
        ->patch(route('admin.signature.update'), [
            'signature' => 'not-an-image',
        ])
        ->assertSessionHasErrors('signature');
});

test('quotation print includes the saved representative signature', function () {
    Storage::fake('public');

    $admin = quotationAdmin();
    $quotation = makeQuotation($admin);
    $path = 'signatures/user-'.$admin->id.'.png';

    Storage::disk('public')->put($path, base64_decode(substr(signaturePngDataUrl(), strlen('data:image/png;base64,')), true));
    $admin->forceFill(['signature_path' => $path])->save();

    $this->actingAs($admin)
        ->get(route('admin.quotations.print', $quotation))
        ->assertOk()
        ->assertSee('data:image/png;base64,', false)
        ->assertSee('Authorization', false)
        ->assertSee($admin->name, false);
});
