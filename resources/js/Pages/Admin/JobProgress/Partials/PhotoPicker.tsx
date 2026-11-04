import { Button } from '@/Components/ui/button';
import { CameraIcon, ImageIcon } from 'lucide-react';
import { useRef } from 'react';

type Props = {
    files: File[];
    onChange: (files: File[]) => void;
};

export default function PhotoPicker({ files, onChange }: Props) {
    const camera = useRef<HTMLInputElement>(null);
    const gallery = useRef<HTMLInputElement>(null);

    const add = (event: React.ChangeEvent<HTMLInputElement>) => {
        onChange([...files, ...Array.from(event.target.files ?? [])]);
        event.target.value = '';
    };

    return (
        <div className="flex flex-col gap-2">
            <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={add} />
            <input ref={gallery} type="file" accept="image/*" multiple className="hidden" onChange={add} />
            <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" className="h-11 gap-2" onClick={() => camera.current?.click()}>
                    <CameraIcon className="size-4" /> Take photo
                </Button>
                <Button type="button" variant="outline" className="h-11 gap-2" onClick={() => gallery.current?.click()}>
                    <ImageIcon className="size-4" /> From gallery
                </Button>
            </div>
            {files.length > 0 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{files.length} photo(s) ready</span>
                    <button type="button" className="underline" onClick={() => onChange([])}>
                        Clear
                    </button>
                </div>
            )}
        </div>
    );
}
