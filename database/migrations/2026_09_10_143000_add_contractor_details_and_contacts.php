<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contractors', function (Blueprint $table): void {
            $table->string('website')->nullable()->after('name');
            $table->string('address_line_1')->nullable()->after('website');
            $table->string('address_line_2')->nullable()->after('address_line_1');
            $table->string('city')->nullable()->after('address_line_2');
            $table->string('state')->nullable()->after('city');
            $table->string('postal_code')->nullable()->after('state');
            $table->string('country')->nullable()->after('postal_code');
            $table->text('notes')->nullable()->after('country');
        });

        Schema::create('contractor_contacts', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('contractor_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('title')->nullable();
            $table->string('email')->nullable();
            $table->string('phone_number')->nullable();
            $table->string('phone_type')->nullable();
            $table->text('notes')->nullable();
            $table->boolean('is_primary')->default(false);
            $table->timestamps();
        });

        if (Schema::hasColumn('contractors', 'contact_name')) {
            DB::table('contractors')
                ->orderBy('id')
                ->get()
                ->each(function (object $contractor): void {
                    $name = trim((string) ($contractor->contact_name ?? ''));
                    $email = trim((string) ($contractor->email ?? ''));
                    $phoneNumber = trim((string) ($contractor->phone_number ?? ''));

                    if ($name === '' && $email === '' && $phoneNumber === '') {
                        return;
                    }

                    DB::table('contractor_contacts')->insert([
                        'uuid' => (string) Str::uuid(),
                        'contractor_id' => $contractor->id,
                        'name' => $name !== '' ? $name : 'Primary contact',
                        'title' => null,
                        'email' => $email !== '' ? $email : null,
                        'phone_number' => $phoneNumber !== '' ? $phoneNumber : null,
                        'phone_type' => $phoneNumber !== '' ? 'office' : null,
                        'notes' => null,
                        'is_primary' => true,
                        'created_at' => $contractor->created_at,
                        'updated_at' => $contractor->updated_at,
                    ]);
                });

            Schema::table('contractors', function (Blueprint $table): void {
                $table->dropColumn(['contact_name', 'email', 'phone_number']);
            });
        }
    }

    public function down(): void
    {
        Schema::table('contractors', function (Blueprint $table): void {
            if (! Schema::hasColumn('contractors', 'contact_name')) {
                $table->string('contact_name')->nullable()->after('name');
            }

            if (! Schema::hasColumn('contractors', 'email')) {
                $table->string('email')->nullable()->after('contact_name');
            }

            if (! Schema::hasColumn('contractors', 'phone_number')) {
                $table->string('phone_number')->nullable()->after('email');
            }
        });

        if (Schema::hasTable('contractor_contacts')) {
            DB::table('contractor_contacts')
                ->where('is_primary', true)
                ->orderBy('id')
                ->get()
                ->each(function (object $contact): void {
                    DB::table('contractors')
                        ->where('id', $contact->contractor_id)
                        ->update([
                            'contact_name' => $contact->name,
                            'email' => $contact->email,
                            'phone_number' => $contact->phone_number,
                        ]);
                });
        }

        Schema::dropIfExists('contractor_contacts');

        Schema::table('contractors', function (Blueprint $table): void {
            $table->dropColumn([
                'website',
                'address_line_1',
                'address_line_2',
                'city',
                'state',
                'postal_code',
                'country',
                'notes',
            ]);
        });
    }
};
