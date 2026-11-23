import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Trash2, Volume2 } from 'lucide-react';
import type { RecordedAudio } from '../types';
import { blobToBase64, formatDuration } from '../utils/media';

interface AudioRecorderProps {
  audio: RecordedAudio | null;
  onChange: (audio: RecordedAudio | null) => void;
  disabled?: boolean;
}

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/wav',
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

export function AudioRecorder({ audio, onChange, disabled = false }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startRecording = async () => {
    if (disabled || isRecording) return;
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Gravação de áudio não suportada neste navegador.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const finalDuration = Math.max(
          1,
          Math.round((Date.now() - startTimeRef.current) / 1000)
        );
        const actualMime = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: actualMime });
        stopStream();

        if (blob.size === 0) {
          setError('Áudio vazio. Tente gravar novamente.');
          return;
        }

        try {
          const base64 = await blobToBase64(blob);
          const previewUrl = URL.createObjectURL(blob);
          if (audio?.previewUrl) {
            URL.revokeObjectURL(audio.previewUrl);
          }
          onChange({
            blob,
            base64,
            mimeType: actualMime,
            previewUrl,
            durationSec: finalDuration,
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Erro ao processar o áudio.');
        }
      };

      recorder.onerror = () => {
        setError('Falha durante a gravação de áudio.');
        setIsRecording(false);
        if (timerRef.current) window.clearInterval(timerRef.current);
        stopStream();
      };

      startTimeRef.current = Date.now();
      setElapsedSec(0);
      setIsRecording(true);
      navigator.vibrate?.(30);

      recorder.start(250);
      timerRef.current = window.setInterval(() => {
        setElapsedSec(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 250);
    } catch (err) {
      stopStream();
      setIsRecording(false);
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Permissão do microfone negada. Libere o acesso nas configurações do navegador.');
      } else {
        setError('Não foi possível acessar o microfone.');
      }
    }
  };

  const stopRecording = () => {
    if (!isRecording || !mediaRecorderRef.current) return;
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    navigator.vibrate?.(25);
    if (mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const clearAudio = () => {
    if (audio?.previewUrl) {
      URL.revokeObjectURL(audio.previewUrl);
    }
    onChange(null);
    setError(null);
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Mic className="w-4 h-4 text-sky-400" />
          <span className="text-sm font-medium text-slate-200">Áudio de Contexto</span>
        </div>
        {isRecording && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-semibold text-rose-400">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            Gravando {formatDuration(elapsedSec)}
          </span>
        )}
        {!isRecording && audio && (
          <span className="text-xs font-medium text-emerald-400">
            Gravado ({formatDuration(audio.durationSec)})
          </span>
        )}
      </div>

      {!audio ? (
        <div className="flex flex-col items-center py-2">
          <div className="relative flex items-center justify-center">
            {isRecording && (
              <span className="absolute inset-0 rounded-full bg-rose-500/40 animate-pulse-ring" />
            )}
            <button
              type="button"
              disabled={disabled}
              onClick={isRecording ? stopRecording : startRecording}
              aria-label={isRecording ? 'Parar gravação' : 'Gravar áudio'}
              className={`relative z-10 flex h-20 w-20 items-center justify-center rounded-full shadow-lg transition-all active:scale-95 disabled:opacity-50 ${
                isRecording
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/60'
                  : 'bg-gradient-to-br from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-sky-950/60'
              }`}
            >
              {isRecording ? (
                <Square className="w-7 h-7 fill-current" />
              ) : (
                <Mic className="w-8 h-8" />
              )}
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-400 text-center">
            {isRecording
              ? 'Toque no botão vermelho para finalizar o áudio'
              : 'Toque para falar sua tarefa, ideia ou contexto'}
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl bg-slate-950/80 border border-slate-800 p-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400">
            <Volume2 className="w-4 h-4" />
          </div>
          <audio
            controls
            src={audio.previewUrl}
            className="h-9 w-full min-w-0 accent-sky-500"
          />
          <button
            type="button"
            disabled={disabled}
            onClick={clearAudio}
            aria-label="Descartar áudio"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-500/15 hover:text-rose-400 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <p className="mt-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}
