<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\DoorConfiguration;
use App\Models\DoorConstruction;
use App\Models\DoorHanding;
use App\Models\Manufacturer;
use App\Models\Product;
use App\Models\ProductModel;
use App\Models\ProductStatePrice;
use App\Models\ProductType;
use App\Models\TaxState;
use App\Models\User;
use App\Support\ProductAccess;
use App\Support\ProductCatalogDocument;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\View\View;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ProductController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless(ProductAccess::canView($request->user()), 403);

        $search = (string) $request->query('search', '');
        $typeId = (int) $request->query('type', 0);
        $highlight = (int) $request->query('highlight', 0);

        return Inertia::render('Admin/Products/Index', [
            'filters' => [
                'search' => $search,
                'type' => $typeId > 0 ? $typeId : '',
                'highlight' => $highlight > 0 ? $highlight : null,
            ],
            'options' => $this->options($request->user()),
            'products' => $this->productListingQuery($request)
                ->when($highlight > 0, function ($query) use ($highlight): void {
                    $query->orderByRaw('CASE WHEN id = ? THEN 0 ELSE 1 END', [$highlight]);
                })
                ->latest()
                ->paginate(10)
                ->withQueryString()
                ->through(fn (Product $product): array => $this->productPayload($product, summary: true)),
        ]);
    }

    public function print(Request $request): View
    {
        abort_unless(ProductAccess::canView($request->user()), 403);

        return view('admin.products.catalog', $this->catalogDocument($request)->viewData(mode: 'print'));
    }

    public function exportPdf(Request $request): HttpResponse
    {
        abort_unless(ProductAccess::canView($request->user()), 403);

        return $this->catalogDocument($request)->pdfResponse();
    }

    public function exportWord(Request $request): BinaryFileResponse
    {
        abort_unless(ProductAccess::canView($request->user()), 403);

        return $this->catalogDocument($request)->wordResponse();
    }

    public function create(Request $request): Response
    {
        abort_unless(ProductAccess::canCreate($request->user()), 403);

        return Inertia::render('Admin/Products/Create', [
            'options' => $this->options($request->user()),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless(ProductAccess::canCreate($request->user()), 403);

        $validated = $this->validatedProduct($request);

        $product = DB::transaction(function () use ($request, $validated): Product {
            $product = Product::create($this->productAttributes($request, $validated));
            $this->syncRelatedCatalogs($product, $validated);

            return $product;
        });

        return redirect()
            ->route('admin.products.index', ['highlight' => $product->id])
            ->with('success', 'Product created successfully.');
    }

    public function storeCatalog(Request $request): RedirectResponse
    {
        abort_unless(
            ProductAccess::canCreate($request->user()) || ProductAccess::canUpdate($request->user()),
            403,
        );

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'kind' => ['nullable', 'string', Rule::in(Product::KINDS)],
            'description' => ['nullable', 'string', 'max:5000'],
        ]);

        $name = trim($validated['name']);
        $existing = Product::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->first();

        if ($existing) {
            return back()->with('success', 'Product already exists.');
        }

        Product::create([
            'name' => $name,
            'kind' => $validated['kind'] ?? Product::KIND_PART,
            'description' => trim((string) ($validated['description'] ?? '')) ?: null,
        ]);

        return back()->with('success', 'Product added successfully.');
    }

    public function storeManufacturer(Request $request): RedirectResponse
    {
        abort_unless(
            ProductAccess::canCreate($request->user()) || ProductAccess::canUpdate($request->user()),
            403,
        );

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $name = trim($validated['name']);
        $existing = Manufacturer::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->first();

        if ($existing) {
            return back()->with('success', 'Manufacturer already exists.');
        }

        Manufacturer::create(['name' => $name]);

        return back()->with('success', 'Manufacturer added successfully.');
    }

    public function storeModel(Request $request): RedirectResponse
    {
        abort_unless(
            ProductAccess::canCreate($request->user()) || ProductAccess::canUpdate($request->user()),
            403,
        );

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $name = trim($validated['name']);
        $existing = ProductModel::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->first();

        if ($existing) {
            return back()->with('success', 'Model already exists.');
        }

        ProductModel::create(['name' => $name]);

        return back()->with('success', 'Model added successfully.');
    }

    public function storeType(Request $request): RedirectResponse
    {
        abort_unless(
            ProductAccess::canCreate($request->user()) || ProductAccess::canUpdate($request->user()),
            403,
        );

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $name = trim($validated['name']);
        $existing = ProductType::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->first();

        if ($existing) {
            return back()->with('success', 'Type already exists.');
        }

        ProductType::create([
            'name' => $name,
            'allows_parts' => ProductType::allowsPartsFromName($name),
        ]);

        return back()->with('success', 'Type added successfully.');
    }

    public function storeConstruction(Request $request): RedirectResponse
    {
        abort_unless(
            ProductAccess::canCreate($request->user()) || ProductAccess::canUpdate($request->user()),
            403,
        );

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $name = trim($validated['name']);
        $existing = DoorConstruction::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->first();

        if ($existing) {
            return back()->with('success', 'Construction already exists.');
        }

        DoorConstruction::create(['name' => $name]);

        return back()->with('success', 'Construction added successfully.');
    }

    public function storeConfiguration(Request $request): RedirectResponse
    {
        abort_unless(
            ProductAccess::canCreate($request->user()) || ProductAccess::canUpdate($request->user()),
            403,
        );

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $name = trim($validated['name']);
        $existing = DoorConfiguration::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->first();

        if ($existing) {
            return back()->with('success', 'Configuration already exists.');
        }

        DoorConfiguration::create(['name' => $name]);

        return back()->with('success', 'Configuration added successfully.');
    }

    public function storeHanding(Request $request): RedirectResponse
    {
        abort_unless(
            ProductAccess::canCreate($request->user()) || ProductAccess::canUpdate($request->user()),
            403,
        );

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $name = trim($validated['name']);
        $existing = DoorHanding::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->first();

        if ($existing) {
            return back()->with('success', 'Handing already exists.');
        }

        DoorHanding::create(['name' => $name]);

        return back()->with('success', 'Handing added successfully.');
    }

    public function storeTaxState(Request $request): RedirectResponse
    {
        abort_unless(
            ProductAccess::canCreate($request->user()) || ProductAccess::canUpdate($request->user()),
            403,
        );

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'rate' => ['nullable', 'numeric', 'min:0', 'max:999.999'],
        ]);

        $name = trim($validated['name']);
        $existing = TaxState::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->first();

        if ($existing) {
            if (array_key_exists('rate', $validated) && $validated['rate'] !== null) {
                $existing->update(['rate' => $validated['rate']]);
            }

            return back()->with('success', 'State tax already exists.');
        }

        TaxState::create([
            'name' => $name,
            'rate' => $validated['rate'] ?? null,
        ]);

        return back()->with('success', 'State tax added successfully.');
    }

    public function show(Request $request, Product $product): Response
    {
        abort_unless(ProductAccess::canView($request->user()), 403);

        $product->load(['manufacturer', 'productModel', 'productType', 'parts', 'doors', 'constructions', 'configurations', 'handings', 'taxState', 'statePrices.taxState']);

        return Inertia::render('Admin/Products/Show', [
            'product' => $this->productPayload($product),
            'options' => $this->options($request->user()),
        ]);
    }

    public function edit(Request $request, Product $product): Response
    {
        abort_unless(ProductAccess::canUpdate($request->user()), 403);

        $product->load(['manufacturer', 'productModel', 'productType', 'parts', 'doors', 'constructions', 'configurations', 'handings', 'taxState', 'statePrices.taxState']);

        return Inertia::render('Admin/Products/Edit', [
            'product' => $this->productPayload($product),
            'options' => $this->options($request->user(), $product),
        ]);
    }

    public function update(Request $request, Product $product): RedirectResponse
    {
        abort_unless(ProductAccess::canUpdate($request->user()), 403);

        $validated = $this->validatedProduct($request, $product);

        DB::transaction(function () use ($request, $product, $validated): void {
            $product->fill($this->productAttributes($request, $validated, $product))->save();
            $this->syncRelatedCatalogs($product, $validated);
        });

        return redirect()
            ->route('admin.products.index', ['highlight' => $product->id])
            ->with('success', 'Product updated successfully.');
    }

    public function destroy(Request $request, Product $product): RedirectResponse
    {
        abort_unless(ProductAccess::canDelete($request->user()), 403);

        $product->delete();

        return redirect()
            ->route('admin.products.index')
            ->with('success', 'Product removed successfully.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validatedProduct(Request $request, ?Product $product = null): array
    {
        $rules = [
            'manufacturer_id' => [
                'required',
                'integer',
                Rule::exists(Manufacturer::class, 'id'),
            ],
            'product_model_id' => [
                'nullable',
                'integer',
                Rule::exists(ProductModel::class, 'id'),
                'required_without:name',
                Rule::unique(Product::class, 'product_model_id')->ignore($product?->id),
            ],
            'name' => [
                'nullable',
                'string',
                'max:255',
                'required_without:product_model_id',
                Rule::unique(Product::class, 'name')->ignore($product?->id),
                function (string $attribute, mixed $value, \Closure $fail) use ($product): void {
                    if (! filled($value)) {
                        return;
                    }

                    $existing = ProductModel::query()
                        ->whereRaw('LOWER(name) = ?', [mb_strtolower(trim((string) $value))])
                        ->first();

                    if (! $existing) {
                        return;
                    }

                    if ($product && (int) $product->product_model_id === (int) $existing->id) {
                        return;
                    }

                    $fail('This model already exists.');
                },
            ],
            'abbreviation' => [
                'nullable',
                'string',
                'max:255',
                Rule::unique(Product::class, 'abbreviation')->ignore($product?->id),
            ],
            'product_type_id' => [
                'required',
                'integer',
                Rule::exists(ProductType::class, 'id'),
            ],
            'description' => ['nullable', 'string', 'max:5000'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'rf_shielding' => ['nullable', 'string', 'max:255'],
            'stc_rating' => ['nullable', 'string', 'max:255'],
            'ada' => ['nullable', 'boolean'],
            'fire_label' => ['nullable', 'string', 'max:255'],
            'thickness' => ['nullable', 'string', 'max:255'],
            'spec_pdf' => ['nullable', 'file', 'mimes:pdf', 'max:10240'],
            'remove_spec_pdf' => ['boolean'],
            'price' => ['nullable', 'numeric', 'min:0', 'max:9999999999.99'],
            'markup_percent' => ['nullable', 'numeric', 'min:0', 'max:999.99'],
            'min_markup_percent' => [
                'nullable',
                'numeric',
                'min:0',
                'max:999.99',
                Rule::when(
                    $request->filled('markup_percent'),
                    ['lte:markup_percent'],
                ),
            ],
            'tax_state_id' => [
                'nullable',
                'integer',
                Rule::exists(TaxState::class, 'id'),
            ],
            'tax_rate' => ['nullable', 'numeric', 'min:0', 'max:999.999'],
            'state_prices' => ['array'],
            'state_prices.*.tax_state_id' => [
                'required',
                'integer',
                'distinct',
                Rule::exists(TaxState::class, 'id'),
            ],
            'state_prices.*.tax_rate' => ['nullable', 'numeric', 'min:0', 'max:999.999'],
            'state_prices.*.price' => ['nullable', 'numeric', 'min:0', 'max:9999999999.99'],
            'state_prices.*.markup_percent' => ['nullable', 'numeric', 'min:0', 'max:999.99'],
            'state_prices.*.min_markup_percent' => [
                'nullable',
                'numeric',
                'min:0',
                'max:999.99',
            ],
            'configurations' => ['array'],
            'configurations.*.configuration_id' => [
                'required',
                'integer',
                'distinct',
                Rule::exists(DoorConfiguration::class, 'id'),
            ],
            'handings' => ['array'],
            'handings.*.handing_id' => [
                'required',
                'integer',
                'distinct',
                Rule::exists(DoorHanding::class, 'id'),
            ],
            'constructions' => ['array'],
            'constructions.*.construction_id' => [
                'required',
                'integer',
                'distinct',
                Rule::exists(DoorConstruction::class, 'id'),
            ],
            'parts' => ['array'],
            'parts.*.part_id' => [
                'required',
                'integer',
                'distinct',
                Rule::exists(Product::class, 'id')->where('kind', Product::KIND_PART),
            ],
        ];

        foreach (array_keys($request->input('state_prices', [])) as $index) {
            $rules["state_prices.{$index}.min_markup_percent"][] = Rule::when(
                $request->filled("state_prices.{$index}.markup_percent"),
                ["lte:state_prices.{$index}.markup_percent"],
            );
        }

        return $request->validate($rules);
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    private function productAttributes(Request $request, array $validated, ?Product $product = null): array
    {
        $type = ProductType::query()->find($validated['product_type_id']);
        $isDoor = (bool) $type?->allows_parts;

        $productModel = isset($validated['product_model_id'])
            ? ProductModel::query()->find($validated['product_model_id'])
            : ProductModel::firstOrCreateByName((string) ($validated['name'] ?? ''));

        $attributes = [
            'manufacturer_id' => $validated['manufacturer_id'],
            'product_type_id' => $validated['product_type_id'],
            'product_model_id' => $productModel?->id,
            'name' => $productModel?->name ?? ($validated['name'] ?? null),
            'abbreviation' => $this->nullableString($validated['abbreviation'] ?? null),
            'description' => $validated['description'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'price' => $isDoor ? null : ($validated['price'] ?? null),
            'markup_percent' => $isDoor ? null : ($validated['markup_percent'] ?? null),
            'min_markup_percent' => $isDoor ? null : ($validated['min_markup_percent'] ?? null),
            'tax_state_id' => $isDoor
                ? null
                : $this->syncTaxState(
                    isset($validated['tax_state_id']) ? (int) $validated['tax_state_id'] : null,
                    $validated['tax_rate'] ?? null,
                ),
            'rf_shielding' => $isDoor ? ($this->nullableString($validated['rf_shielding'] ?? null)) : null,
            'stc_rating' => $isDoor ? ($this->nullableString($validated['stc_rating'] ?? null)) : null,
            'ada' => $isDoor ? $this->nullableBoolean($validated['ada'] ?? null) : null,
            'fire_label' => $isDoor ? ($this->nullableString($validated['fire_label'] ?? null)) : null,
            'thickness' => $isDoor ? ($this->nullableString($validated['thickness'] ?? null)) : null,
        ];

        if (! $isDoor) {
            if ($product?->spec_pdf_path) {
                $product->deleteSpecPdf();
            }

            $attributes['spec_pdf_path'] = null;

            return $attributes;
        }

        if ($request->boolean('remove_spec_pdf') && $product?->spec_pdf_path) {
            $product->deleteSpecPdf();
            $attributes['spec_pdf_path'] = null;
        }

        if ($request->hasFile('spec_pdf')) {
            if ($product?->spec_pdf_path) {
                Storage::disk('public')->delete($product->spec_pdf_path);
            }

            $attributes['spec_pdf_path'] = $request->file('spec_pdf')->store('product-specs', 'public');
        }

        return $attributes;
    }

    private function nullableString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim((string) $value);

        return $trimmed === '' ? null : $trimmed;
    }

    private function nullableBoolean(mixed $value): ?bool
    {
        if ($value === null || $value === '') {
            return null;
        }

        return filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? (bool) $value;
    }

    private function syncTaxState(?int $taxStateId, mixed $rate): ?int
    {
        if (! $taxStateId) {
            return null;
        }

        $taxState = TaxState::query()->find($taxStateId);

        if (! $taxState) {
            return null;
        }

        if ($rate !== null && $rate !== '') {
            $taxState->update(['rate' => $rate]);
        }

        return $taxState->id;
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function syncRelatedCatalogs(Product $product, array $validated): void
    {
        $this->syncParts($product, $validated['parts'] ?? []);
        $this->syncConstructions($product, $validated['constructions'] ?? []);
        $this->syncConfigurations($product, $validated['configurations'] ?? []);
        $this->syncHandings($product, $validated['handings'] ?? []);
        $this->syncStatePrices($product, $validated['state_prices'] ?? []);
    }

    /**
     * @param  array<int, array<string, mixed>>  $parts
     */
    private function syncParts(Product $product, array $parts): void
    {
        if ($product->kind !== Product::KIND_DOOR) {
            $product->parts()->sync([]);

            return;
        }

        $partIds = collect($parts)
            ->pluck('part_id')
            ->filter()
            ->map(fn ($id): int => (int) $id)
            ->reject(fn (int $id): bool => $id === $product->id)
            ->unique()
            ->values()
            ->all();

        $product->parts()->sync($partIds);
    }

    /**
     * @param  array<int, array<string, mixed>>  $constructions
     */
    private function syncConstructions(Product $product, array $constructions): void
    {
        if ($product->kind !== Product::KIND_DOOR) {
            $product->constructions()->sync([]);

            return;
        }

        $constructionIds = collect($constructions)
            ->pluck('construction_id')
            ->filter()
            ->map(fn ($id): int => (int) $id)
            ->unique()
            ->values()
            ->all();

        $product->constructions()->sync($constructionIds);
    }

    /**
     * @param  array<int, array<string, mixed>>  $configurations
     */
    private function syncConfigurations(Product $product, array $configurations): void
    {
        if ($product->kind !== Product::KIND_DOOR) {
            $product->configurations()->sync([]);

            return;
        }

        $configurationIds = collect($configurations)
            ->pluck('configuration_id')
            ->filter()
            ->map(fn ($id): int => (int) $id)
            ->unique()
            ->values()
            ->all();

        $product->configurations()->sync($configurationIds);
    }

    /**
     * @param  array<int, array<string, mixed>>  $handings
     */
    private function syncHandings(Product $product, array $handings): void
    {
        if ($product->kind !== Product::KIND_DOOR) {
            $product->handings()->sync([]);

            return;
        }

        $handingIds = collect($handings)
            ->pluck('handing_id')
            ->filter()
            ->map(fn ($id): int => (int) $id)
            ->unique()
            ->values()
            ->all();

        $product->handings()->sync($handingIds);
    }

    /**
     * @param  array<int, array<string, mixed>>  $statePrices
     */
    private function syncStatePrices(Product $product, array $statePrices): void
    {
        if ($product->kind !== Product::KIND_DOOR) {
            $product->statePrices()->delete();

            return;
        }

        $keptStateIds = [];

        foreach ($statePrices as $row) {
            $taxStateId = $this->syncTaxState(
                isset($row['tax_state_id']) ? (int) $row['tax_state_id'] : null,
                $row['tax_rate'] ?? null,
            );

            if (! $taxStateId || in_array($taxStateId, $keptStateIds, true)) {
                continue;
            }

            $product->statePrices()->updateOrCreate(
                ['tax_state_id' => $taxStateId],
                [
                    'price' => $row['price'] ?? null,
                    'markup_percent' => $row['markup_percent'] ?? null,
                    'min_markup_percent' => $row['min_markup_percent'] ?? null,
                ],
            );

            $keptStateIds[] = $taxStateId;
        }

        if ($keptStateIds === []) {
            $product->statePrices()->delete();

            return;
        }

        $product->statePrices()->whereNotIn('tax_state_id', $keptStateIds)->delete();
    }

    /**
     * @return Builder<Product>
     */
    private function productListingQuery(Request $request): Builder
    {
        $search = (string) $request->query('search', '');
        $typeId = (int) $request->query('type', 0);

        return Product::query()
            ->with([
                'manufacturer:id,name',
                'productModel:id,name',
                'productType:id,name,allows_parts',
                'parts:id,name',
                'doors:id,name',
                'constructions:id,name',
                'configurations:id,name',
                'handings:id,name',
                'taxState:id,name,rate',
                'statePrices.taxState:id,name,rate',
            ])
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($query) use ($search): void {
                    $query
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('abbreviation', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%")
                        ->orWhere('notes', 'like', "%{$search}%")
                        ->orWhere('rf_shielding', 'like', "%{$search}%")
                        ->orWhere('stc_rating', 'like', "%{$search}%")
                        ->orWhere('fire_label', 'like', "%{$search}%")
                        ->orWhereHas('productModel', function ($query) use ($search): void {
                            $query->where('name', 'like', "%{$search}%");
                        })
                        ->orWhereHas('manufacturer', function ($query) use ($search): void {
                            $query->where('name', 'like', "%{$search}%");
                        })
                        ->orWhereHas('productType', function ($query) use ($search): void {
                            $query->where('name', 'like', "%{$search}%");
                        })
                        ->orWhereHas('parts', function ($query) use ($search): void {
                            $query->where('name', 'like', "%{$search}%");
                        })
                        ->orWhereHas('constructions', function ($query) use ($search): void {
                            $query->where('name', 'like', "%{$search}%");
                        })
                        ->orWhereHas('configurations', function ($query) use ($search): void {
                            $query->where('name', 'like', "%{$search}%");
                        })
                        ->orWhereHas('handings', function ($query) use ($search): void {
                            $query->where('name', 'like', "%{$search}%");
                        })
                        ->orWhereHas('statePrices.taxState', function ($query) use ($search): void {
                            $query->where('name', 'like', "%{$search}%");
                        })
                        ->orWhereHas('taxState', function ($query) use ($search): void {
                            $query->where('name', 'like', "%{$search}%");
                        });
                });
            })
            ->when($typeId > 0, fn ($query) => $query->where('product_type_id', $typeId));
    }

    private function catalogDocument(Request $request): ProductCatalogDocument
    {
        $typeId = (int) $request->query('type', 0);
        $type = $typeId > 0 ? ProductType::query()->find($typeId) : null;

        return new ProductCatalogDocument(
            products: $this->productListingQuery($request)->orderBy('name')->get(),
            company: Company::query()->where('is_active', true)->latest()->first(),
            user: $request->user(),
            search: (string) $request->query('search', ''),
            typeId: $typeId > 0 ? $typeId : null,
            typeName: $type?->name,
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function productPayload(Product $product, bool $summary = false): array
    {
        return [
            'id' => $product->id,
            'uuid' => $product->uuid,
            'manufacturer_id' => $product->manufacturer_id,
            'manufacturer' => $product->manufacturer
                ? [
                    'id' => $product->manufacturer->id,
                    'name' => $product->manufacturer->name,
                ]
                : null,
            'product_type_id' => $product->product_type_id,
            'type' => $product->productType
                ? [
                    'id' => $product->productType->id,
                    'name' => $product->productType->name,
                    'allows_parts' => $product->productType->allows_parts,
                ]
                : null,
            'product_model_id' => $product->product_model_id,
            'model' => $product->productModel
                ? [
                    'id' => $product->productModel->id,
                    'name' => $product->productModel->name,
                ]
                : null,
            'name' => $product->name,
            'abbreviation' => $product->abbreviation,
            'configurations' => $product->relationLoaded('configurations')
                ? $product->configurations
                    ->map(fn (DoorConfiguration $configuration): array => [
                        'id' => $configuration->id,
                        'name' => $configuration->name,
                    ])
                    ->values()
                    ->all()
                : [],
            'handings' => $product->relationLoaded('handings')
                ? $product->handings
                    ->map(fn (DoorHanding $handing): array => [
                        'id' => $handing->id,
                        'name' => $handing->name,
                    ])
                    ->values()
                    ->all()
                : [],
            'kind' => $product->kind,
            'description' => $summary ? null : $product->description,
            'notes' => $summary ? null : $product->notes,
            'rf_shielding' => $summary ? null : $product->rf_shielding,
            'stc_rating' => $summary ? null : $product->stc_rating,
            'ada' => $product->ada === null ? null : (bool) $product->ada,
            'fire_label' => $summary ? null : $product->fire_label,
            'thickness' => $summary ? null : $product->thickness,
            'spec_pdf_url' => $product->spec_pdf_path
                ? asset('storage/'.$product->spec_pdf_path)
                : null,
            'spec_pdf_name' => $product->spec_pdf_path
                ? basename($product->spec_pdf_path)
                : null,
            'price' => $product->price,
            'markup_percent' => $summary ? null : $product->markup_percent,
            'min_markup_percent' => $summary ? null : $product->min_markup_percent,
            'tax_state_id' => $product->tax_state_id,
            'tax_state' => $product->taxState
                ? [
                    'id' => $product->taxState->id,
                    'name' => $product->taxState->name,
                    'rate' => $product->taxState->rate === null
                        ? null
                        : (float) $product->taxState->rate,
                ]
                : null,
            'tax_rate' => $product->taxState?->rate === null
                ? null
                : (float) $product->taxState->rate,
            'state_prices' => $product->relationLoaded('statePrices')
                ? $product->statePrices
                    ->map(fn (ProductStatePrice $statePrice): array => [
                        'id' => $statePrice->id,
                        'tax_state_id' => $statePrice->tax_state_id,
                        'tax_state' => $statePrice->taxState
                            ? [
                                'id' => $statePrice->taxState->id,
                                'name' => $statePrice->taxState->name,
                                'rate' => $statePrice->taxState->rate === null
                                    ? null
                                    : (float) $statePrice->taxState->rate,
                            ]
                            : null,
                        'tax_rate' => $statePrice->taxState?->rate === null
                            ? null
                            : (float) $statePrice->taxState->rate,
                        'price' => $statePrice->price,
                        'markup_percent' => $summary ? null : $statePrice->markup_percent,
                        'min_markup_percent' => $summary ? null : $statePrice->min_markup_percent,
                    ])
                    ->values()
                    ->all()
                : [],
            'constructions' => $product->relationLoaded('constructions')
                ? $product->constructions
                    ->map(fn (DoorConstruction $construction): array => [
                        'id' => $construction->id,
                        'name' => $construction->name,
                    ])
                    ->values()
                    ->all()
                : [],
            'part_count' => $product->relationLoaded('parts') ? $product->parts->count() : 0,
            'door_count' => $product->relationLoaded('doors') ? $product->doors->count() : 0,
            'parts' => $product->parts
                ->map(fn (Product $part): array => [
                    'id' => $part->id,
                    'name' => $part->name,
                    'abbreviation' => $part->abbreviation,
                    'description' => $summary ? null : $part->description,
                ])
                ->values()
                ->all(),
            'doors' => $summary
                ? []
                : $product->doors
                    ->map(fn (Product $door): array => [
                        'id' => $door->id,
                        'name' => $door->name,
                        'abbreviation' => $door->abbreviation,
                    ])
                    ->values()
                    ->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function options(?User $user, ?Product $product = null): array
    {
        return [
            'types' => ProductType::query()
                ->orderBy('name')
                ->get(['id', 'name', 'allows_parts'])
                ->map(fn (ProductType $type): array => [
                    'id' => $type->id,
                    'name' => $type->name,
                    'allows_parts' => $type->allows_parts,
                ])
                ->all(),
            'models' => ProductModel::query()
                ->with('product:id,product_model_id')
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (ProductModel $model): array => [
                    'id' => $model->id,
                    'name' => $model->name,
                    'in_use' => $model->product !== null
                        && $model->product->id !== $product?->id,
                ])
                ->all(),
            'manufacturers' => Manufacturer::query()
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (Manufacturer $manufacturer): array => [
                    'id' => $manufacturer->id,
                    'name' => $manufacturer->name,
                ])
                ->all(),
            'configurations' => DoorConfiguration::query()
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (DoorConfiguration $configuration): array => [
                    'id' => $configuration->id,
                    'name' => $configuration->name,
                ])
                ->all(),
            'handings' => DoorHanding::query()
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (DoorHanding $handing): array => [
                    'id' => $handing->id,
                    'name' => $handing->name,
                ])
                ->all(),
            'constructions' => DoorConstruction::query()
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (DoorConstruction $construction): array => [
                    'id' => $construction->id,
                    'name' => $construction->name,
                ])
                ->all(),
            'parts' => Product::query()
                ->where('kind', Product::KIND_PART)
                ->when($product, fn ($query) => $query->where('id', '!=', $product->id))
                ->orderBy('name')
                ->get(['id', 'name', 'abbreviation', 'description'])
                ->map(fn (Product $part): array => [
                    'id' => $part->id,
                    'name' => $part->name,
                    'abbreviation' => $part->abbreviation,
                    'description' => $part->description,
                    'kind' => Product::KIND_PART,
                ])
                ->all(),
            'taxStates' => TaxState::query()
                ->orderBy('name')
                ->get(['id', 'name', 'rate'])
                ->map(fn (TaxState $taxState): array => [
                    'id' => $taxState->id,
                    'name' => $taxState->name,
                    'rate' => $taxState->rate === null ? null : (float) $taxState->rate,
                ])
                ->all(),
            'can' => [
                'create' => $user ? ProductAccess::canCreate($user) : false,
                'update' => $user ? ProductAccess::canUpdate($user) : false,
                'delete' => $user ? ProductAccess::canDelete($user) : false,
            ],
        ];
    }
}
