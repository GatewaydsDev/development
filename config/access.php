<?php

use App\Models\UserLevel;

return [
    'permissions' => [
        'view-dashboard' => [
            'name' => 'View dashboard',
            'group' => 'Pages',
            'description' => 'Access the authenticated dashboard page.',
        ],
        'manage-profile' => [
            'name' => 'Manage profile',
            'group' => 'Account',
            'description' => 'Open and update the signed-in user profile.',
        ],
        'view-users' => [
            'name' => 'See all users',
            'group' => 'Administration',
            'description' => 'Open the users list page.',
        ],
        'create-users' => [
            'name' => 'Add new users',
            'group' => 'Administration',
            'description' => 'Open the add user page and create users.',
        ],
        'update-users' => [
            'name' => 'Update users',
            'group' => 'Administration',
            'description' => 'Open edit user pages and save user updates.',
        ],
        'view-company' => [
            'name' => 'View company',
            'group' => 'Administration',
            'description' => 'Open the company profile page.',
        ],
        'manage-access' => [
            'name' => 'Manage access control',
            'group' => 'Administration',
            'description' => 'Grant or deny user level permissions.',
        ],
        'manage-notifications' => [
            'name' => 'Manage notifications',
            'group' => 'Administration',
            'description' => 'Open, update, and delete dashboard notifications.',
        ],
        'manage-projects' => [
            'name' => 'Manage projects',
            'group' => 'Operations',
            'description' => 'Access future project management pages and actions.',
        ],
    ],

    'defaults' => [
        UserLevel::SUPER_ADMIN => [
            'view-dashboard',
            'manage-profile',
            'view-users',
            'create-users',
            'update-users',
            'view-company',
            'manage-access',
            'manage-notifications',
            'manage-projects',
        ],
        UserLevel::ADMINISTRATOR => [
            'view-dashboard',
            'manage-profile',
            'view-company',
            'manage-projects',
        ],
        UserLevel::ADMIN => [
            'view-dashboard',
            'manage-profile',
            'view-company',
        ],
        UserLevel::PROJECT_MANAGER => [
            'view-dashboard',
            'manage-profile',
            'manage-projects',
        ],
        UserLevel::USER => [
            'view-dashboard',
            'manage-profile',
        ],
        UserLevel::VISITOR => [
            'manage-profile',
        ],
    ],
];
