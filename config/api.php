<?php

return [
    'rate_limits' => [
        'authenticated_per_minute' => (int) env('API_AUTHENTICATED_RATE_LIMIT', 300),
        'guest_per_minute' => (int) env('API_GUEST_RATE_LIMIT', 60),
    ],
];
