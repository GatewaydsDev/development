import { useTheme } from '@/Components/ThemeProvider';
import { Toaster as Sonner, ToasterProps } from 'sonner';

function Toaster({ ...props }: ToasterProps) {
    const { theme = 'system' } = useTheme();

    return (
        <Sonner
            theme={theme as ToasterProps['theme']}
            className="toaster group"
            closeButton
            richColors
            position="top-right"
            style={
                {
                    '--normal-bg': 'var(--popover)',
                    '--normal-text': 'var(--popover-foreground)',
                    '--normal-border': 'var(--border)',
                } as React.CSSProperties
            }
            {...props}
        />
    );
}

export { Toaster };
