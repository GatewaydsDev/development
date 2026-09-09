<?php

use App\Models\DoorConfiguration;
use App\Models\DoorConstruction;
use App\Models\DoorHanding;
use App\Models\Manufacturer;
use App\Models\Product;
use App\Models\ProductModel;
use App\Models\ProductType;
use App\Models\TaxState;
use App\Models\User;
use App\Models\UserLevel;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

function productAdmin(): User
{
    $level = UserLevel::firstOrCreate([
        'name' => UserLevel::SUPER_ADMIN,
    ]);

    return User::factory()->create([
        'level_id' => $level->id,
    ]);
}

test('the create product page includes reusable part options', function () {
    $admin = productAdmin();

    $this->actingAs($admin)
        ->get(route('admin.products.create'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Products/Create')
            ->has('options.types')
            ->has('options.manufacturers')
            ->has('options.models')
            ->has('options.constructions')
            ->has('options.configurations')
            ->has('options.handings')
            ->has('options.taxStates')
            ->has('options.parts')
        );
});

test('a door can be created with reusable parts', function () {
    $admin = productAdmin();
    $manufacturer = Manufacturer::create(['name' => 'Gateway Door Systems']);
    $doorType = ProductType::firstOrCreateForKind(Product::KIND_DOOR);
    $hinge = Product::create([
        'name' => 'Heavy duty hinge',
        'kind' => Product::KIND_PART,
        'manufacturer_id' => $manufacturer->id,
    ]);

    $response = $this
        ->actingAs($admin)
        ->post(route('admin.products.store'), [
            'product_type_id' => $doorType->id,
            'manufacturer_id' => $manufacturer->id,
            'name' => 'RF Door',
            'description' => 'Radio frequency door assembly',
            'notes' => '',
            'parts' => [
                ['part_id' => $hinge->id],
            ],
        ]);

    $door = Product::query()->where('name', 'RF Door')->with('parts')->firstOrFail();

    $response
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success', 'Product created successfully.')
        ->assertRedirect(route('admin.products.index', ['highlight' => $door->id]));

    expect($door->kind)->toBe(Product::KIND_DOOR);
    expect($door->product_type_id)->toBe($doorType->id);
    expect($door->manufacturer_id)->toBe($manufacturer->id);
    expect($door->parts)->toHaveCount(1);
    expect($door->parts->first()?->name)->toBe('Heavy duty hinge');
});

test('a product can be saved with a money price and sell percentages', function () {
    $admin = productAdmin();
    $manufacturer = Manufacturer::create(['name' => 'Curries']);
    $partType = ProductType::firstOrCreateForKind(Product::KIND_PART);

    $newJersey = TaxState::query()->where('name', 'New Jersey')->firstOrFail();

    $this->actingAs($admin)
        ->post(route('admin.products.store'), [
            'product_type_id' => $partType->id,
            'manufacturer_id' => $manufacturer->id,
            'name' => 'Closer',
            'description' => 'Closer',
            'notes' => '',
            'price' => '1250.50',
            'markup_percent' => '25',
            'min_markup_percent' => '15',
            'tax_state_id' => $newJersey->id,
            'tax_rate' => '6.625',
        ])
        ->assertSessionHasNoErrors();

    $product = Product::query()->where('name', 'Closer')->firstOrFail();

    expect((float) $product->price)->toBe(1250.5);
    expect((float) $product->markup_percent)->toBe(25.0);
    expect((float) $product->min_markup_percent)->toBe(15.0);
    expect($product->tax_state_id)->toBe($newJersey->id);
    expect((float) $newJersey->fresh()->rate)->toBe(6.625);
});

test('state taxes can be created and their percent can be changed', function () {
    $admin = productAdmin();

    $this->actingAs($admin)
        ->post(route('admin.tax-states.store'), [
            'name' => 'Connecticut',
            'rate' => '6.35',
        ])
        ->assertSessionHasNoErrors();

    $this->actingAs($admin)
        ->post(route('admin.tax-states.store'), [
            'name' => 'connecticut',
            'rate' => '6.35',
        ])
        ->assertSessionHasNoErrors();

    $connecticut = TaxState::query()->whereRaw('LOWER(name) = ?', ['connecticut'])->firstOrFail();

    expect(TaxState::query()->whereRaw('LOWER(name) = ?', ['connecticut'])->count())->toBe(1);
    expect((float) $connecticut->rate)->toBe(6.35);

    $manufacturer = Manufacturer::create(['name' => 'Curries']);
    $partType = ProductType::firstOrCreateForKind(Product::KIND_PART);

    $this->actingAs($admin)
        ->post(route('admin.products.store'), [
            'product_type_id' => $partType->id,
            'manufacturer_id' => $manufacturer->id,
            'name' => 'Threshold',
            'description' => 'Threshold',
            'notes' => '',
            'tax_state_id' => $connecticut->id,
            'tax_rate' => '6.99',
        ])
        ->assertSessionHasNoErrors();

    expect((float) $connecticut->fresh()->rate)->toBe(6.99);
});

test('product types can be created and reused', function () {
    $admin = productAdmin();

    $this->actingAs($admin)
        ->post(route('admin.product-types.store'), [
            'name' => 'Blast Door',
        ])
        ->assertSessionHasNoErrors();

    $this->actingAs($admin)
        ->post(route('admin.product-types.store'), [
            'name' => 'blast door',
        ])
        ->assertSessionHasNoErrors();

    $type = ProductType::query()->whereRaw('LOWER(name) = ?', ['blast door'])->first();

    expect(ProductType::query()->whereRaw('LOWER(name) = ?', ['blast door'])->count())->toBe(1);
    expect($type?->allows_parts)->toBeTrue();
});

test('manufacturers can be created and reused on products', function () {
    $admin = productAdmin();

    $this->actingAs($admin)
        ->post(route('admin.manufacturers.store'), [
            'name' => 'Assa Abloy',
        ])
        ->assertSessionHasNoErrors();

    $this->actingAs($admin)
        ->post(route('admin.manufacturers.store'), [
            'name' => 'assa abloy',
        ])
        ->assertSessionHasNoErrors();

    expect(Manufacturer::query()->whereRaw('LOWER(name) = ?', ['assa abloy'])->count())->toBe(1);
});

test('product models can be created and reused', function () {
    $admin = productAdmin();

    $this->actingAs($admin)
        ->post(route('admin.product-models.store'), [
            'name' => 'KriegerShield 40 dB Hollow Metal Door',
        ])
        ->assertSessionHasNoErrors();

    $this->actingAs($admin)
        ->post(route('admin.product-models.store'), [
            'name' => 'kriegershield 40 db hollow metal door',
        ])
        ->assertSessionHasNoErrors();

    expect(ProductModel::query()->whereRaw('LOWER(name) = ?', ['kriegershield 40 db hollow metal door'])->count())->toBe(1);
});

test('door parts are reusable across products', function () {
    $admin = productAdmin();
    $lockset = Product::create([
        'name' => 'Mortise lockset',
        'kind' => Product::KIND_PART,
    ]);
    $firstDoor = Product::create([
        'name' => 'First door',
        'kind' => Product::KIND_DOOR,
    ]);
    $secondDoor = Product::create([
        'name' => 'Second door',
        'kind' => Product::KIND_DOOR,
    ]);

    $firstDoor->parts()->attach($lockset->id);
    $secondDoor->parts()->attach($lockset->id);

    expect($lockset->fresh()->doors)->toHaveCount(2);

    $this->actingAs($admin)
        ->post(route('admin.products.catalog'), [
            'name' => 'mortise lockset',
            'kind' => Product::KIND_PART,
        ])
        ->assertSessionHasNoErrors();

    expect(Product::query()->whereRaw('LOWER(name) = ?', ['mortise lockset'])->count())->toBe(1);
});

test('a door can be created with construction ratings and a specification pdf', function () {
    Storage::fake('public');

    $admin = productAdmin();
    $manufacturer = Manufacturer::create(['name' => 'Overly']);
    $doorType = ProductType::firstOrCreateForKind(Product::KIND_DOOR);
    $metal = DoorConstruction::query()->where('name', 'Metal')->firstOrFail();
    $wood = DoorConstruction::query()->firstOrCreate(['name' => 'Wood']);
    $single = DoorConfiguration::query()->where('name', 'Single')->firstOrFail();
    $double = DoorConfiguration::query()->where('name', 'Double')->firstOrFail();
    $leftHand = DoorHanding::query()->where('name', 'Left Hand')->firstOrFail();
    $rightHand = DoorHanding::query()->where('name', 'Right Hand')->firstOrFail();
    $pdf = UploadedFile::fake()->create('door-spec.pdf', 120, 'application/pdf');

    $this->actingAs($admin)
        ->post(route('admin.products.store'), [
            'product_type_id' => $doorType->id,
            'manufacturer_id' => $manufacturer->id,
            'name' => 'KriegerShield 40 dB Hollow Metal Door',
            'abbreviation' => 'RF-HM-40dB',
            'configurations' => [
                ['configuration_id' => $single->id],
                ['configuration_id' => $double->id],
            ],
            'handings' => [
                ['handing_id' => $leftHand->id],
                ['handing_id' => $rightHand->id],
            ],
            'description' => 'Acoustic door',
            'notes' => 'Shop notes',
            'rf_shielding' => '60 dB',
            'stc_rating' => '52',
            'ada' => '1',
            'fire_label' => '90 min',
            'thickness' => '1 3/4"',
            'spec_pdf' => $pdf,
            'constructions' => [
                ['construction_id' => $metal->id],
                ['construction_id' => $wood->id],
            ],
        ])
        ->assertSessionHasNoErrors();

    $door = Product::query()
        ->where('name', 'KriegerShield 40 dB Hollow Metal Door')
        ->with(['constructions', 'configurations', 'handings'])
        ->firstOrFail();

    expect($door->abbreviation)->toBe('RF-HM-40dB');
    expect($door->configurations->pluck('name')->all())->toEqualCanonicalizing(['Single', 'Double']);
    expect($door->handings->pluck('name')->all())->toEqualCanonicalizing(['Left Hand', 'Right Hand']);
    expect($door->rf_shielding)->toBe('60 dB');
    expect($door->stc_rating)->toBe('52');
    expect((bool) $door->ada)->toBeTrue();
    expect($door->fire_label)->toBe('90 min');
    expect($door->thickness)->toBe('1 3/4"');
    expect($door->spec_pdf_path)->not->toBeNull();
    expect(Storage::disk('public')->exists($door->spec_pdf_path))->toBeTrue();
    expect($door->constructions->pluck('name')->all())->toEqualCanonicalizing(['Metal', 'Wood']);
});

test('door constructions can be created and reused', function () {
    $admin = productAdmin();

    $this->actingAs($admin)
        ->post(route('admin.door-constructions.store'), [
            'name' => 'Composite',
        ])
        ->assertSessionHasNoErrors();

    $this->actingAs($admin)
        ->post(route('admin.door-constructions.store'), [
            'name' => 'composite',
        ])
        ->assertSessionHasNoErrors();

    expect(DoorConstruction::query()->whereRaw('LOWER(name) = ?', ['composite'])->count())->toBe(1);
});

test('door configurations can be created and reused', function () {
    $admin = productAdmin();

    $this->actingAs($admin)
        ->post(route('admin.door-configurations.store'), [
            'name' => 'Paired',
        ])
        ->assertSessionHasNoErrors();

    $this->actingAs($admin)
        ->post(route('admin.door-configurations.store'), [
            'name' => 'paired',
        ])
        ->assertSessionHasNoErrors();

    expect(DoorConfiguration::query()->whereRaw('LOWER(name) = ?', ['paired'])->count())->toBe(1);
});

test('door handings can be created and reused', function () {
    $admin = productAdmin();

    $this->actingAs($admin)
        ->post(route('admin.door-handings.store'), [
            'name' => 'Center Pivot',
        ])
        ->assertSessionHasNoErrors();

    $this->actingAs($admin)
        ->post(route('admin.door-handings.store'), [
            'name' => 'center pivot',
        ])
        ->assertSessionHasNoErrors();

    expect(DoorHanding::query()->whereRaw('LOWER(name) = ?', ['center pivot'])->count())->toBe(1);
});

test('a product model can only belong to one product', function () {
    $admin = productAdmin();
    $manufacturer = Manufacturer::create(['name' => 'Overly']);
    $doorType = ProductType::firstOrCreateForKind(Product::KIND_DOOR);
    $model = ProductModel::create(['name' => 'KriegerShield Exclusive']);

    Product::create([
        'name' => $model->name,
        'product_model_id' => $model->id,
        'kind' => Product::KIND_DOOR,
        'manufacturer_id' => $manufacturer->id,
    ]);

    $this->actingAs($admin)
        ->post(route('admin.products.store'), [
            'product_type_id' => $doorType->id,
            'manufacturer_id' => $manufacturer->id,
            'product_model_id' => $model->id,
        ])
        ->assertSessionHasErrors('product_model_id');

    $this->actingAs($admin)
        ->post(route('admin.products.store'), [
            'product_type_id' => $doorType->id,
            'manufacturer_id' => $manufacturer->id,
            'name' => $model->name,
        ])
        ->assertSessionHasErrors('name');
});

test('a product can be deleted', function () {
    $admin = productAdmin();
    $product = Product::create([
        'name' => 'Temp door',
        'kind' => Product::KIND_DOOR,
    ]);

    $this->actingAs($admin)
        ->delete(route('admin.products.destroy', $product))
        ->assertRedirect(route('admin.products.index'))
        ->assertSessionHas('success', 'Product removed successfully.');

    expect(Product::query()->whereKey($product->id)->exists())->toBeFalse();
});

test('the product list can be printed and exported as pdf or word', function () {
    $admin = productAdmin();
    $manufacturer = Manufacturer::create(['name' => 'Overly']);

    Product::create([
        'name' => 'RF Door Catalog Item',
        'kind' => Product::KIND_DOOR,
        'manufacturer_id' => $manufacturer->id,
        'price' => 1250.5,
    ]);
    Product::create([
        'name' => 'Hidden Closer',
        'kind' => Product::KIND_PART,
        'manufacturer_id' => $manufacturer->id,
    ]);

    $this->actingAs($admin)
        ->get(route('admin.products.print', ['search' => 'RF Door']))
        ->assertOk()
        ->assertSee('Product catalog', false)
        ->assertSee('Gateway Door Systems', false)
        ->assertDontSee('Gateway operations', false)
        ->assertSee('Configuration', false)
        ->assertSee('Door handing', false)
        ->assertSee('RF Door Catalog Item', false)
        ->assertDontSee('Hidden Closer', false);

    $pdf = $this->actingAs($admin)
        ->get(route('admin.products.export.pdf', ['search' => 'RF Door']));

    $pdf->assertOk();
    $pdf->assertHeader('content-disposition');
    expect((string) $pdf->headers->get('content-type'))->toStartWith('application/pdf');
    expect($pdf->getContent())->toStartWith('%PDF');

    $word = $this->actingAs($admin)
        ->get(route('admin.products.export.word'));

    $word->assertOk();
    expect((string) $word->headers->get('content-type'))->toContain('wordprocessingml.document');
    expect((string) $word->headers->get('content-disposition'))->toContain('product-catalog-'.now()->year.'.docx');
});
