<?php

use App\Models\User;
use App\Models\UserLevel;
use App\Support\EditorImage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

test('an admin can upload a picture for the text editor', function () {
    Storage::fake('public');

    $level = UserLevel::firstOrCreate([
        'name' => UserLevel::SUPER_ADMIN,
    ]);
    $admin = User::factory()->create([
        'level_id' => $level->id,
    ]);

    $response = $this->actingAs($admin)->postJson(route('admin.editor-images.store'), [
        'image' => UploadedFile::fake()->image('door.jpg', 640, 480),
    ]);

    $response->assertOk();
    $url = $response->json('url');

    expect($url)->toStartWith('/storage/editor-images/');
    Storage::disk('public')->assertExists(ltrim(str_replace('/storage/', '', (string) $url), '/'));
});

test('a guest cannot upload an editor picture', function () {
    $this->postJson(route('admin.editor-images.store'), [
        'image' => UploadedFile::fake()->image('door.jpg'),
    ])->assertUnauthorized();
});

test('pdf quotations embed uploaded pictures', function () {
    Storage::fake('public');
    $file = UploadedFile::fake()->image('door.jpg', 80, 60);
    Storage::disk('public')->put(
        'editor-images/door.jpg',
        (string) file_get_contents($file->getPathname()),
    );

    $html = EditorImage::forDocument(
        '<img src="/storage/editor-images/door.jpg" alt="Door">',
        'pdf',
    );

    expect($html)->toContain('data:image/');
});
