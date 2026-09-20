export type SignatureStyle = {
    id: string;
    label: string;
    fontFamily: string;
    fontSize: number;
};

export const SIGNATURE_STYLES: SignatureStyle[] = [
    { id: 'great-vibes', label: 'Classic', fontFamily: 'Great Vibes', fontSize: 52 },
    { id: 'allura', label: 'Formal', fontFamily: 'Allura', fontSize: 50 },
    { id: 'dancing-script', label: 'Casual', fontFamily: 'Dancing Script', fontSize: 44 },
    { id: 'homemade-apple', label: 'Handwritten', fontFamily: 'Homemade Apple', fontSize: 34 },
    { id: 'sacramento', label: 'Light', fontFamily: 'Sacramento', fontSize: 48 },
    { id: 'alex-brush', label: 'Elegant', fontFamily: 'Alex Brush', fontSize: 48 },
];

export const SIGNATURE_FONT_HREF =
    'https://fonts.googleapis.com/css2?family=Alex+Brush&family=Allura&family=Dancing+Script:wght@500;600&family=Great+Vibes&family=Homemade+Apple&family=Sacramento&display=swap';

export const waitForSignatureFonts = async () => {
    if (typeof document === 'undefined' || !document.fonts) {
        return;
    }

    await Promise.all(
        SIGNATURE_STYLES.map((style) =>
            document.fonts.load(`${style.fontSize}px "${style.fontFamily}"`),
        ),
    );
    await document.fonts.ready;
};

export const renderStyledSignature = async (
    name: string,
    style: SignatureStyle,
): Promise<string | null> => {
    const text = name.trim();

    if (text === '') {
        return null;
    }

    await waitForSignatureFonts();

    const width = 700;
    const height = 176;
    const canvas = document.createElement('canvas');
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);

    const context = canvas.getContext('2d');

    if (!context) {
        return null;
    }

    context.scale(ratio, ratio);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#111827';
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    let fontSize = style.fontSize;
    context.font = `${fontSize}px "${style.fontFamily}"`;

    while (fontSize > 22 && context.measureText(text).width > width - 48) {
        fontSize -= 2;
        context.font = `${fontSize}px "${style.fontFamily}"`;
    }

    context.fillText(text, width / 2, height / 2 + 4);

    return canvas.toDataURL('image/png');
};
