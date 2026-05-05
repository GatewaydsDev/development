<?php

test('api status route is available', function () {
    $this->getJson('/api/status')
        ->assertOk()
        ->assertJson([
            'status' => 'ok',
            'app' => config('app.name'),
        ]);
});
