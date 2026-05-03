<?php

namespace Database\Seeders;

use App\Models\UserLevel;
use Illuminate\Database\Seeder;

class UserLevelSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        collect([
            'Super Admin',
            'Administrator',
            'Admin',
            'Project Manager',
            'User',
            'Visitor',
        ])->each(function (string $name): void {
            $level = UserLevel::firstOrCreate([
                'name' => $name,
            ]);

            if ($level->permissions === null) {
                $level->forceFill([
                    'permissions' => $level->defaultPermissions(),
                ])->save();
            }
        });
    }
}
