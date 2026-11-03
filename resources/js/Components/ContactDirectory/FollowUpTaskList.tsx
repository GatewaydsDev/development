type Task = { id?: number; title: string };

export default function FollowUpTaskList({ tasks, limit }: { tasks: Task[]; limit?: number }) {
    if (tasks.length === 0) {
        return null;
    }

    const visible = limit ? tasks.slice(0, limit) : tasks;

    return (
        <ol aria-label="Tasks" className="space-y-1.5">
            {visible.map((task, index) => (
                <li key={task.id ?? index} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-semibold text-white">{index + 1}</span>
                    <span className="min-w-0 break-words">{task.title}</span>
                </li>
            ))}
            {limit && tasks.length > limit && <li className="pl-7 text-xs text-muted-foreground">+{tasks.length - limit} more</li>}
        </ol>
    );
}
