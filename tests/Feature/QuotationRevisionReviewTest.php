<?php

use App\Models\QuotationRevisionReview;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

function fakeRevisionReviewGraph(int $sendStatus = 202): void
{
    Cache::flush();
    config([
        'services.microsoft.tenant_id' => 'tenant-id',
        'services.microsoft.client_id' => 'client-id',
        'services.microsoft.client_secret' => 'client-secret',
        'services.microsoft.mail_from' => 'sales@gateway-ds.com',
        'services.microsoft.mail_from_name' => 'Gateway Door Systems',
    ]);

    Http::fake(function ($request) use ($sendStatus) {
        if (str_contains($request->url(), 'login.microsoftonline.com')) {
            return Http::response([
                'access_token' => 'graph-token',
                'expires_in' => 3600,
            ]);
        }

        $path = rawurldecode((string) (parse_url($request->url(), PHP_URL_PATH) ?? ''));

        if ($request->method() === 'POST' && str_ends_with($path, '/sendMail')) {
            return Http::response('', $sendStatus);
        }

        return Http::response('unexpected', 500);
    });
}

test('guests and users without quotation access cannot email a revision', function () {
    $admin = quotationAdmin();
    $quote = makeQuotation($admin);
    $revision = $quote->revisions()->create([
        'number' => 'A',
        'user_id' => $admin->id,
    ]);

    $this->post(route('admin.quotations.revisions.review-email', [$quote, $revision]), [
        'email' => 'sales@gateway-ds.com',
    ])->assertRedirect(route('login'));

    $this->actingAs(User::factory()->create())
        ->post(route('admin.quotations.revisions.review-email', [$quote, $revision]), [
            'email' => 'sales@gateway-ds.com',
            'mailbox' => 'ricardo@gateway-ds.com',
        ])
        ->assertForbidden();

    expect(QuotationRevisionReview::query()->count())->toBe(0);
});

test('a quotation revision is emailed from the sender mailbox with the quote attached', function () {
    $admin = quotationAdmin();
    $admin->forceFill([
        'name' => 'Ricardo Scarpim',
        'microsoft_mailbox' => 'ricardo@gateway-ds.com',
    ])->save();
    $quote = makeQuotation($admin);
    $revision = $quote->revisions()->create([
        'number' => 'B',
        'notes' => 'Updated hardware set.',
        'user_id' => $admin->id,
    ]);
    fakeRevisionReviewGraph();

    $this->actingAs($admin)
        ->get(route('admin.quotations.show', $quote))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('canSendRevisionReview', true)
            ->where('reviewMailbox', 'ricardo@gateway-ds.com')
            ->where('quotation.revisions.0.number', 'B')
        );

    $this->actingAs($admin)
        ->post(route('admin.quotations.revisions.review-email', [$quote, $revision]), [
            'email' => 'sales@gateway-ds.com',
            'message' => 'Please review this revision.',
            'mailbox' => 'sales@gateway-ds.com',
            'user_id' => 999,
        ])
        ->assertRedirect()
        ->assertSessionHas('success');

    $review = QuotationRevisionReview::query()->first();

    expect($review)->not->toBeNull()
        ->and($review->quotation_revision_id)->toBe($revision->id)
        ->and($review->sent_by_id)->toBe($admin->id)
        ->and($review->recipient_email)->toBe('sales@gateway-ds.com')
        ->and($review->sender_mailbox)->toBe('ricardo@gateway-ds.com')
        ->and($review->message)->toBe('Please review this revision.');

    Http::assertSent(function ($request) use ($quote) {
        $path = rawurldecode((string) (parse_url($request->url(), PHP_URL_PATH) ?? ''));

        if ($request->method() !== 'POST' || ! str_ends_with($path, '/users/ricardo@gateway-ds.com/sendMail')) {
            return false;
        }

        $message = $request->data()['message'] ?? null;

        if (! is_array($message) || ($request->data()['saveToSentItems'] ?? false) !== true) {
            return false;
        }
        $attachment = $message['attachments'][0];
        $pdf = base64_decode((string) $attachment['contentBytes'], true);

        return ! array_key_exists('from', $message)
            && ! array_key_exists('sender', $message)
            && $message['toRecipients'][0]['emailAddress']['address'] === 'sales@gateway-ds.com'
            && str_contains($message['subject'], 'revision B')
            && str_contains($message['body']['content'], 'Please review this revision.')
            && str_contains($message['body']['content'], $quote->quotation_number)
            && $attachment['contentType'] === 'application/pdf'
            && str_contains($attachment['name'], 'quotation-')
            && is_string($pdf)
            && str_starts_with($pdf, '%PDF');
    });

    Http::assertNotSent(function ($request) {
        return str_contains(rawurldecode($request->url()), '/users/sales@gateway-ds.com/');
    });
});

test('a revision email is refused without a mailbox, for a bad address, or when Graph rejects it', function () {
    $admin = quotationAdmin();
    $quote = makeQuotation($admin);
    $revision = $quote->revisions()->create([
        'number' => 'C',
        'user_id' => $admin->id,
    ]);
    $other = makeQuotation($admin);
    fakeRevisionReviewGraph();

    $this->actingAs($admin)
        ->from(route('admin.quotations.show', $quote))
        ->post(route('admin.quotations.revisions.review-email', [$quote, $revision]), [
            'email' => 'sales@gateway-ds.com',
            'mailbox' => 'ricardo@gateway-ds.com',
        ])
        ->assertRedirect(route('admin.quotations.show', $quote))
        ->assertSessionHasErrors('email');

    Http::assertNothingSent();

    $admin->forceFill(['microsoft_mailbox' => 'ricardo@gateway-ds.com'])->save();

    $this->actingAs($admin)
        ->post(route('admin.quotations.revisions.review-email', [$other, $revision]), [
            'email' => 'sales@gateway-ds.com',
        ])
        ->assertNotFound();

    $this->actingAs($admin)
        ->from(route('admin.quotations.show', $quote))
        ->post(route('admin.quotations.revisions.review-email', [$quote, $revision]), [
            'email' => 'not-an-email',
        ])
        ->assertRedirect(route('admin.quotations.show', $quote))
        ->assertSessionHasErrors('email');

    expect(QuotationRevisionReview::query()->count())->toBe(0);
});

test('a rejected Microsoft 365 response does not record the revision review', function () {
    $admin = quotationAdmin();
    $admin->forceFill(['microsoft_mailbox' => 'ricardo@gateway-ds.com'])->save();
    $quote = makeQuotation($admin);
    $revision = $quote->revisions()->create([
        'number' => 'D',
        'user_id' => $admin->id,
    ]);
    fakeRevisionReviewGraph(400);

    $this->actingAs($admin)
        ->from(route('admin.quotations.show', $quote))
        ->post(route('admin.quotations.revisions.review-email', [$quote, $revision]), [
            'email' => 'sales@gateway-ds.com',
        ])
        ->assertRedirect(route('admin.quotations.show', $quote))
        ->assertSessionHasErrors('email')
        ->assertSessionMissing('success');

    expect(QuotationRevisionReview::query()->count())->toBe(0);
});
