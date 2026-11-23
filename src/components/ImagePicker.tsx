import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Info, Trash2 } from 'lucide-react';
import type { CompressedImage } from '../types';
import { compressImage } from '../utils/media';

export interface ImagePickerHandle {
  openCamera: () => void;
}

interface ImagePickerProps {
  image: CompressedImage | null;
  onChange: (image: CompressedImage | null) => void;
  disabled?: boolean;
}

export const ImagePicker = forwardRef<ImagePickerHandle, ImagePickerProps>(
  function ImagePicker({ image, onChange, disabled = false }, ref) {
    const cameraInputRef = useRef<HTMLInputElement | null>(null);
    const galleryInputRef = useRef<HTMLInputElement | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      openCamera: () => {
        if (!disabled && !isProcessing) {
          cameraInputRef.current?.click();
        }
      },
    }));

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Selecione um arquivo de imagem válido.');
      return;
    }

    setError(null);
    setIsProcessing(true);
    try {
      const compressed = await compressImage(file, 1280, 0.8);
      onChange(compressed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar a imagem.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    await handleFile(file);
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-slate-200">Imagem / Print (Contexto)</span>
        </div>
        {isProcessing && <span className="text-xs text-sky-400">Otimizando...</span>}
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleInputChange}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
      />

      {!image ? (
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={disabled || isProcessing}
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-slate-800/70 py-3 px-3 text-sm font-medium text-slate-200 hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <Camera className="w-4 h-4 text-sky-400" />
            <span>Câmera</span>
          </button>
          <button
            type="button"
            disabled={disabled || isProcessing}
            onClick={() => galleryInputRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-slate-800/70 py-3 px-3 text-sm font-medium text-slate-200 hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <ImageIcon className="w-4 h-4 text-amber-400" />
            <span>Galeria / Print</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="relative overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
            <img
              src={image.previewUrl}
              alt="Preview de contexto"
              className="max-h-48 w-full object-contain bg-slate-950"
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(null)}
              aria-label="Remover imagem"
              className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-950/85 text-slate-200 hover:bg-rose-600 hover:text-white shadow-md transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Info className="w-3.5 h-3.5 shrink-0 text-sky-400" />
            Usada apenas pela IA para extrair contexto (não anexada ao Trello).
          </p>
        </div>
      )}

      {!image && (
        <p className="mt-2.5 text-[11px] text-slate-500">
          Dica: você também pode colar (Ctrl+V) um print direto no campo de texto.
        </p>
      )}

      {error && (
        <p className="mt-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
});
