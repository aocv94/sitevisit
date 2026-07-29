import { useRef, type ChangeEvent } from 'react';

interface Props {
  onFiles(files: FileList): void;
}

export function CaptureBar({ onFiles }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { files } = event.target;
    if (files && files.length) onFiles(files);
    // Se limpia para que elegir la MISMA foto otra vez vuelva a disparar
    // el change.
    event.target.value = '';
  }

  return (
    <div className="capture">
      <label htmlFor="camIn" className="btn btn-primary">
        Take photo
      </label>
      <input
        id="camIn"
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
      />
      <div style={{ height: 8 }} />
      <label htmlFor="libIn" className="btn btn-ghost">
        Add from gallery
      </label>
      <input
        id="libIn"
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleChange}
      />
    </div>
  );
}
