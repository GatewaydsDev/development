<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->text('mail_signature')->nullable()->after('microsoft_client_secret_id');
            $table->string('mail_header_path')->nullable()->after('mail_signature');
        });

        Schema::create('mail_message_states', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('mailbox');
            $table->char('message_key', 64);
            $table->text('message_id');
            $table->boolean('is_read')->default(false);
            $table->boolean('is_archived')->default(false);
            $table->boolean('counts_in_graph_unread')->nullable();
            $table->string('subject')->nullable();
            $table->string('sender')->nullable();
            $table->text('preview')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'message_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mail_message_states');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['mail_signature', 'mail_header_path']);
        });
    }
};
