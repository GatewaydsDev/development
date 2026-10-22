import { useEffect, useState } from 'react';

export type FabToolIcon = 'help' | 'ai';

export type FabTool = {
    id: string;
    label: string;
    icon: FabToolIcon;
    order: number;
    onOpen: () => void;
};

const listeners = new Set<() => void>();
const tools = new Map<string, FabTool>();

const notify = () => {
    listeners.forEach((listener) => listener());
};

export function registerFabTool(tool: FabTool) {
    tools.set(tool.id, tool);
    notify();

    return () => {
        if (tools.get(tool.id) === tool) {
            tools.delete(tool.id);
            notify();
        }
    };
}

export function useFabTools() {
    const [list, setList] = useState<FabTool[]>([]);

    useEffect(() => {
        const sync = () => setList([...tools.values()].sort((left, right) => left.order - right.order));
        sync();
        listeners.add(sync);

        return () => {
            listeners.delete(sync);
        };
    }, []);

    return list;
}
