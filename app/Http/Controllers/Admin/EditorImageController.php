<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Support\EditorImage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EditorImageController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless($user && (
            $user->hasPermission('create-quotations')
            || $user->hasPermission('update-quotations')
            || $user->hasPermission('create-bids')
            || $user->hasPermission('update-bids')
        ), 403);

        $validated = $request->validate([
            'image' => ['required', 'file', 'image', 'mimes:jpeg,jpg,png,gif,webp', 'max:5120'],
        ]);

        $path = EditorImage::store($validated['image']);

        return response()->json([
            'url' => '/storage/'.$path,
        ]);
    }
}
