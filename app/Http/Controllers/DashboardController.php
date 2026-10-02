<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\DashboardSnapshot;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $user = $request->user();
        abort_unless($user instanceof User, 403);

        $snapshot = DashboardSnapshot::for($user);

        return Inertia::render('Dashboard', [
            'charts' => $snapshot['charts'],
            'listVersion' => $snapshot['listVersion'],
            'bidListVersion' => $snapshot['bidListVersion'],
            'quotationListVersion' => $snapshot['quotationListVersion'],
            'stats' => $snapshot['stats'],
        ]);
    }
}
