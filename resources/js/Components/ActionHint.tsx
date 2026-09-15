import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/Components/ui/tooltip';
import { type ReactNode } from 'react';

export default function ActionHint({
    hint,
    children,
}: {
    hint: string;
    children: ReactNode;
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className="inline-flex">{children}</span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
                {hint}
            </TooltipContent>
        </Tooltip>
    );
}
