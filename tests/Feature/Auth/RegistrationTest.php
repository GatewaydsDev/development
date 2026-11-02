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

test('sign-up request emails Ricardo and confirms to the requester', function () {
    $sent = fakeMail();
    ricardo();
    User::factory()->create(['name' => 'Larry', 'role' => 'super_admin', 'microsoft_mailbox' => 'larry@gateway-ds.com']);

    $this->post('/register', ['name' => 'New Person', 'email' => 'New@Example.com'])
        ->assertRedirect('/register')
        ->assertSessionHas('registration_requested.emailed', true);

    expect($sent)->toHaveCount(2)
        ->and($sent[0]['to'])->toBe('ricardo@gateway-ds.com')
        ->and($sent[0]['mailbox'])->toBe('ricardo@gateway-ds.com')
        ->and($sent[1]['to'])->toBe('new@example.com');
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
        ->and($sent)->toHaveCount(3)
        ->and($sent[2]['to'])->toBe('new@example.com')
        ->and($sent[2]['html'])->toContain('/register/complete/')->toContain('Project Manager');
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
    preg_match('#register/complete/([A-Za-z0-9]+)#', $sent[2]['html'], $m);

    return $m[1];
}

test('approved link creates the account with the approved level and works once', function () {
    $token = approvedToken();

    $this->get("/register/complete/$token")->assertOk()
        ->assertInertia(fn ($page) => $page->where('state', 'ready')->where('level', 'Project Manager'));

    $this->post("/register/complete/$token", ['password' => 'Str0ng!Passw0rd', 'password_confirmation' => 'Str0ng!Passw0rd'])
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

test('sign-up is refused when the robot check fails', function () {
    config(['services.turnstile.site_key' => 'site', 'services.turnstile.secret_key' => 'secret']);
    Illuminate\Support\Facades\Http::fake(['challenges.cloudflare.com/*' => Illuminate\Support\Facades\Http::response(['success' => false])]);
    $sent = fakeMail();
    ricardo();

    $this->post('/register', ['name' => 'Bot', 'email' => 'bot@example.com', 'cf-turnstile-response' => 'bad'])
        ->assertSessionHasErrors('captcha');
    $this->post('/register', ['name' => 'Bot', 'email' => 'bot@example.com'])
        ->assertSessionHasErrors('captcha');

    expect($sent)->toHaveCount(0)
        ->and(RegistrationRequest::count())->toBe(0);
});

test('sign-up works when the robot check passes', function () {
    config(['services.turnstile.site_key' => 'site', 'services.turnstile.secret_key' => 'secret']);
    Illuminate\Support\Facades\Http::fake(['challenges.cloudflare.com/*' => Illuminate\Support\Facades\Http::response(['success' => true])]);
    $sent = fakeMail();
    ricardo();

    $this->post('/register', ['name' => 'Human', 'email' => 'human@example.com', 'cf-turnstile-response' => 'ok'])
        ->assertSessionDoesntHaveErrors();

    expect($sent)->toHaveCount(2);
});

test('the hidden honeypot field silently blocks bots', function () {
    $sent = fakeMail();
    ricardo();

    $this->post('/register', ['name' => 'Bot', 'email' => 'bot@example.com', 'website' => 'http://spam.test'])
        ->assertRedirect(route('register'));

    expect($sent)->toHaveCount(0)
        ->and(RegistrationRequest::count())->toBe(0);
});

test('sign-up requests are rate limited', function () {
    fakeMail();
    ricardo();

    foreach (range(1, 5) as $i) {
        $this->post('/register', ['name' => 'P'.$i, 'email' => "p{$i}@example.com"]);
    }

    $this->post('/register', ['name' => 'Six', 'email' => 'six@example.com'])->assertStatus(429);
});


test('built-in robot check blocks wrong, missing and reused answers', function () {
    config(['services.robot_challenge' => true, 'services.turnstile.site_key' => null]);
    fakeMail();
    ricardo();

    $this->get('/register')->assertInertia(fn ($page) => $page->has('robotChallenge.question'));

    $make = function (int $answer, int $age) {
        return \Illuminate\Support\Facades\Crypt::encryptString(json_encode(['answer' => $answer, 'at' => time() - $age, 'id' => uniqid()]));
    };
    $payload = fn ($token, $answer) => ['name' => 'H', 'email' => uniqid().'@example.com', 'challenge_token' => $token, 'challenge_answer' => $answer];

    $this->post('/register', ['name' => 'H', 'email' => 'x@example.com'])->assertSessionHasErrors('captcha');

    $token = $make(10, 10);
    $this->post('/register', $payload($token, 11))->assertSessionHasErrors('captcha');
    $this->post('/register', $payload($token, 10))->assertSessionHasNoErrors();
    $this->post('/register', $payload($token, 10))->assertSessionHasErrors('captcha');

    $fresh = \Illuminate\Support\Facades\Crypt::encryptString(json_encode(['answer' => 5, 'at' => time(), 'id' => uniqid()]));
    $this->post('/register', $payload($fresh, 5))->assertSessionHasErrors('captcha');
});

test('super admin sees pending sign-up requests on user management and can approve there', function () {
    fakeMail();
    $admin = ricardo();
    $this->post('/register', ['name' => 'New Person', 'email' => 'new@example.com']);
    $registration = RegistrationRequest::first();

    $this->actingAs($admin)->get(route('admin.users.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->has('registrationRequests', 1)
            ->where('registrationRequests.0.email', 'new@example.com'));

    $this->actingAs($admin)
        ->post(route('register.approve', $registration), ['role' => 'project_manager', 'return' => 'users'])
        ->assertRedirect(route('admin.users.index'));

    $this->actingAs($admin)->get(route('admin.users.index'))
        ->assertInertia(fn (Assert $page) => $page->where('registrationRequests.0.status', 'approved'));
});

test('reactivating a blocked user can email them', function () {
    $sent = fakeMail();
    $admin = ricardo();
    $user = User::factory()->create(['account_status' => 'blocked']);

    $this->actingAs($admin)->patch(route('admin.users.status', $user), [
        'status' => 'active', 'reason' => 'Verified identity', 'notify_user' => true,
    ])->assertSessionHas('success');

    expect($user->fresh()->account_status)->toBe('active')
        ->and(collect($sent)->contains(fn ($mail) => in_array($user->email, (array) $mail, true)))->toBeTrue();
});

test('denying a request emails the requester', function () {
    $sent = fakeMail();
    $admin = ricardo();
    $this->post('/register', ['name' => 'New Person', 'email' => 'new@example.com']);

    $this->actingAs($admin)->post(route('register.deny', RegistrationRequest::first()), ['return' => 'users'])
        ->assertRedirect(route('admin.users.index'));

    expect(collect($sent)->last()['to'])->toBe('new@example.com');
});

test('super admin can change a request status back and forth and re-approve a denied one', function () {
    $sent = fakeMail();
    $admin = ricardo();
    $this->post('/register', ['name' => 'New Person', 'email' => 'new@example.com']);
    $registration = RegistrationRequest::first();

    $this->actingAs($admin)->post(route('register.deny', $registration));
    expect($registration->fresh()->status)->toBe('denied');

    $this->actingAs($admin)->post(route('register.reopen', $registration));
    expect($registration->fresh()->status)->toBe('pending');

    $this->actingAs($admin)->post(route('register.deny', $registration));
    $this->actingAs($admin)->post(route('register.approve', $registration), ['role' => 'project_manager']);

    expect($registration->fresh()->status)->toBe('approved')
        ->and(collect($sent)->last()['html'])->toContain('/register/complete/');
});

test('login block log rows expose the current status and whether it can be changed', function () {
    fakeMail();
    $admin = ricardo();
    $user = User::factory()->create(['name' => 'Jose']);
    app(App\Support\LoginLockout::class)->setStatus($user, 'blocked', 'user_management', $admin, 'Test block');

    $this->actingAs($admin)->get(route('admin.users.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('blockLogs.0.user_status', 'blocked')
            ->where('blockLogs.0.can_change_status', true));
});

test('block log email can be sent to the affected user', function () {
    $sent = fakeMail();
    $admin = ricardo();
    $user = User::factory()->create(['name' => 'Jose']);
    app(App\Support\LoginLockout::class)->setStatus($user, 'blocked', 'user_management', $admin, 'Test block');
    $log = App\Models\LoginBlockLog::first();

    $this->actingAs($admin)->post(route('admin.users.block-logs.notify', $log))
        ->assertSessionHas('success');

    expect(collect($sent)->last()['to'])->toBe($user->email);

    $this->actingAs(User::factory()->create())->post(route('admin.users.block-logs.notify', $log))
        ->assertForbidden();
});

test('weak passwords are rejected when finishing sign-up', function () {
    $token = approvedToken();

    foreach (['short1!', 'alllowercase1!', 'NoNumbers!!', 'NoSymbols123A'] as $weak) {
        $this->post(route('register.complete.store', $token), ['password' => $weak, 'password_confirmation' => $weak])
            ->assertSessionHasErrors('password');
    }

    $this->post(route('register.complete.store', $token), ['password' => 'Str0ng!Passw0rd', 'password_confirmation' => 'Str0ng!Passw0rd'])
        ->assertSessionDoesntHaveErrors();
});
