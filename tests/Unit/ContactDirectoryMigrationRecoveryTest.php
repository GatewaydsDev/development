<?php

use Illuminate\Database\MySqlConnection;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Grammars\MySqlGrammar;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

uses(TestCase::class);

beforeEach(function () {
    $this->previousConnection = DB::getDefaultConnection();
    config(['database.connections.contact_migration_test' => [
        'driver' => 'sqlite',
        'database' => ':memory:',
        'prefix' => '',
        'foreign_key_constraints' => true,
    ]]);
    DB::setDefaultConnection('contact_migration_test');

    foreach (['users', 'contact_directory_inquiries', 'contact_directory_price_requests', 'contact_directory_price_request_items'] as $name) {
        Schema::create($name, function (Blueprint $table): void {
            $table->id();
        });
        DB::table($name)->insert(['id' => 1]);
    }

    $this->migration = require database_path('migrations/2026_11_02_560000_create_contact_directory_supplier_quotes_table.php');
});

afterEach(function () {
    DB::setDefaultConnection($this->previousConnection);
    DB::purge('contact_migration_test');
});

it('resumes partially created quote tables without losing rows', function (int $createdTables) {
    $this->migration->up();

    DB::table('contact_directory_supplier_quotes')->insert([
        'id' => 1,
        'uuid' => 'quote-preserved',
        'inquiry_id' => 1,
        'created_by' => 1,
    ]);

    if ($createdTables < 3) {
        Schema::drop('contact_directory_price_request_preferred_quotes');
    } else {
        Schema::table('contact_directory_price_request_preferred_quotes', function (Blueprint $table): void {
            $table->dropForeign(['supplier_quote_id']);
            $table->dropUnique('cd_preferred_quote_request_unique');
        });
    }

    if ($createdTables < 2) {
        Schema::drop('contact_directory_supplier_quote_items');
    } else {
        DB::table('contact_directory_supplier_quote_items')->insert([
            'uuid' => 'item-preserved',
            'supplier_quote_id' => 1,
            'description' => 'Existing quote item',
        ]);
        Schema::table('contact_directory_supplier_quote_items', function (Blueprint $table): void {
            $table->dropForeign(['supplier_quote_id']);
            $table->dropForeign(['price_request_item_id']);
            $table->dropIndex('cd_quote_item_position_idx');
        });
        // Earlier code used this name on the wrong table. Keep the valid
        // legacy constraint and verify recovery accepts its definition.
        Schema::table('contact_directory_supplier_quote_items', function (Blueprint $table): void {
            $table->foreign('supplier_quote_id', 'cd_preferred_quote_quote_fk')
                ->references('id')->on('contact_directory_supplier_quotes')
                ->cascadeOnUpdate()->cascadeOnDelete();
        });
    }

    Schema::table('contact_directory_supplier_quotes', function (Blueprint $table): void {
        $table->dropForeign(['inquiry_id']);
        $table->dropUnique('cd_supplier_quote_revision_unique');
        $table->dropUnique('contact_directory_supplier_quotes_uuid_unique');
        $table->dropIndex('cd_supplier_quote_current_idx');
    });

    $this->migration->up();
    // A second retry must be harmless too.
    $this->migration->up();

    expect(DB::table('contact_directory_supplier_quotes')->value('uuid'))->toBe('quote-preserved');
    if ($createdTables >= 2) {
        expect(DB::table('contact_directory_supplier_quote_items')->value('uuid'))->toBe('item-preserved');
    }

    expect(Schema::hasIndex('contact_directory_supplier_quotes', 'cd_supplier_quote_revision_unique'))->toBeTrue()
        ->and(Schema::hasIndex('contact_directory_supplier_quotes', 'contact_directory_supplier_quotes_uuid_unique'))->toBeTrue()
        ->and(Schema::hasIndex('contact_directory_supplier_quote_items', 'cd_quote_item_position_idx'))->toBeTrue()
        ->and(Schema::hasIndex('contact_directory_price_request_preferred_quotes', 'cd_preferred_quote_request_unique'))->toBeTrue()
        ->and(Schema::getForeignKeys('contact_directory_supplier_quotes'))->toHaveCount(3)
        ->and(Schema::getForeignKeys('contact_directory_supplier_quote_items'))->toHaveCount(2)
        ->and(Schema::getForeignKeys('contact_directory_price_request_preferred_quotes'))->toHaveCount(3);
})->with([1, 2, 3]);

it('refuses an unexpected incomplete schema without removing existing data', function () {
    Schema::create('contact_directory_supplier_quotes', function (Blueprint $table): void {
        $table->id();
        $table->string('uuid');
    });
    DB::table('contact_directory_supplier_quotes')->insert(['uuid' => 'do-not-delete']);

    expect(fn () => $this->migration->up())->toThrow(RuntimeException::class, 'column inquiry_id is missing');
    expect(DB::table('contact_directory_supplier_quotes')->value('uuid'))->toBe('do-not-delete');
});

it('adds country to existing phone rows without changing their values and safely retries', function () {
    Schema::create('contact_directory_contact_phone_numbers', function (Blueprint $table): void {
        $table->id();
        $table->string('phone_number', 40);
    });
    DB::table('contact_directory_contact_phone_numbers')->insert(['phone_number' => '+971 50 123 4567']);
    $migration = require database_path('migrations/2026_11_03_000000_add_country_to_contact_directory_phone_numbers.php');
    $migration->up();
    $migration->up();
    $row = DB::table('contact_directory_contact_phone_numbers')->sole();
    expect($row->phone_number)->toBe('+971 50 123 4567')->and($row->country)->toBeNull();
});

it('compiles all contact directory migrations with short and database-unique MySQL identifiers', function () {
    $schema = Schema::getFacadeRoot();
    $statements = [];
    $connection = new MySqlConnection(null);
    $grammar = new MySqlGrammar;

    try {
        Schema::shouldReceive('hasTable')->andReturnFalse();
        Schema::shouldReceive('create')->andReturnUsing(function (string $name, Closure $definition) use (&$statements, $connection, $grammar): void {
            $blueprint = new Blueprint($name);
            $blueprint->create();
            $definition($blueprint);
            array_push($statements, ...$blueprint->toSql($connection, $grammar));
        });

        foreach (glob(database_path('migrations/2026_11_02_5*.php')) as $path) {
            (require $path)->up();
        }
    } finally {
        Schema::swap($schema);
    }

    expect($statements)->not->toBeEmpty();
    $foreignNames = [];
    foreach ($statements as $sql) {
        preg_match_all('/(?:constraint|unique|index|key)\s+`([^`]+)`/i', $sql, $matches);
        foreach ($matches[1] as $identifier) {
            expect(strlen($identifier))->toBeLessThanOrEqual(64);
        }
        preg_match_all('/constraint `([^`]+)` foreign key/i', $sql, $matches);
        array_push($foreignNames, ...$matches[1]);
    }

    expect($foreignNames)->not->toBeEmpty()
        ->and(count(array_unique($foreignNames)))->toBe(count($foreignNames));
});
