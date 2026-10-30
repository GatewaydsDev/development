<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\RecordCorrections;
use Illuminate\Database\QueryException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class RecordCorrectionController extends Controller
{
    public function index(Request $request): Response
    {
        $this->authorizeMaster($request);

        $table = (string) $request->query('table', 'contacts');
        $definition = RecordCorrections::find($table);
        abort_unless($definition !== null, 404);

        $search = trim((string) $request->query('search', ''));
        $recordId = $request->filled('record') ? $request->integer('record') : null;
        $selected = $recordId === null ? null : $definition['model']::query()->find($recordId);

        return Inertia::render('Admin/RecordCorrections/Index', [
            'tables' => RecordCorrections::choices(),
            'table' => $table,
            'tableLabel' => $definition['label'],
            'search' => $search,
            'fields' => $definition['fields'],
            'records' => RecordCorrections::paginate($definition, $search),
            'record' => $selected === null ? null : [
                'id' => (int) $selected->getKey(),
                'values' => RecordCorrections::values($selected, $definition),
            ],
        ]);
    }

    public function update(Request $request, string $table, int $record): RedirectResponse
    {
        $this->authorizeMaster($request);

        $definition = RecordCorrections::find($table);
        abort_unless($definition !== null, 404);

        $model = $definition['model']::query()->findOrFail($record);
        abort_unless($model->exists, 404);

        $allowed = array_column($definition['fields'], 'name');
        $data = array_intersect_key(
            RecordCorrections::normalize(
                $definition,
                $request->validate(RecordCorrections::rules($definition)),
            ),
            array_flip($allowed),
        );

        try {
            $model->fill($data)->save();
        } catch (QueryException $exception) {
            if (($exception->errorInfo[0] ?? null) !== '23000') {
                throw $exception;
            }

            throw ValidationException::withMessages([
                $definition['fields'][0]['name'] => 'That value is already used by another record.',
            ]);
        }

        return back()->with('success', 'Existing record updated.');
    }

    private function authorizeMaster(Request $request): void
    {
        $user = $request->user();

        abort_unless($user instanceof User && $user->canCorrectRecords(), 403);
    }
}
