<?php

use App\Models\User;
use Laravel\Sanctum\Sanctum;

test('job progress overview requires a token', function () {
    $this->getJson('/api/job-progress')->assertUnauthorized();
    $this->getJson('/api/job-progress/abc')->assertUnauthorized();
});

test('job progress overview is only served on mysql', function () {
    if (DB::getDriverName() === 'mysql') {
        $this->markTestSkipped('MySQL serves the view.');
    }

    Sanctum::actingAs(User::factory()->create());

    $this->getJson('/api/job-progress')->assertStatus(501);
});
