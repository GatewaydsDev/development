<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('internal_chat_groups', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
        });

        Schema::create('internal_chat_group_members', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('internal_chat_group_id');
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('last_read_message_id')->default(0);
            $table->timestamps();

            $table->unique(['internal_chat_group_id', 'user_id'], 'chat_group_member_unique');
            $table->index('user_id');
        });

        Schema::table('internal_messages', function (Blueprint $table) {
            $table->unsignedBigInteger('group_id')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::table('internal_messages', function (Blueprint $table) {
            $table->dropColumn('group_id');
        });
        Schema::dropIfExists('internal_chat_group_members');
        Schema::dropIfExists('internal_chat_groups');
    }
};
