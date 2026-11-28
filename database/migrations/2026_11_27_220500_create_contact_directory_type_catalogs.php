<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contact_directory_contact_types', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 60);
            $table->string('slug', 60);
            $table->timestamps();

            $table->unique('name', 'cd_contact_types_name_uq');
            $table->unique('slug', 'cd_contact_types_slug_uq');
        });

        Schema::create('contact_directory_phone_labels', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 60);
            $table->timestamps();

            $table->unique('name', 'cd_phone_labels_name_uq');
        });

        $now = now();

        DB::table('contact_directory_contact_types')->insert([
            ['name' => 'Supplier', 'slug' => 'supplier', 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'Customer', 'slug' => 'customer', 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'Subcontractor', 'slug' => 'subcontractor', 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'Other', 'slug' => 'other', 'created_at' => $now, 'updated_at' => $now],
        ]);

        DB::table('contact_directory_phone_labels')->insert(array_map(
            fn (string $name): array => ['name' => $name, 'created_at' => $now, 'updated_at' => $now],
            ['Office', 'Mobile', 'Home', 'Fax', 'Direct', 'Other'],
        ));
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_directory_phone_labels');
        Schema::dropIfExists('contact_directory_contact_types');
    }
};
