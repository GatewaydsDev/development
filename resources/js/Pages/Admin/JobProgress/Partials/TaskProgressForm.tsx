import { Button } from '@/Components/ui/button';
import PhotoPicker from './PhotoPicker';
import { useForm } from '@inertiajs/react';

type Props = {
    scheduleUuid: string;
    taskUuid: string;
    status: string;
    progress: number;
    statuses: Record<string, string>;
    requiresPhoto: boolean;
    onDone: () => void;
};

export default function TaskProgressForm({
    scheduleUuid,
    taskUuid,
    status,
    progress,
    statuses,
    requiresPhoto,
    onDone,
}: Props) {
    const form = useForm<{
        status: string;
        progress: number;
        notes: string;
        photos: File[];
    }>({ status, progress, notes: '', photos: [] });

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        form.post(
            route('admin.job-progress.tasks.update', [scheduleUuid, taskUuid]),
            { preserveScroll: true, forceFormData: true, onSuccess: onDone },
        );
    };

    const setStatus = (value: string) => {
        form.setData((data) => ({
            ...data,
            status: value,
            progress:
                value === 'completed' ? 100 : value === 'pending' ? 0 : data.progress,
        }));
    };

    return (
        <form
            onSubmit={submit}
            className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm"
        >
            <div className="flex flex-wrap gap-1">
                {Object.entries(statuses).map(([value, label]) => (
                    <button
                        key={value}
                        type="button"
                        onClick={() => setStatus(value)}
                        className={`rounded-md border px-2 py-1 text-xs ${
                            form.data.status === value
                                ? 'border-indigo-600 bg-indigo-600 text-white'
                                : 'border-border hover:bg-muted'
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {form.data.status !== 'completed' && form.data.status !== 'pending' && (
                <label className="flex items-center gap-3">
                    <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={form.data.progress}
                        onChange={(event) =>
                            form.setData('progress', Number(event.target.value))
                        }
                        className="flex-1"
                    />
                    <span className="w-10 text-right font-medium">
                        {form.data.progress}%
                    </span>
                </label>
            )}

            <textarea
                rows={2}
                placeholder="Notes (optional)"
                value={form.data.notes}
                onChange={(event) => form.setData('notes', event.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1.5"
            />

            <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">
                    Photos{requiresPhoto ? ' (required to complete)' : ''}
                </span>
                <PhotoPicker
                    files={form.data.photos}
                    onChange={(files) => form.setData('photos', files)}
                />
                {form.errors.photos && (
                    <span className="text-xs text-red-600">{form.errors.photos}</span>
                )}
            </div>

            <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={form.processing}>
                    Save progress
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={onDone}>
                    Cancel
                </Button>
            </div>
        </form>
    );
}
