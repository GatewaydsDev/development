<?php

namespace App\Http\Controllers\ContactDirectory;

use App\Http\Controllers\Controller;
use App\Http\Requests\ContactDirectory\StoreEmailTemplateRequest;
use App\Http\Requests\ContactDirectory\UpdateEmailTemplateRequest;
use App\Http\Requests\ContactDirectory\PreviewEmailTemplateRequest;
use App\Models\ContactDirectory\EmailTemplate;
use App\Services\ContactDirectory\EmailTemplateRenderer;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class EmailTemplateController extends Controller
{
    public function index(Request $request, EmailTemplateRenderer $renderer): Response
    {
        $filters = $request->only(['search', 'category', 'is_active', 'visibility']);

        $templates = EmailTemplate::query()
            ->visibleTo($request->user())
            ->with(['owner:id,name'])
            ->when((string) ($filters['search'] ?? '') !== '', function ($query) use ($filters): void {
                $search = (string) $filters['search'];
                $query->where(function ($query) use ($search): void {
                    $query->where('name', 'like', "%{$search}%")
                        ->orWhere('subject', 'like', "%{$search}%");
                });
            })
            ->when(! empty($filters['category']), fn ($query): mixed => $query->where('category', (string) $filters['category']))
            ->when(! empty($filters['visibility']), fn ($query): mixed => $query->where('visibility', (string) $filters['visibility']))
            ->when(array_key_exists('is_active', $filters), fn ($query): mixed => $query->where('is_active', (bool) $filters['is_active']))
            ->orderBy('name')
            ->paginate(25)
            ->withQueryString()
            ->through(function (EmailTemplate $template) use ($renderer): EmailTemplate {
                $template->body = $renderer->toHtml($template->body);

                return $template;
            });

        return Inertia::render('ContactDirectory/EmailTemplates/Index', [
            'filters' => $filters,
            'templates' => $templates,
            'categories' => EmailTemplate::CATEGORIES,
            'placeholders' => EmailTemplate::PLACEHOLDERS,
            'starterTemplates' => $this->starterTemplates(),
        ]);
    }

    public function store(StoreEmailTemplateRequest $request): mixed
    {
        $validated = $request->validated();

        $template = EmailTemplate::create([
            ...$validated,
            'owner_id' => $request->user()->id,
        ]);

        return redirect()->route('contact-directory.email-templates.index')->with('success', 'Template created.');
    }

    public function update(UpdateEmailTemplateRequest $request, EmailTemplate $emailTemplate): mixed
    {
        $validated = $request->validated();

        abort_unless($this->canEdit($request->user(), $emailTemplate), 403);

        $emailTemplate->update($validated);

        return back()->with('success', 'Template updated.');
    }

    public function destroy(Request $request, EmailTemplate $emailTemplate): mixed
    {
        abort_unless($this->canEdit($request->user(), $emailTemplate), 403);

        $emailTemplate->delete();

        return back()->with('success', 'Template deleted.');
    }

    private function canEdit(mixed $user, EmailTemplate $template): bool
    {
        return $template->visibility === 'organization' || $template->owner_id === $user->id;
    }

    public function preview(PreviewEmailTemplateRequest $request, EmailTemplate $emailTemplate, EmailTemplateRenderer $renderer): mixed
    {
        $validated = $request->validated();

        $rendered = $renderer->render($emailTemplate, $validated['values'] ?? []);

        return back()->with([
            'rendered' => $rendered,
        ]);
    }

    private function starterTemplates(): array
    {
        return [
            [
                'name' => 'Initial pricing request',
                'category' => 'initial_pricing_request',
                'subject' => 'Pricing request: {{price_request_title}}',
                'body' => self::paragraphs("Hi {{contact_first_name}},\n\nWe're requesting pricing for {{price_request_title}}.\n\nPlease reply with your quotation, including availability and lead time, by {{response_due_date}}.\n\nThank you,\n{{current_user_name}}"),
            ],
            [
                'name' => 'Follow-up: no response',
                'category' => 'follow_up_no_response',
                'subject' => 'Following up on pricing for {{price_request_title}}',
                'body' => self::paragraphs("Hi {{contact_first_name}},\n\nI wanted to follow up on the pricing request we sent for {{price_request_title}}.\n\nCould you confirm whether you can quote this, and when we might expect a response?\n\nThank you,\n{{current_user_name}}"),
            ],
            [
                'name' => 'Revised pricing request',
                'category' => 'revised_pricing_request',
                'subject' => 'Revised pricing request: {{price_request_title}}',
                'body' => self::paragraphs("Hi {{contact_first_name}},\n\nWe've updated the requirements for {{price_request_title}}. Please review the revised details and provide an updated quotation.\n\nThank you,\n{{current_user_name}}"),
            ],
            [
                'name' => 'Lead time and availability request',
                'category' => 'lead_time_availability_request',
                'subject' => 'Lead time and availability: {{inquiry_title}}',
                'body' => self::paragraphs("Hi {{contact_first_name}},\n\nCould you confirm the lead time and current availability for {{inquiry_title}}?\n\nThank you,\n{{current_user_name}}"),
            ],
            [
                'name' => 'Thank you after receiving a quotation',
                'category' => 'thank_you_after_quotation',
                'subject' => 'Thank you for your quotation',
                'body' => self::paragraphs("Hi {{contact_first_name}},\n\nThank you for the quotation for {{inquiry_title}}. We're reviewing it now and will follow up with any questions.\n\nBest regards,\n{{current_user_name}}"),
            ],
        ];
    }

    /** Turn the starter text into the HTML the rich editor stores. */
    private static function paragraphs(string $text): string
    {
        return collect(preg_split('/\n{2,}/', trim($text)))
            ->map(fn (string $block): string => '<p>'.nl2br(e($block)).'</p>')
            ->implode('');
    }
}
