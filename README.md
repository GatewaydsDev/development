<p align="center"><a href="https://laravel.com" target="_blank"><img src="https://raw.githubusercontent.com/laravel/art/master/logo-lockup/5%20SVG/2%20CMYK/1%20Full%20Color/laravel-logolockup-cmyk-red.svg" width="400" alt="Laravel Logo"></a></p>

<p align="center">
<a href="https://github.com/laravel/framework/actions"><img src="https://github.com/laravel/framework/workflows/tests/badge.svg" alt="Build Status"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/dt/laravel/framework" alt="Total Downloads"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/v/laravel/framework" alt="Latest Stable Version"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/l/laravel/framework" alt="License"></a>
</p>

## About Laravel

### Print layouts in document editors

The layout designer and bid/quotation layout editors use the same 700px-wide canvas at 100% scale, with shared font defaults. Component coordinates, widths, text wrapping, cell padding, and header height use document pixels rather than the available form width. Narrow screens scroll horizontally instead of resizing the layout. Merge fields show document values, so longer values can wrap while retaining the saved component geometry.

The Print Layout designer has top and left pixel rulers, with ticks every 10px and labels every 50px. Selecting or moving a component updates its ruler markers and X/Y/width readout. Rulers sit outside the document canvas and are not saved or printed.

**Add new layout** opens a choice to **Start blank** or **Choose PDF file → Create layout from PDF**. The PDF option initializes a new, unsaved layout named after the file without overwriting the selected saved layout. After importing, use **Save layout** in the editor header or the floating **Actions** menu; both are available for new and existing layouts. Unsaved-change confirmation still applies before starting a new layout. PDF import is also available in the designer when editing an existing layout. PDF.js runs locally in the browser with a bundled worker, font data, character maps and image decoders; PDF files are not sent to third-party services. Vector table grids and adjoining colored cells become editable tables automatically, preserving column proportions, row heights, rectangular merged cells, cell shading and border colors. Table artwork and selectable text are removed from the lossless page background; only non-table graphics and images remain fixed. Original text stays blank in table cells and text components, with original casing and font sizes. Select a page before adding a component; **Remove page** removes that page's components. Pages, table styles, background assets and font references persist when saving/reloading layouts and loading them into bids/quotations; printed/PDF output keeps page breaks.

PDF import supports up to 10 MB, 20 pages and 1,000 total components. Scanned pages without selectable text, rotated/vertical text, Type 3 fonts, text clipping masks and mixed-color text runs are rejected without replacing the current layout. Text already baked into images or vector outlines cannot be identified or cleared; review each background before saving. Embedded fonts can be subsets containing only original glyphs, and PDFs without reusable fonts use an explicitly reported fallback: review replacement text and choose a standard font when glyphs are unavailable. Word/text section-import modes remain available separately. Original PDF text is not copied into the blank text components.

PDF text longer than two aligned lines with matching font size and color is grouped into one blank paragraph, including regular/bold/italic fragments within the same paragraph. Its textarea has the original number of rows. Original fragment positions, widths, font sizes, font styles, paragraph bounds, and baseline spacing are retained. Enter one replacement line per original line; inline style slots follow the original character ranges, and formatting controls can override imported styles. All-uppercase and all-lowercase paragraphs retain those text-case settings; mixed-case paragraphs keep text as entered. The original words remain cleared. Detected text bullets become blank bullet-list items, including their wrapped line counts. One- and two-line text stays separate; different columns, incompatible sizes/colors, paragraph gaps and outlined table regions are not combined. Review the inferred paragraph/list boundaries before saving, since PDFs do not reliably store paragraph or list semantics. Reimport older layouts to apply the improved detection.

Table properties support alternating backgrounds horizontally (rows) or vertically (columns), with two chosen colors. Grid tables keep an independent first-row header background and text color; body striping starts after the header. Information-table striping takes precedence over name-column shading when enabled. Colors persist through layout loading, document saves, and print output.

Table background, header colors, and alternating colors have swatch dropdowns with named examples and custom colors. A solid table background applies when alternation is off. Selecting vertical alternation starts with light gray instead of white unless a different first color was already chosen; existing saved colors stay unchanged until edited.

Print Layout font controls and all shared rich-text editor font menus offer the same expanded font collection (sans-serif, serif, monospace, and display fonts). Geist is bundled with the application; other fonts use installed system fonts with explicit fallbacks when unavailable. Selected font stacks are retained when loading, saving, and printing documents; system-font availability can differ between browsers and export environments.

Move the pointer to the top edge of a table column and click when the downward selection cursor appears to select every cell in that column, including its header. In the Print Layout designer, font-color controls then apply only to that column; choose **Whole table** to return to table-wide color editing. In bid/quotation text editors, column selection supports text color, font, and font size without changing adjacent columns. Column-selector controls are editor-only and are not saved or printed.

In Print Layouts, select a table and drag a vertical column boundary, or use **Column width (%)** in its properties. Resizing redistributes width between adjacent columns without resizing the table or changing its text. Grid and information tables retain their column proportions when saved, printed, or loaded into bids and quotations.

Every layout component uses its own **Text case** setting, including **As entered**, independently of the layout-wide generated-document casing. Table row and cell overrides still take precedence. Dragging a column boundary keeps the preview in place without selecting or focusing a cell's text editor.

PDF table creation is automatic; there is no manual rebuild step. Reimport older PDF layouts to replace their fixed table graphics with editable tables (reimporting clears replacement text, so preserve any edits first). Detection supports up to 60 rows and 12 columns, including rectangular merged cells. Tables drawn inside bitmap images, irregular merged cells, and unruled/unshaded tables cannot reliably be inferred from PDF graphics; review the import notes and detected cells. Irregular or oversized vector tables produce an explicit import error rather than silently flattening them. Text wraps when columns narrow; saved row heights are minimum heights and grow for longer replacement text.

In document editors, **Move items / Edit text** is in the formatting toolbar. In **Edit text** mode, drag a table column's vertical edge to resize it, or select a cell and enter its **Column width** in pixels in the toolbar (48–4000). Width changes apply to that column across every row, preserve neighboring columns and cell formatting, and persist through saving and printing.

The bid text toolbar includes **Text case**: **As entered**, **UPPERCASE**, **lowercase**, and **camelCase**. Case conversion applies to the selected text, the current paragraph when the cursor has no selection, or the selected table cells; neighboring cells and inline formatting are preserved. Merge fields retain their keys and apply the chosen casing to their displayed/printed values. **As entered** clears inherited casing and field transformations but does not reconstruct text already converted; use **Undo** to reverse a conversion.

Selected-word casing stays local to that selection, including when a PDF-imported paragraph has its own text-transform style. Full-paragraph and cell casing is retained for subsequently inserted merge fields. Loading a Print Layout into a bid or quotation preserves each field's casing, including camelCase, through editing and generated output.

Camel casing preserves words split across bold/italic PDF runs and restarts on each original PDF line. Unicode letters are handled consistently in rich-text editors, layout previews, and server output.

In **Edit text** mode, select a word and use **Bold**/**Italic** or Ctrl/Cmd+B / Ctrl/Cmd+I. Imported PDF fonts retain their original appearance until emphasis is applied; selected text then permits font synthesis so embedded regular fonts can visibly display bold or italic without altering neighboring words.

Print Layout tables support individual cell text formatting. Click the exact cell in the preview, focus its text field in the properties panel, or choose its row and column in **Format text in**. Bold, italic, underline, font, size, color, line spacing, alignment, and text case then apply only to that cell. In information tables the name and value cells are formatted independently, and keep their formatting when their pair moves or another pair is removed. Cell overrides take precedence over row, column, and table/header defaults and persist when loading layouts into bids/quotations and printing. **Reset cell formatting** restores inherited defaults. Row-wide formatting remains available explicitly through the row selector or left-edge control; **Whole table** edits shared defaults without removing existing cell or row overrides.

Select an exact cell in an information or grid table to manage its document fields in properties. **Table fields** identifies the physical row and column; **Field name** adds a document merge field to that cell, and each inserted field has its own **Remove** button. Removing a field preserves surrounding text and the other fields in the cell, without changing neighboring cells or their formatting. **Cell text** allows direct editing and the preview shows sample data. Cell text, including field tokens, is limited to 300 characters. Information-table name and value cells both support fields.

Text component properties also include a **Table field** picker: choose another table in the same layout, a row, and a column, then select **Insert table field**. The inserted `{{table_cell:table-id:row:column}}` reference follows the current source cell text in the designer and resolves when the layout is loaded or printed; merge fields inside the source cell still receive real document values. The text component keeps its own formatting. Coordinates are one-based and refer to the stored table before empty information rows are hidden; information-table columns include both name and value cells. Missing tables/cells produce an explicit `[Missing table cell]` marker and a warning in text properties rather than silently disappearing. Already loaded documents receive source changes through the existing layout-update flow, not automatic replacement of their edits.

Bid and quotation add/edit pages fetch the latest saved layout when a card is selected, including the already-selected card. Quotations have a separate editable layout header; loading it does not replace proposal or pricing text.

While an editor is open, it checks for saved layout changes every five seconds and when the tab becomes active. A custom confirmation offers **Keep current**, **Update without saving**, or **Save changes, then update** when the document has unsaved changes. Saving first persists the current document without leaving the editor; the replacement layout is a draft until the document is saved again. No background checks run on list, detail, or print pages.

Apply database migrations (`php artisan migrate`) before deploying this feature. Each saved document records its loaded layout version so reopening it can detect newer saved layouts. Bid notes, scope text and quotation notes use `LONGTEXT` storage so rich PDF layout content can exceed MySQL's 64 KB `TEXT` limit while retaining the existing 250,000-character validation limit.

The company profile displays company name, company speciality, legal name and email on separate rows. Speciality is optional and supports up to 255 characters; apply database migrations before deploying the profile update. Choose **Company speciality** in print layout, bid, and quotation field menus to insert `{{company_speciality}}` using the saved profile value. Missing or unreadable logos show a no-logo image placeholder instead of a broken image; load failures provide a replacement prompt.

Saved bid text, including autosaved PDF layout cells, resolves document fields against the current project and bid data when printing or exporting. Field names are case-insensitive (`{{PROJECT_NAME}}` and `{{project_name}}` both resolve); rendering leaves the stored editable tokens unchanged.

Table-cell field dropdowns include a **Contractor** group for company, contact, email, phone, address and website. Reusable layouts store contractor tokens; bid editors show only populated contractor details for the selected project's first linked contractor and its primary contact (or first contact if none is primary). These fields resolve from that bid's contractor when saved or printed.

Print Layout **Text properties → Insert a field** uses the same searchable, grouped **Choose a field** menu as Add/Edit Bid. It includes bid totals, project, contractor, company, bid dates, and saved custom fields, while retaining layout-specific document fields. Selecting a field inserts its token at the textarea cursor or replaces the selected text; the actual value is filled when the layout is used in a document.

The **Quotation** field group includes quotation number, title, quoted date, validity date, Base Bid total, and latest revision. These resolve from the current quotation or a bid's linked source quotation, keeping quoted totals separate from the bid's current totals.

Quotations no longer display the separate **Quotation details** editor/content section. Print, PDF, and Word output omit that section as well; proposal text, Pricing Basis, specification tables, and authorization remain. Previously saved details are retained in storage.

Saving a Print Layout replaces its document assignments with the checked options. Unchecked outputs are unassigned; leaving all options unchecked saves the reusable layout without making it a document default. Assignments on other layouts remain unchanged unless you explicitly select their outputs.

Bid and quotation layout pickers list only layouts assigned to at least one output for that document type (print, PDF, or Word). Removing all bid assignments hides the layout from bid selection without deleting it or replacing content already loaded into existing bids.

Laravel is a web application framework with expressive, elegant syntax. We believe development must be an enjoyable and creative experience to be truly fulfilling. Laravel takes the pain out of development by easing common tasks used in many web projects, such as:

- [Simple, fast routing engine](https://laravel.com/docs/routing).
- [Powerful dependency injection container](https://laravel.com/docs/container).
- Multiple back-ends for [session](https://laravel.com/docs/session) and [cache](https://laravel.com/docs/cache) storage.
- Expressive, intuitive [database ORM](https://laravel.com/docs/eloquent).
- Database agnostic [schema migrations](https://laravel.com/docs/migrations).
- [Robust background job processing](https://laravel.com/docs/queues).
- [Real-time event broadcasting](https://laravel.com/docs/broadcasting).

Laravel is accessible, powerful, and provides tools required for large, robust applications.

## Learning Laravel

Laravel has the most extensive and thorough [documentation](https://laravel.com/docs) and video tutorial library of all modern web application frameworks, making it a breeze to get started with the framework.

You may also try the [Laravel Bootcamp](https://bootcamp.laravel.com), where you will be guided through building a modern Laravel application from scratch.

If you don't feel like reading, [Laracasts](https://laracasts.com) can help. Laracasts contains thousands of video tutorials on a range of topics including Laravel, modern PHP, unit testing, and JavaScript. Boost your skills by digging into our comprehensive video library.

## Laravel Sponsors

We would like to extend our thanks to the following sponsors for funding Laravel development. If you are interested in becoming a sponsor, please visit the [Laravel Partners program](https://partners.laravel.com).

### Premium Partners

- **[Vehikl](https://vehikl.com/)**
- **[Tighten Co.](https://tighten.co)**
- **[WebReinvent](https://webreinvent.com/)**
- **[Kirschbaum Development Group](https://kirschbaumdevelopment.com)**
- **[64 Robots](https://64robots.com)**
- **[Curotec](https://www.curotec.com/services/technologies/laravel/)**
- **[Cyber-Duck](https://cyber-duck.co.uk)**
- **[DevSquad](https://devsquad.com/hire-laravel-developers)**
- **[Jump24](https://jump24.co.uk)**
- **[Redberry](https://redberry.international/laravel/)**
- **[Active Logic](https://activelogic.com)**
- **[byte5](https://byte5.de)**
- **[OP.GG](https://op.gg)**

## Contributing

Thank you for considering contributing to the Laravel framework! The contribution guide can be found in the [Laravel documentation](https://laravel.com/docs/contributions).

## Code of Conduct

In order to ensure that the Laravel community is welcoming to all, please review and abide by the [Code of Conduct](https://laravel.com/docs/contributions#code-of-conduct).

## Security Vulnerabilities

If you discover a security vulnerability within Laravel, please send an e-mail to Taylor Otwell via [taylor@laravel.com](mailto:taylor@laravel.com). All security vulnerabilities will be promptly addressed.

## License

The Laravel framework is open-sourced software licensed under the [MIT license](https://opensource.org/licenses/MIT).
