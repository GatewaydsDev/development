<?php

use Inertia\Testing\AssertableInertia as Assert;

test('registration screen can be rendered', function () {
    $response = $this->get('/register');

    $response->assertStatus(200);
});

use App\Models\RegistrationRequest;
use App\Models\User;
use App\Services\MicrosoftGraphMailService;
use Illuminate\Support\Facades\URL;

function fakeMail(): ArrayObject
{
    $sent = new ArrayObject;
    $mock = Mockery::mock(MicrosoftGraphMailService::class);
    $mock->shouldReceive('sendFromMailbox')->andReturnUsing(function ($mailbox, $to, $subject, $html) use ($sent) {
        $sent[] = compact('mailbox', 'to', 'subject', 'html');
    });
    app()->instance(MicrosoftGraphMailService::class, $mock);

    return $sent;
}

function ricardo(): User
{
    return User::factory()->create([
        'name' => 'Ricardo', 'role' => 'super_admin', 'microsoft_mailbox' => 'ricardo@gateway-ds.com',
    ]);
}

test('sign-up request emails only Ricardo', function () {
    $sent = fakeMail();
    ricardo();
    User::factory()->create(['name' => 'Larry', 'role' => 'super_admin', 'microsoft_mailbox' => 'larry@gateway-ds.com']);

    $this->post('/register', ['name' => 'New Person', 'email' => 'New@Example.com'])
        ->assertRedirect('/register')
        ->assertSessionHas('registration_requested.emailed', true);

    expect($sent)->toHaveCount(1)
        ->and($sent[0]['to'])->toBe('ricardo@gateway-ds.com')
        ->and($sent[0]['mailbox'])->toBe('ricardo@gateway-ds.com');
    $this->assertDatabaseHas('registration_requests', ['email' => 'new@example.com', 'status' => 'pending']);
    $this->assertGuest();
});

test('a second request for the same email is refused', function () {
    fakeMail();
    ricardo();
    $this->post('/register', ['name' => 'A', 'email' => 'a@example.com']);

    $this->from('/register')->post('/register', ['name' => 'A', 'email' => 'a@example.com'])
        ->assertSessionHasErrors('email');
    expect(RegistrationRequest::count())->toBe(1);
});

test('super admin approves with a level and the user gets an 8 minute link', function () {
    $sent = fakeMail();
    $admin = ricardo();
    $this->post('/register', ['name' => 'New Person', 'email' => 'new@example.com']);
    $registration = RegistrationRequest::first();

    $url = URL::temporarySignedRoute('register.review', now()->addDay(), $registration);
    $this->actingAs($admin)->get($url)->assertOk();

    $this->actingAs($admin)->post(route('register.approve', $registration), ['role' => 'project_manager'])
        ->assertRedirect(route('dashboard'));

    $registration->refresh();
    expect($registration->status)->toBe('approved')
        ->and($registration->role)->toBe('project_manager')
        ->and((int) round(now()->diffInMinutes($registration->expires_at, true)))->toBeIn([7, 8])
        ->and($sent)->toHaveCount(2)
        ->and($sent[1]['to'])->toBe('new@example.com')
        ->and($sent[1]['html'])->toContain('/register/complete/')->toContain('Project Manager');
});

test('non super admins cannot approve and super admin level cannot be granted', function () {
    fakeMail();
    $admin = ricardo();
    $this->post('/register', ['name' => 'N', 'email' => 'n@example.com']);
    $registration = RegistrationRequest::first();

    $this->actingAs(User::factory()->create(['role' => 'user']))
        ->post(route('register.approve', $registration), ['role' => 'user'])->assertForbidden();

    $this->actingAs($admin)->post(route('register.approve', $registration), ['role' => 'super_admin'])
        ->assertSessionHasErrors('role');
});

function approvedToken(): string
{
    $sent = fakeMail();
    $admin = ricardo();
    test()->post('/register', ['name' => 'New Person', 'email' => 'new@example.com']);
    test()->actingAs($admin)->post(route('register.approve', RegistrationRequest::first()), ['role' => 'project_manager']);
    auth()->logout();
    preg_match('#register/complete/([A-Za-z0-9]+)#', $sent[1]['html'], $m);

    return $m[1];
}

test('approved link creates the account with the approved level and works once', function () {
    $token = approvedToken();

    $this->get("/register/complete/$token")->assertOk()
        ->assertInertia(fn ($page) => $page->where('state', 'ready')->where('level', 'Project Manager'));

    $this->post("/register/complete/$token", ['password' => 'password', 'password_confirmation' => 'password'])
        ->assertRedirect(route('dashboard', absolute: false));

    $this->assertAuthenticated();
    $this->assertDatabaseHas('users', ['email' => 'new@example.com', 'role' => 'project_manager']);

    auth()->logout();
    $this->get("/register/complete/$token")->assertInertia(fn ($page) => $page->where('state', 'invalid'));
});

test('expired link is dead and the email cannot request again', function () {
    $token = approvedToken();
    $this->travel(9)->minutes();

    $this->get("/register/complete/$token")->assertInertia(fn ($page) => $page->where('state', 'expired'));
    $this->post("/register/complete/$token", ['password' => 'password', 'password_confirmation' => 'password'])
        ->assertRedirect("/register/complete/$token");
    $this->assertDatabaseMissing('users', ['email' => 'new@example.com']);

    $this->get("/register/complete/$token")->assertInertia(fn ($page) => $page->where('state', 'expired'));
    $this->from('/register')->post('/register', ['name' => 'New Person', 'email' => 'new@example.com'])
        ->assertSessionHasErrors('email');
});

test('registration email availability can be checked', function () {
    \App\Models\User::factory()->create([
        'email' => 'taken@example.com',
    ]);

    $this->get('/register?email=taken@example.com')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('emailAvailability.email', 'taken@example.com')
            ->where('emailAvailability.taken', true)
        );

    $this->get('/register?email=available@example.com')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('emailAvailability.email', 'available@example.com')
            ->where('emailAvailability.taken', false)
        );
});
