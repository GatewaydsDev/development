<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\BidPricingStatus;
use App\Models\BidStageType;
use App\Models\BidTextField;
use App\Models\BidTextTemplate;
use App\Models\PreBid;
use App\Models\Project;
use App\Models\ProjectScopeType;
use App\Models\User;
use App\Support\BidAccess;
use App\Support\BidApplicationText;
use App\Support\QuotationAccess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class BidCatalogController extends Controller
{
    public function storeStageType(Request $request): RedirectResponse
    {
        $this->authorizeCatalog($request);

        $name = $this->uniqueName($request, BidStageType::class);

        if ($name === null) {
            return back()->with('success', 'Stage already exists.');
        }

        BidStageType::create(['name' => $name]);

        return back()->with('success', 'Stage added successfully.');
    }

    public function storeScope(Request $request): RedirectResponse
    {
        $this->authorizeCatalog($request);

        $name = $this->uniqueName($request, ProjectScopeType::class);

        if ($name === null) {
            return back()->with('success', 'Scope type already exists.');
        }

        ProjectScopeType::create(['name' => $name]);

        return back()->with('success', 'Scope type added successfully.');
    }

    public function storePricingStatus(Request $request): RedirectResponse
    {
        $this->authorizeCatalog($request);

        $name = $this->uniqueName($request, BidPricingStatus::class);

        if ($name === null) {
            return back()->with('success', 'Pricing status already exists.');
        }

        BidPricingStatus::create(['name' => $name]);

        return back()->with('success', 'Pricing status added successfully.');
    }

    public function storePreBid(Request $request): RedirectResponse
    {
        $this->authorizeCatalog($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'project_id' => ['nullable', 'integer', Rule::exists(Project::class, 'id')],
            'assigned_to' => ['nullable', 'integer', Rule::exists(User::class, 'id')],
            'notes' => ['nullable', 'string', 'max:250000'],
            'bid_shipping_text_template_id' => [
                'nullable',
                'integer',
                Rule::exists(BidTextTemplate::class, 'id')->where(
                    fn ($query) => $query->where('kind', BidTextTemplate::KIND_SHIPPING)
                ),
            ],
            'bid_scope_text_template_id' => [
                'nullable',
                'integer',
                Rule::exists(BidTextTemplate::class, 'id')->where(
                    fn ($query) => $query->where('kind', BidTextTemplate::KIND_SCOPE)
                ),
            ],
            'scope_of_work_text' => ['nullable', 'string', 'max:250000'],
            'scopes' => ['nullable', 'array'],
            'stages' => ['nullable', 'array'],
            'revisions' => ['nullable', 'array'],
            'pricings' => ['nullable', 'array'],
        ]);

        $name = trim($validated['name']);

        $existing = PreBid::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->first();

        $attributes = [
            'project_id' => $validated['project_id'] ?? null,
            'assigned_to' => $validated['assigned_to'] ?? null,
            'notes' => BidApplicationText::sanitize($validated['notes'] ?? null),
            'bid_shipping_text_template_id' => $validated['bid_shipping_text_template_id'] ?? null,
            'bid_scope_text_template_id' => $validated['bid_scope_text_template_id'] ?? null,
            'scope_of_work_text' => BidApplicationText::sanitize($validated['scope_of_work_text'] ?? null),
            'scopes' => $validated['scopes'] ?? null,
            'stages' => $validated['stages'] ?? null,
            'revisions' => $validated['revisions'] ?? null,
            'pricings' => $validated['pricings'] ?? null,
            'created_by' => $request->user()->id,
        ];

        if ($existing) {
            $existing->update($attributes);

            return back()->with('success', 'Pre-bid updated successfully.');
        }

        PreBid::create([
            'name' => $name,
            ...$attributes,
        ]);

        return back()->with('success', 'Pre-bid saved successfully.');
    }

    public function destroyPreBid(Request $request, PreBid $preBid): RedirectResponse
    {
        $this->authorizeCatalog($request);

        $preBid->delete();

        return back()->with('success', 'Pre-bid removed successfully.');
    }

    public function storeTextField(Request $request): RedirectResponse
    {
        $this->authorizeCatalog($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'source' => ['required', 'string', Rule::in(array_keys(BidApplicationText::PLACEHOLDERS))],
            'value' => ['nullable', 'string', 'max:5000'],
        ]);

        $name = trim($validated['name']);
        $source = trim($validated['source']);
        $value = trim((string) ($validated['value'] ?? ''));
        $key = BidTextField::keyFromName($name);

        if ($key === '') {
            throw ValidationException::withMessages([
                'name' => 'Use letters or numbers in the field name.',
            ]);
        }

        if (BidTextField::isReservedKey($key)) {
            throw ValidationException::withMessages([
                'name' => 'That field is already in the list. Search for it instead of adding it again.',
            ]);
        }

        $reservedLabel = collect(BidApplicationText::PLACEHOLDERS)
            ->contains(fn (string $label): bool => mb_strtolower($label) === mb_strtolower($name));

        if ($reservedLabel) {
            throw ValidationException::withMessages([
                'name' => 'That field is already in the list. Search for it instead of adding it again.',
            ]);
        }

        $field = BidTextField::query()->where('key', $key)->first();
        $created = $field === null;

        if ($field) {
            $field->update([
                'name' => $name,
                'source' => $source,
                'value' => $value,
            ]);
        } else {
            $field = BidTextField::create([
                'key' => $key,
                'name' => $name,
                'source' => $source,
                'value' => $value,
            ]);
        }

        return back()->with([
            'success' => $created
                ? 'Insert field added successfully.'
                : 'Insert field updated successfully.',
            'created_text_field' => [
                'id' => $field->id,
                'key' => $field->key,
                'name' => $field->name,
                'source' => $field->source,
                'value' => $field->value,
            ],
        ]);
    }

    public function storeTextTemplate(Request $request): RedirectResponse
    {
        $this->authorizeCatalog($request);

        [$name, $body, $kind] = $this->validatedTextTemplate($request);

        $existing = BidTextTemplate::query()
            ->where('kind', $kind)
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->first();

        if ($existing) {
            $existing->update(['body' => $body]);

            return back()->with('success', $this->textTemplateSavedMessage($kind, updated: true));
        }

        BidTextTemplate::create([
            'kind' => $kind,
            'name' => $name,
            'body' => $body,
        ]);

        return back()->with('success', $this->textTemplateSavedMessage($kind, updated: false));
    }

    public function updateTextTemplate(Request $request, BidTextTemplate $bidTextTemplate): RedirectResponse
    {
        $this->authorizeCatalog($request);

        [$name, $body, $kind] = $this->validatedTextTemplate($request);

        $duplicate = BidTextTemplate::query()
            ->where('kind', $kind)
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->whereKeyNot($bidTextTemplate->id)
            ->exists();

        if ($duplicate) {
            return back()->withErrors([
                'name' => match ($kind) {
                    BidTextTemplate::KIND_SHIPPING => 'Another saved shipping and handling text already uses this name.',
                    BidTextTemplate::KIND_QUOTATION_PROPOSAL => 'Another saved quotation already uses this name.',
                    BidTextTemplate::KIND_QUOTATION_PRICING => 'Another saved pricing and conditions text already uses this name.',
                    BidTextTemplate::KIND_QUOTATION_PRICING_BASIS => 'Another saved pricing basis text already uses this name.',
                    default => 'Another saved scope text already uses this name.',
                },
            ]);
        }

        $bidTextTemplate->update([
            'kind' => $kind,
            'name' => $name,
            'body' => $body,
        ]);

        return back()->with('success', $this->textTemplateSavedMessage($kind, updated: true));
    }

    public function importTextTemplate(Request $request): RedirectResponse
    {
        $this->authorizeCatalog($request);

        $request->validate([
            'name' => ['nullable', 'string', 'max:255'],
            'save' => ['nullable', 'boolean'],
            'kind' => ['nullable', 'string', Rule::in(BidTextTemplate::KINDS)],
            'file' => ['required', 'file', 'max:10240'],
        ]);

        $file = $request->file('file');
        $extension = strtolower((string) $file?->getClientOriginalExtension());

        if (
            $file === null
            || ! BidApplicationText::allowsImportExtension($extension)
        ) {
            throw ValidationException::withMessages([
                'file' => 'Import a Word (.doc or .docx) or PDF file. .txt and .html also work.',
            ]);
        }

        $body = BidApplicationText::fromUploadedFile($file);
        $name = trim((string) $request->input('name', ''));

        if ($name === '') {
            $name = BidApplicationText::nameFromFilename($file->getClientOriginalName());
        }

        $kind = $this->textTemplateKind($request);
        $save = $request->boolean('save', true);
        $templateId = null;

        if ($save) {
            $existing = BidTextTemplate::query()
                ->where('kind', $kind)
                ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
                ->first();

            if ($existing) {
                $existing->update(['body' => $body]);
                $templateId = $existing->id;
            } else {
                $templateId = BidTextTemplate::create([
                    'kind' => $kind,
                    'name' => $name,
                    'body' => $body,
                ])->id;
            }
        }

        $flash = $this->importedTextFlash($kind, $save);

        return back()->with([
            'success' => $flash['success'],
            $flash['textKey'] => $body,
            $flash['idKey'] => $templateId,
        ]);
    }

    private function authorizeCatalog(Request $request): void
    {
        abort_unless(
            BidAccess::canCreate($request->user())
            || BidAccess::canUpdate($request->user())
            || QuotationAccess::canCreate($request->user())
            || QuotationAccess::canUpdate($request->user()),
            403,
        );
    }

    /**
     * @param  class-string  $model
     */
    private function uniqueName(Request $request, string $model): ?string
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $name = trim($validated['name']);
        $existing = $model::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->first();

        return $existing ? null : $name;
    }

    /**
     * @return array{0: string, 1: string, 2: string}
     */
    private function validatedTextTemplate(Request $request): array
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'body' => ['nullable', 'string', 'max:250000'],
            'kind' => ['nullable', 'string', Rule::in(BidTextTemplate::KINDS)],
        ]);

        $kind = $this->textTemplateKind($request);
        $body = BidApplicationText::sanitize($validated['body'] ?? null);

        if ($body === null) {
            $body = match ($kind) {
                BidTextTemplate::KIND_SHIPPING => BidApplicationText::sanitize(BidTextTemplate::DEFAULT_SHIPPING_BODY)
                    ?: BidTextTemplate::DEFAULT_SHIPPING_BODY,
                BidTextTemplate::KIND_QUOTATION_PROPOSAL => BidApplicationText::sanitize(BidTextTemplate::DEFAULT_QUOTATION_PROPOSAL_BODY)
                    ?: BidTextTemplate::DEFAULT_QUOTATION_PROPOSAL_BODY,
                BidTextTemplate::KIND_QUOTATION_PRICING => BidApplicationText::sanitize(BidTextTemplate::DEFAULT_QUOTATION_PRICING_BODY)
                    ?: BidTextTemplate::DEFAULT_QUOTATION_PRICING_BODY,
                BidTextTemplate::KIND_QUOTATION_PRICING_BASIS => BidApplicationText::sanitize(BidTextTemplate::DEFAULT_QUOTATION_PRICING_BASIS_BODY)
                    ?: BidTextTemplate::DEFAULT_QUOTATION_PRICING_BASIS_BODY,
                default => BidApplicationText::sanitize(BidTextTemplate::DEFAULT_SCOPE_BODY)
                    ?: BidTextTemplate::DEFAULT_SCOPE_BODY,
            };
        }

        if ($body === null) {
            throw ValidationException::withMessages([
                'body' => 'Enter the bid text before saving it.',
            ]);
        }

        return [trim($validated['name']), $body, $kind];
    }

    private function textTemplateSavedMessage(string $kind, bool $updated): string
    {
        $action = $updated ? 'updated' : 'saved';

        return match ($kind) {
            BidTextTemplate::KIND_SHIPPING => "Shipping and handling text {$action} successfully.",
            BidTextTemplate::KIND_QUOTATION_PROPOSAL => "Quotation text {$action} successfully.",
            BidTextTemplate::KIND_QUOTATION_PRICING => "Pricing and conditions text {$action} successfully.",
            BidTextTemplate::KIND_QUOTATION_PRICING_BASIS => "Pricing basis text {$action} successfully.",
            default => "Scope text {$action} successfully.",
        };
    }

    /**
     * @return array{success: string, textKey: string, idKey: string}
     */
    private function importedTextFlash(string $kind, bool $saved): array
    {
        return match ($kind) {
            BidTextTemplate::KIND_SCOPE => [
                'success' => $saved
                    ? 'Scope text imported and saved.'
                    : 'Scope text imported. Save it if you want to reuse it on other bids.',
                'textKey' => 'imported_scope_text',
                'idKey' => 'imported_scope_text_template_id',
            ],
            BidTextTemplate::KIND_SHIPPING => [
                'success' => $saved
                    ? 'Shipping and handling text imported and saved.'
                    : 'Shipping and handling text imported. Save it if you want to reuse it on other bids.',
                'textKey' => 'imported_shipping_text',
                'idKey' => 'imported_shipping_text_template_id',
            ],
            BidTextTemplate::KIND_QUOTATION_PROPOSAL => [
                'success' => $saved
                    ? 'Quotation text imported and saved.'
                    : 'Quotation text imported. Save it if you want to reuse it on other quotations.',
                'textKey' => 'imported_quotation_proposal_text',
                'idKey' => 'imported_quotation_proposal_text_template_id',
            ],
            BidTextTemplate::KIND_QUOTATION_PRICING => [
                'success' => $saved
                    ? 'Pricing and conditions text imported and saved.'
                    : 'Pricing and conditions text imported. Save it if you want to reuse it on other quotations.',
                'textKey' => 'imported_quotation_pricing_text',
                'idKey' => 'imported_quotation_pricing_text_template_id',
            ],
            BidTextTemplate::KIND_QUOTATION_PRICING_BASIS => [
                'success' => $saved
                    ? 'Pricing basis text imported and saved.'
                    : 'Pricing basis text imported. Save it if you want to reuse it on other quotations.',
                'textKey' => 'imported_quotation_pricing_basis_text',
                'idKey' => 'imported_quotation_pricing_basis_text_template_id',
            ],
            default => [
                'success' => $saved
                    ? 'Scope text imported and saved.'
                    : 'Scope text imported. Save it if you want to reuse it on other bids.',
                'textKey' => 'imported_scope_text',
                'idKey' => 'imported_scope_text_template_id',
            ],
        };
    }

    private function textTemplateKind(Request $request): string
    {
        $kind = trim((string) $request->input('kind', BidTextTemplate::KIND_SCOPE));

        return in_array($kind, BidTextTemplate::KINDS, true)
            ? $kind
            : BidTextTemplate::KIND_SCOPE;
    }
}
