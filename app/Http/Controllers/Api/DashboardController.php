<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\DashboardSnapshot;
use App\Support\UserPrivileges;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless(
            $user instanceof User && UserPrivileges::allows($user, 'view-dashboard'),
            403,
        );

        return response()->json(DashboardSnapshot::for($user));
    }
}
