import { dropdownMaxHeight, dropdownOpensUp } from '@/lib/dropdownMenuFrame';
import { cn } from '@/lib/utils';
import { ChevronDownIcon } from 'lucide-react';
import {
    Children,
    CSSProperties,
    isValidElement,
    ReactNode,
    useEffect,
    useId,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';
import { createPortal } from 'react-dom';

type OptionItem = {
    value: string;
    label: string;
    disabled?: boolean;
    style?: CSSProperties;
    group?: string;
};

type ChangeEvent = {
    target: { value: string };
};

function nodeText(node: ReactNode): string {
    if (node == null || typeof node === 'boolean') {
        return '';
    }

    if (typeof node === 'string' || typeof node === 'number') {
        return String(node);
    }

    if (Array.isArray(node)) {
        return node.map(nodeText).join('');
    }

    if (isValidElement<{ children?: ReactNode }>(node)) {
        return nodeText(node.props.children);
    }

    return '';
}

function readOptions(children: ReactNode, group?: string): OptionItem[] {
    return Children.toArray(children).flatMap((child) => {
        if (!isValidElement<{ value?: string | number; disabled?: boolean; style?: CSSProperties; label?: string; children?: ReactNode }>(child)) {
            return [];
        }

        if (child.type === 'optgroup') {
            return readOptions(child.props.children, String(child.props.label ?? ''));
        }

        if (child.type !== 'option') {
            return [];
        }

        return [{
            value: child.props.value == null ? '' : String(child.props.value),
            label: nodeText(child.props.children),
            disabled: child.props.disabled,
            style: child.props.style,
            group,
        }];
    });
}

export default function InspectorSelect({
    id,
    value,
    disabled,
    className,
    style,
    children,
    onChange,
    'aria-label': ariaLabel,
}: {
    id?: string;
    value?: string | number;
    disabled?: boolean;
    className?: string;
    style?: CSSProperties;
    children?: ReactNode;
    onChange?: (event: ChangeEvent) => void;
    'aria-label'?: string;
}) {
    const listId = useId();
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [box, setBox] = useState({ top: 0, left: 0, width: 0, maxHeight: 240 });
    const options = readOptions(children);
    const current = value == null ? '' : String(value);
    const selected = options.find((option) => option.value === current);
    const label = selected?.label || current;

    const place = () => {
        const rect = buttonRef.current?.getBoundingClientRect();

        if (!rect) {
            return;
        }

        const openUp = dropdownOpensUp(rect);
        const maxHeight = dropdownMaxHeight(rect, openUp);

        setBox({
            top: openUp ? Math.max(8, rect.top - maxHeight - 4) : rect.bottom + 4,
            left: rect.left,
            width: rect.width,
            maxHeight,
        });
    };

    useLayoutEffect(() => {
        if (!open) {
            return;
        }

        place();
    }, [open]);

    useEffect(() => {
        if (!open) {
            return;
        }

        const close = (event: MouseEvent) => {
            const target = event.target as Node;

            if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) {
                return;
            }

            setOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };

        window.addEventListener('mousedown', close);
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);
        window.addEventListener('keydown', onKey);

        return () => {
            window.removeEventListener('mousedown', close);
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', place, true);
            window.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const choose = (next: string) => {
        onChange?.({ target: { value: next } });
        setOpen(false);
    };

    let previousGroup = '';

    return (
        <>
            <button
                ref={buttonRef}
                id={id}
                type="button"
                disabled={disabled}
                aria-label={ariaLabel}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={listId}
                style={{ ...style, color: '#0a2540', WebkitTextFillColor: '#0a2540' }}
                className={cn('flex min-h-12 w-full items-center justify-between gap-1 text-left disabled:text-neutral-500', className)}
                onClick={() => {
                    if (!disabled) {
                        setOpen((currentOpen) => !currentOpen);
                    }
                }}
            >
                <span className="min-w-0 flex-1 whitespace-normal break-words py-1 text-left leading-6" style={{ color: '#0a2540', WebkitTextFillColor: '#0a2540' }}>
                    {label || ' '}
                </span>
                <ChevronDownIcon className="size-3.5 shrink-0" style={{ color: '#0a2540' }} />
            </button>
            {open && typeof document !== 'undefined'
                ? createPortal(
                    <div
                        ref={menuRef}
                        id={listId}
                        role="listbox"
                        aria-label={ariaLabel}
                        className="fixed z-[80] overflow-y-auto rounded-md border border-[#b0b0b0] bg-white py-1 text-[#0a2540] shadow-lg"
                        style={{ top: box.top, left: box.left, width: box.width, maxHeight: box.maxHeight }}
                    >
                        {options.map((option) => {
                            const showGroup = option.group && option.group !== previousGroup;
                            previousGroup = option.group ?? previousGroup;
                            const isSelected = option.value === current;

                            return (
                                <div key={`${option.group ?? ''}-${option.value}-${option.label}`}>
                                    {showGroup ? (
                                        <p className="px-2 py-1 text-[11px] font-semibold text-neutral-500">{option.group}</p>
                                    ) : null}
                                    <button
                                        type="button"
                                        role="option"
                                        aria-selected={isSelected}
                                        disabled={option.disabled}
                                        style={{
                                            ...option.style,
                                            color: '#0a2540',
                                            WebkitTextFillColor: '#0a2540',
                                            fontWeight: isSelected ? 700 : 400,
                                            backgroundColor: isSelected ? '#d6e6f8' : undefined,
                                        }}
                                        className="block min-h-12 w-full whitespace-normal break-words bg-white px-2 py-2.5 text-left text-sm leading-6 hover:bg-[#e7f0fb] disabled:text-neutral-400"
                                        onMouseDown={(event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            if (!option.disabled) {
                                                choose(option.value);
                                            }
                                        }}
                                    >
                                        {option.label}
                                    </button>
                                </div>
                            );
                        })}
                    </div>,
                    document.body,
                )
                : null}
        </>
    );
}
