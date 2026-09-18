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

    const inputType = type ?? 'text';
    const enableSpellcheck =
        props.spellCheck ??
        !['email', 'password', 'url', 'tel', 'number', 'date'].includes(
            inputType,
        );

    return (
        <input
            {...props}
            type={inputType}
            spellCheck={enableSpellcheck}
            autoCorrect={enableSpellcheck ? 'on' : 'off'}
            autoCapitalize={enableSpellcheck ? 'sentences' : 'off'}
            className={
                'rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 ' +
                className
            }
            ref={setRefs}
        />
    );
});
