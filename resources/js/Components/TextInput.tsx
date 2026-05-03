import {
    forwardRef,
    InputHTMLAttributes,
    MutableRefObject,
    useEffect,
    useRef,
} from 'react';

export default forwardRef<
    HTMLInputElement,
    InputHTMLAttributes<HTMLInputElement> & { isFocused?: boolean }
>(function TextInput(
    { type = 'text', className = '', isFocused = false, ...props },
    ref,
) {
    const localRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (isFocused) {
            localRef.current?.focus();
        }
    }, [isFocused]);

    const setRefs = (element: HTMLInputElement | null) => {
        localRef.current = element;

        if (typeof ref === 'function') {
            ref(element);
            return;
        }

        if (ref) {
            (ref as MutableRefObject<HTMLInputElement | null>).current =
                element;
        }
    };

    return (
        <input
            {...props}
            type={type}
            className={
                'rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 ' +
                className
            }
            ref={setRefs}
        />
    );
});
