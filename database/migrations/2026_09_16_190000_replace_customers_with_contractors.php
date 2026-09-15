<?php

use App\Models\UserLevel;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('quotations') && ! Schema::hasColumn('quotations', 'contractor_id')) {
            Schema::table('quotations', function (Blueprint $table): void {
                $table->foreignId('contractor_id')
                    ->nullable()
                    ->after('quotation_number')
                    ->constrained()
                    ->restrictOnDelete();
            });
        }

        if (Schema::hasTable('customers')) {
            $this->migrateCustomersToContractors();
        }

        if (Schema::hasTable('quotations') && Schema::hasColumn('quotations', 'customer_id')) {
            Schema::table('quotations', function (Blueprint $table): void {
                $table->dropConstrainedForeignId('customer_id');
            });
        }

        if (Schema::hasTable('projects') && Schema::hasColumn('projects', 'customer_id')) {
            Schema::table('projects', function (Blueprint $table): void {
                $table->dropConstrainedForeignId('customer_id');
            });
        }

        if (Schema::hasTable('contractor_contacts') && Schema::hasColumn('contractor_contacts', 'customer_contact_id')) {
            Schema::table('contractor_contacts', function (Blueprint $table): void {
                $table->dropConstrainedForeignId('customer_contact_id');
            });
        }

        if (Schema::hasTable('contractors') && Schema::hasColumn('contractors', 'customer_id')) {
            Schema::table('contractors', function (Blueprint $table): void {
                $table->dropConstrainedForeignId('customer_id');
            });
        }

        Schema::dropIfExists('customer_contacts');
        Schema::dropIfExists('customer_contact_roles');
        Schema::dropIfExists('customers');

        $this->removeCustomerPermissions();
    }

    public function down(): void
    {
        // Customer records cannot be restored after this migration.
    }

    private function migrateCustomersToContractors(): void
    {
        $map = [];

        foreach (DB::table('customers')->orderBy('id')->get() as $customer) {
            $map[(int) $customer->id] = $this->contractorIdForCustomer($customer);
        }

        if (Schema::hasTable('projects') && Schema::hasColumn('projects', 'customer_id')) {
            foreach (DB::table('projects')->whereNotNull('customer_id')->get(['id', 'customer_id']) as $project) {
                $contractorId = $map[(int) $project->customer_id] ?? null;

                if (! $contractorId) {
                    continue;
                }

                $exists = DB::table('project_contractor')
                    ->where('project_id', $project->id)
                    ->where('contractor_id', $contractorId)
                    ->exists();

                if (! $exists) {
                    DB::table('project_contractor')->insert([
                        'project_id' => $project->id,
                        'contractor_id' => $contractorId,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }
        }

        if (Schema::hasTable('quotations') && Schema::hasColumn('quotations', 'customer_id')) {
            foreach (DB::table('quotations')->whereNotNull('customer_id')->get(['id', 'customer_id']) as $quotation) {
                $contractorId = $map[(int) $quotation->customer_id] ?? null;

                if (! $contractorId) {
                    continue;
                }

                DB::table('quotations')
                    ->where('id', $quotation->id)
                    ->update(['contractor_id' => $contractorId]);
            }
        }
    }

    private function contractorIdForCustomer(object $customer): int
    {
        $name = trim((string) ($customer->company_name ?: $customer->name ?: 'Contractor'));

        $contractorId = null;

        if (Schema::hasColumn('contractors', 'customer_id')) {
            $contractorId = DB::table('contractors')
                ->where('customer_id', $customer->id)
                ->value('id');
        }

        if (! $contractorId) {
            $contractorId = DB::table('contractors')
                ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
                ->value('id');
        }

        if (! $contractorId) {
            $contractorId = DB::table('contractors')->insertGetId([
                'uuid' => (string) Str::uuid(),
                'name' => $name,
                'address_line_1' => $customer->address_line_1 ?? null,
                'address_line_2' => $customer->address_line_2 ?? null,
                'city' => $customer->city ?? null,
                'state' => $customer->state ?? null,
                'postal_code' => $customer->postal_code ?? null,
                'country' => $customer->country ?? null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $this->copyCustomerContacts((int) $customer->id, (int) $contractorId);

        return (int) $contractorId;
    }

    private function copyCustomerContacts(int $customerId, int $contractorId): void
    {
        if (! Schema::hasTable('customer_contacts')) {
            return;
        }

        foreach (DB::table('customer_contacts')->where('customer_id', $customerId)->orderBy('id')->get() as $contact) {
            $name = trim((string) ($contact->name ?: ''));
            $email = trim((string) ($contact->email ?: ''));
            $phone = trim((string) ($contact->phone_number ?: ''));

            $exists = DB::table('contractor_contacts')
                ->where('contractor_id', $contractorId)
                ->where(function ($query) use ($name, $email, $phone): void {
                    if ($email !== '') {
                        $query->orWhereRaw('LOWER(email) = ?', [mb_strtolower($email)]);
                    }

                    if ($phone !== '') {
                        $query->orWhere('phone_number', $phone);
                    }

                    if ($name !== '') {
                        $query->orWhereRaw('LOWER(name) = ?', [mb_strtolower($name)]);
                    }
                })
                ->exists();

            if ($exists) {
                continue;
            }

            DB::table('contractor_contacts')->insert([
                'uuid' => (string) Str::uuid(),
                'contractor_id' => $contractorId,
                'name' => $name !== '' ? $name : 'Contact',
                'title' => $contact->title ?? null,
                'email' => $email !== '' ? $email : null,
                'phone_number' => $phone !== '' ? $phone : null,
                'notes' => $contact->notes ?? null,
                'is_primary' => (bool) ($contact->is_primary ?? false),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    private function removeCustomerPermissions(): void
    {
        if (! Schema::hasColumn('user_levels', 'permissions')) {
            return;
        }

        UserLevel::query()
            ->get()
            ->each(function (UserLevel $level): void {
                $permissions = $level->permissions ?? [];

                unset(
                    $permissions['view-customers'],
                    $permissions['create-customers'],
                    $permissions['update-customers'],
                    $permissions['delete-customers'],
                    $permissions['manage-customers'],
                );

                $level->forceFill(['permissions' => $permissions])->save();
            });
    }
};
