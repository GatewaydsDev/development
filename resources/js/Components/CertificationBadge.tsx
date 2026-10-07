const certificationColors = [
    { background: '#0284c7', color: '#ffffff' },
    { background: '#7c3aed', color: '#ffffff' },
    { background: '#d97706', color: '#ffffff' },
    { background: '#e11d48', color: '#ffffff' },
    { background: '#0f766e', color: '#ffffff' },
    { background: '#4f46e5', color: '#ffffff' },
    { background: '#ea580c', color: '#ffffff' },
    { background: '#c026d3', color: '#ffffff' },
];

const competentPersonColor = { background: '#059669', color: '#ffffff' };

export default function CertificationBadge({
    id,
    name,
    competent = false,
    className = '',
}: {
    id: number;
    name: string;
    competent?: boolean;
    className?: string;
}) {
    const color = competent
        ? competentPersonColor
        : certificationColors[Math.abs(id) % certificationColors.length];

    return (
        <span
            className={`inline-flex h-5 w-fit items-center rounded-full px-2 text-xs font-medium whitespace-nowrap ${className}`}
            style={{ backgroundColor: color.background, color: color.color }}
        >
            {name}
        </span>
    );
}
