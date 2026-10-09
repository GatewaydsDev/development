export default function PrintLayoutThumbnail({
    headerColor,
    tableColor,
}: {
    headerColor: string;
    tableColor: string;
}) {
    return (
        <div
            className="relative h-32 overflow-hidden border-b border-border bg-slate-100 p-3 dark:bg-slate-950"
            aria-hidden="true"
        >
            <div className="mx-auto h-28 max-w-[13rem] rounded-md border border-slate-200 bg-white p-2 shadow-sm transition-transform duration-300 group-hover:scale-[1.03] dark:border-slate-800">
                <div
                    className="h-8 rounded-sm px-2 py-1.5"
                    style={{ backgroundColor: headerColor }}
                >
                    <div className="h-1 w-12 rounded bg-white/80" />
                    <div className="mt-1 h-1.5 w-20 rounded bg-white/60" />
                </div>
                <div className="absolute bottom-3 right-3 rounded-full bg-white/90 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-500 shadow-sm dark:bg-slate-900/90 dark:text-slate-300">
                    Layout
                </div>
                <div className="mt-2 flex gap-1">
                    <div className="h-1 w-10 rounded bg-slate-200" />
                    <div className="h-1 w-16 rounded bg-slate-100" />
                </div>
                <div className="mt-2 overflow-hidden rounded-sm border border-slate-200">
                    <div
                        className="flex h-3 items-center gap-1 px-1"
                        style={{ backgroundColor: tableColor }}
                    >
                        <div className="h-0.5 w-7 rounded bg-white/80" />
                        <div className="h-0.5 w-5 rounded bg-white/60" />
                        <div className="h-0.5 w-6 rounded bg-white/50" />
                    </div>
                    {[0, 1].map((row) => (
                        <div
                            key={row}
                            className="flex h-3 items-center gap-1 border-t border-slate-100 px-1"
                        >
                            <div className="h-0.5 w-7 rounded bg-slate-200" />
                            <div className="h-0.5 w-5 rounded bg-slate-100" />
                            <div className="h-0.5 w-6 rounded bg-slate-100" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
