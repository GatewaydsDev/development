<?php

namespace App\Support;

use App\Models\BidScopeTitle;
use App\Models\Certification;
use App\Models\Company;
use App\Models\Contact;
use App\Models\Contractor;
use App\Models\ContractorContact;
use App\Models\DoorConfiguration;
use App\Models\DoorConstruction;
use App\Models\DoorHanding;
use App\Models\Employee;
use App\Models\Language;
use App\Models\Manufacturer;
use App\Models\OpeningCategory;
use App\Models\Product;
use App\Models\ProductModel;
use App\Models\ProductType;
use App\Models\Profession;
use App\Models\ProjectStatus;
use App\Models\Service;
use App\Models\Skill;
use App\Models\WindowGlassType;
use App\Models\WindowGlazingType;
use App\Models\WindowSeal;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\Rule;

class RecordCorrections
{
    /**
     * Tables the master supervisor can open and correct.
     * Keys are the public table names. Columns stay limited to the text people type.
     *
     * @return array<string, array{
     *     label: string,
     *     model: class-string<Model>,
     *     search: list<string>,
     *     fields: list<array{name: string, label: string, type: string, required: bool, options: list<array{value: string, label: string}>}>
     * }>
     */
    public static function tables(): array
    {
        return [
            'contacts' => self::define(Contact::class, 'Contacts', [
                self::field('name', 'Name', required: true),
                self::field('email', 'Email', 'email'),
                self::field('phone_number', 'Phone'),
                self::field('company', 'Company'),
                self::field('title', 'Title'),
                self::field('notes', 'Notes', 'textarea'),
                self::field('is_active', 'Active', 'boolean', true),
            ], ['name', 'email', 'company', 'title']),
            'manufacturers' => self::named(Manufacturer::class, 'Manufacturers'),
            'contractors' => self::define(Contractor::class, 'Contractors', [
                self::field('name', 'Name', required: true),
                self::field('role', 'Role', 'select', true, [
                    ['value' => Contractor::ROLE_CONTRACTOR, 'label' => 'Contractor'],
                    ['value' => Contractor::ROLE_OWNER, 'label' => 'Owner of the project'],
                ]),
                self::field('website', 'Website'),
                self::field('address_line_1', 'Address line 1'),
                self::field('address_line_2', 'Address line 2'),
                self::field('city', 'City'),
                self::field('state', 'State'),
                self::field('postal_code', 'Postal code'),
                self::field('country', 'Country'),
                self::field('notes', 'Notes', 'textarea'),
            ], ['name', 'city']),
            'contractor_contacts' => self::define(ContractorContact::class, 'Contractor contacts', [
                self::field('name', 'Name', required: true),
                self::field('title', 'Title'),
                self::field('email', 'Email', 'email'),
                self::field('phone_number', 'Phone'),
                self::field('phone_type', 'Phone type', 'select', false, [
                    ['value' => 'office', 'label' => 'Office'],
                    ['value' => 'mobile', 'label' => 'Mobile'],
                    ['value' => 'fax', 'label' => 'Fax'],
                    ['value' => 'home', 'label' => 'Home'],
                    ['value' => 'other', 'label' => 'Other'],
                ]),
                self::field('notes', 'Notes', 'textarea'),
                self::field('is_primary', 'Primary contact', 'boolean', true),
            ], ['name', 'email', 'title']),
            'companies' => self::define(Company::class, 'Companies', [
                self::field('name', 'Name', required: true),
                self::field('speciality', 'Speciality'),
                self::field('legal_name', 'Legal name'),
                self::field('email', 'Email', 'email'),
                self::field('phone_number', 'Phone'),
                self::field('contact_phone_number', 'Contact phone'),
                self::field('address_line_1', 'Address line 1'),
                self::field('address_line_2', 'Address line 2'),
                self::field('city', 'City'),
                self::field('state', 'State'),
                self::field('postal_code', 'Postal code'),
                self::field('country', 'Country'),
                self::field('website_url', 'Website'),
                self::field('contact_url', 'Contact page'),
                self::field('notes', 'Notes', 'textarea'),
                self::field('is_active', 'Active', 'boolean', true),
            ], ['name', 'legal_name', 'email']),
            'employees' => self::define(Employee::class, 'Employees', [
                self::field('first_name', 'First name', required: true),
                self::field('last_name', 'Last name', required: true),
                self::field('email', 'Email', 'email'),
                self::field('phone_number', 'Phone'),
                self::field('job_title', 'Job title'),
                self::field('department', 'Department'),
                self::field('notes', 'Notes', 'textarea'),
            ], ['first_name', 'last_name', 'email', 'job_title']),
            'products' => self::define(Product::class, 'Products', [
                self::field('name', 'Name', required: true),
                self::field('abbreviation', 'Abbreviation'),
                self::field('description', 'Description', 'textarea'),
                self::field('notes', 'Notes', 'textarea'),
            ], ['name', 'abbreviation']),
            'product_models' => self::named(ProductModel::class, 'Product models'),
            'product_types' => self::named(ProductType::class, 'Product types'),
            'services' => self::define(Service::class, 'Services', [
                self::field('name', 'Name', required: true),
                self::field('description', 'Description', 'textarea'),
            ], ['name']),
            'opening_categories' => self::named(OpeningCategory::class, 'Opening categories'),
            'professions' => self::named(Profession::class, 'Professions'),
            'skills' => self::named(Skill::class, 'Skills'),
            'languages' => self::define(Language::class, 'Languages', [
                self::field('name', 'Name', required: true),
                self::field('abbreviation', 'Abbreviation', required: true),
            ], ['name', 'abbreviation']),
            'certifications' => self::define(Certification::class, 'Certifications', [
                self::field('name', 'Name', required: true),
                self::field('is_competent_person', 'Competent person', 'boolean', true),
            ], ['name']),
            'project_statuses' => self::named(ProjectStatus::class, 'Project statuses'),
            'door_constructions' => self::named(DoorConstruction::class, 'Door constructions'),
            'door_handings' => self::named(DoorHanding::class, 'Door handings'),
            'door_configurations' => self::named(DoorConfiguration::class, 'Door configurations'),
            'window_glass_types' => self::named(WindowGlassType::class, 'Window glass types'),
            'window_glazing_types' => self::named(WindowGlazingType::class, 'Window glazing types'),
            'window_seals' => self::named(WindowSeal::class, 'Window seals'),
            'bid_scope_titles' => self::named(BidScopeTitle::class, 'Bid scope titles'),
        ];
    }

    /**
     * @return list<array{key: string, label: string}>
     */
    public static function choices(): array
    {
        $choices = [];

        foreach (self::tables() as $key => $table) {
            $choices[] = [
                'key' => $key,
                'label' => $table['label'],
            ];
        }

        return $choices;
    }

    /**
     * @return array{
     *     label: string,
     *     model: class-string<Model>,
     *     search: list<string>,
     *     fields: list<array{name: string, label: string, type: string, required: bool, options: list<array{value: string, label: string}>}>
     * }|null
     */
    public static function find(string $key): ?array
    {
        return self::tables()[$key] ?? null;
    }

    /**
     * @param  array{
     *     label: string,
     *     model: class-string<Model>,
     *     search: list<string>,
     *     fields: list<array{name: string, label: string, type: string, required: bool, options: list<array{value: string, label: string}>}>
     * }  $definition
     */
    public static function paginate(array $definition, string $search): LengthAwarePaginator
    {
        $query = $definition['model']::query();
        $term = trim($search);

        if ($term !== '') {
            $like = '%'.addcslashes($term, '%_\\').'%';
            $query->where(function ($inner) use ($definition, $like): void {
                foreach ($definition['search'] as $column) {
                    $inner->orWhere($column, 'like', $like);
                }
            });
        }

        $order = $definition['search'][0];

        return $query
            ->orderBy($order)
            ->orderBy('id')
            ->paginate(25)
            ->withQueryString()
            ->through(fn (Model $record): array => [
                'id' => (int) $record->getKey(),
                'summary' => self::summary($record, $definition),
            ]);
    }

    /**
     * @param  array{
     *     label: string,
     *     model: class-string<Model>,
     *     search: list<string>,
     *     fields: list<array{name: string, label: string, type: string, required: bool, options: list<array{value: string, label: string}>}>
     * }  $definition
     * @return array<string, bool|string>
     */
    public static function values(Model $record, array $definition): array
    {
        $values = [];

        foreach ($definition['fields'] as $field) {
            $value = $record->getAttribute($field['name']);

            if ($field['type'] === 'boolean') {
                $values[$field['name']] = (bool) $value;

                continue;
            }

            $values[$field['name']] = $value === null ? '' : (string) $value;
        }

        return $values;
    }

    /**
     * @param  array{
     *     label: string,
     *     model: class-string<Model>,
     *     search: list<string>,
     *     fields: list<array{name: string, label: string, type: string, required: bool, options: list<array{value: string, label: string}>}>
     * }  $definition
     * @return array<string, mixed>
     */
    public static function rules(array $definition): array
    {
        $rules = [];

        foreach ($definition['fields'] as $field) {
            $column = $field['name'];

            if ($field['type'] === 'boolean') {
                $rules[$column] = ['required', 'boolean'];

                continue;
            }

            if ($field['type'] === 'select') {
                $allowed = array_column($field['options'], 'value');
                $rules[$column] = array_values(array_filter([
                    $field['required'] ? 'required' : 'nullable',
                    'string',
                    $allowed === [] ? null : Rule::in($allowed),
                ]));

                continue;
            }

            $rules[$column] = [
                $field['required'] ? 'required' : 'nullable',
                $field['type'] === 'email' ? 'email' : 'string',
                'max:'.($field['type'] === 'textarea' ? 20000 : 255),
            ];
        }

        return $rules;
    }

    /**
     * @param  array{
     *     fields: list<array{name: string, type: string, required: bool}>
     * }  $definition
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public static function normalize(array $definition, array $data): array
    {
        foreach ($definition['fields'] as $field) {
            if ($field['type'] === 'boolean' || ! array_key_exists($field['name'], $data)) {
                continue;
            }

            if (! $field['required'] && is_string($data[$field['name']]) && trim($data[$field['name']]) === '') {
                $data[$field['name']] = null;
            }
        }

        return $data;
    }

    /**
     * @param  array{search: list<string>}  $definition
     */
    private static function summary(Model $record, array $definition): string
    {
        $parts = [];

        foreach ($definition['search'] as $column) {
            $value = trim((string) $record->getAttribute($column));

            if ($value !== '') {
                $parts[] = $value;
            }
        }

        $summary = implode(' · ', $parts);

        if ($summary === '') {
            return 'Record '.$record->getKey();
        }

        return mb_strlen($summary) > 140 ? mb_substr($summary, 0, 137).'...' : $summary;
    }

    /**
     * @param  class-string<Model>  $model
     * @return array{
     *     label: string,
     *     model: class-string<Model>,
     *     search: list<string>,
     *     fields: list<array{name: string, label: string, type: string, required: bool, options: list<array{value: string, label: string}>}>
     * }
     */
    private static function named(string $model, string $label): array
    {
        return self::define($model, $label, [
            self::field('name', 'Name', required: true),
        ], ['name']);
    }

    /**
     * @param  class-string<Model>  $model
     * @param  list<array{name: string, label: string, type: string, required: bool, options: list<array{value: string, label: string}>}>  $fields
     * @param  list<string>  $search
     * @return array{
     *     label: string,
     *     model: class-string<Model>,
     *     search: list<string>,
     *     fields: list<array{name: string, label: string, type: string, required: bool, options: list<array{value: string, label: string}>}>
     * }
     */
    private static function define(string $model, string $label, array $fields, array $search): array
    {
        return [
            'label' => $label,
            'model' => $model,
            'search' => $search,
            'fields' => $fields,
        ];
    }

    /**
     * @param  list<array{value: string, label: string}>  $options
     * @return array{name: string, label: string, type: string, required: bool, options: list<array{value: string, label: string}>}
     */
    private static function field(
        string $name,
        string $label,
        string $type = 'text',
        bool $required = false,
        array $options = [],
    ): array {
        return [
            'name' => $name,
            'label' => $label,
            'type' => $type,
            'required' => $required,
            'options' => $options,
        ];
    }
}
