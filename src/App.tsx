import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  History,
  Loader2,
  Send,
  Settings,
  Sparkles,
  Zap,
} from 'lucide-react';
import { AudioRecorder, type AudioRecorderHandle } from './components/AudioRecorder';
import { ImagePicker, type ImagePickerHandle } from './components/ImagePicker';
import { ReviewModal } from './components/ReviewModal';
import { SettingsModal } from './components/SettingsModal';
import { DEFAULT_SETTINGS, STORAGE_KEYS, TRELLO_COLOR_MAP } from './constants';
import { processContextWithGemini } from './services/gemini';
import { createTrelloCard, fetchTrelloLists } from './services/trello';
import type {
  AppSettings,
  CompressedImage,
  GeneratedCard,
  HistoryItem,
  RecordedAudio,
  TrelloList,
} from './types';
import { compressImage } from './utils/media';

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    const merged: AppSettings = {
      ...DEFAULT_SETTINGS,
      ...(JSON.parse(raw) as Partial<AppSettings>),
    };
    if (!merged.geminiModel || merged.geminiModel === 'gemini-2.5-flash') {
      merged.geminiModel = 'gemini-3.8-flash';
    }
    return merged;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function App() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory);
  const [boardLists, setBoardLists] = useState<TrelloList[]>([]);

  const [text, setText] = useState('');
  const [audio, setAudio] = useState<RecordedAudio | null>(null);
  const [image, setImage] = useState<CompressedImage | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingCard, setPendingCard] = useState<GeneratedCard | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successCard, setSuccessCard] = useState<{ title: string; shortUrl: string } | null>(
    null
  );

  const audioRecorderRef = useRef<AudioRecorderHandle | null>(null);
  const imagePickerRef = useRef<ImagePickerHandle | null>(null);
  const noteInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const triggerWidgetAction = (action?: string | null) => {
      if (!action) return;
      (window as { __QUICKTRELLO_PENDING_ACTION__?: string | null }).__QUICKTRELLO_PENDING_ACTION__ =
        null;

      window.setTimeout(() => {
        if (action === 'audio') {
          audioRecorderRef.current?.startRecording();
        } else if (action === 'photo') {
          imagePickerRef.current?.openCamera();
        } else if (action === 'text') {
          noteInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          noteInputRef.current?.focus();
        }
      }, 120);
    };

    const pending = (window as { __QUICKTRELLO_PENDING_ACTION__?: string | null })
      .__QUICKTRELLO_PENDING_ACTION__;
    if (pending) {
      triggerWidgetAction(pending);
    }

    const handleWidgetEvent = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      triggerWidgetAction(customEvent.detail);
    };

    window.addEventListener('quicktrello-widget-action', handleWidgetEvent);
    return () => {
      window.removeEventListener('quicktrello-widget-action', handleWidgetEvent);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
  }, [history]);

  // Carrega listas do quadro padrão silenciosamente para o seletor na revisão rápida
  useEffect(() => {
    if (!settings.trelloApiKey || !settings.trelloToken || !settings.boardId) return;
    fetchTrelloLists(settings.trelloApiKey, settings.trelloToken, settings.boardId)
      .then(setBoardLists)
      .catch(() => {});
  }, [settings.trelloApiKey, settings.trelloToken, settings.boardId]);

  const isTrelloReady = Boolean(
    settings.trelloApiKey.trim() && settings.trelloToken.trim() && settings.listId
  );
  const isGeminiReady = Boolean(settings.geminiApiKey.trim());
  const hasAnyInput = Boolean(text.trim() || audio || image);
  const activeCover = TRELLO_COLOR_MAP[settings.coverColor];

  const clearInputs = () => {
    setText('');
    if (audio?.previewUrl) {
      URL.revokeObjectURL(audio.previewUrl);
    }
    setAudio(null);
    setImage(null);
  };

  const submitCardToTrello = async (cardToCreate: GeneratedCard) => {
    setIsCreating(true);
    setErrorMsg(null);
    try {
      const created = await createTrelloCard(settings, cardToCreate);
      navigator.vibrate?.([40, 40, 80]);

      const listName =
        boardLists.find((l) => l.id === cardToCreate.listId)?.name || settings.listName;

      const newHistoryItem: HistoryItem = {
        id: created.id,
        title: created.name,
        shortUrl: created.shortUrl || created.url,
        createdAt: new Date().toISOString(),
        coverColor: cardToCreate.coverColor,
        listName,
      };

      setHistory((prev) => [newHistoryItem, ...prev].slice(0, 15));
      setSuccessCard({ title: created.name, shortUrl: created.shortUrl || created.url });
      setPendingCard(null);
      clearInputs();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao criar card no Trello.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleGenerateWithAI = async () => {
    setErrorMsg(null);
    setSuccessCard(null);

    if (!isTrelloReady) {
      setIsSettingsOpen(true);
      setErrorMsg('Configure sua conta do Trello, Quadro e Lista primeiro.');
      return;
    }

    if (!isGeminiReady) {
      setIsSettingsOpen(true);
      setErrorMsg('Configure sua Gemini API Key para processar áudio, imagem e texto com IA.');
      return;
    }

    if (!hasAnyInput) {
      setErrorMsg('Digite uma nota, grave um áudio ou selecione uma imagem.');
      return;
    }

    setIsGenerating(true);
    setGenerationStatus(null);
    try {
      const generated = await processContextWithGemini({
        text,
        audioBase64: audio?.base64,
        audioMimeType: audio?.mimeType,
        imageBase64: image?.base64,
        imageMimeType: image?.mimeType,
        settings,
        onStatusUpdate: setGenerationStatus,
      });

      const cardDraft: GeneratedCard = {
        title: generated.title,
        description: generated.description,
        coverColor: settings.coverColor,
        listId: settings.listId,
        cardPos: settings.cardPos,
      };

      if (settings.directSend) {
        await submitCardToTrello(cardDraft);
      } else {
        setPendingCard(cardDraft);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao processar contexto com a IA.');
    } finally {
      setIsGenerating(false);
      setGenerationStatus(null);
    }
  };

  const handleQuickTextOnly = async () => {
    setErrorMsg(null);
    setSuccessCard(null);

    if (!isTrelloReady) {
      setIsSettingsOpen(true);
      setErrorMsg('Configure sua conta do Trello, Quadro e Lista primeiro.');
      return;
    }

    const lines = text
      .trim()
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) return;

    const title = lines[0].slice(0, 120);
    const description = lines.slice(1).join('\n');

    const cardDraft: GeneratedCard = {
      title,
      description,
      coverColor: settings.coverColor,
      listId: settings.listId,
      cardPos: settings.cardPos,
    };

    if (settings.directSend) {
      await submitCardToTrello(cardDraft);
    } else {
      setPendingCard(cardDraft);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          try {
            const compressed = await compressImage(file, 1280, 0.8);
            setImage(compressed);
          } catch {
            setErrorMsg('Não foi possível colar a imagem.');
          }
          break;
        }
      }
    }
  };

  const toggleDirectSend = () => {
    setSettings((prev) => ({ ...prev, directSend: !prev.directSend }));
  };

  return (
    <div className="h-[100dvh] overflow-hidden bg-slate-950 text-slate-100 flex flex-col">
      {/* Header fixo */}
      <header className="shrink-0 z-30 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <img src="/icon.svg" alt="QuickTrello" className="h-9 w-9 rounded-xl shadow" />
            <div>
              <h1 className="text-base font-bold tracking-tight text-white leading-tight">
                QuickTrello
              </h1>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: activeCover.hex }}
                />
                <span className="truncate max-w-[190px]">
                  {isTrelloReady
                    ? `${settings.boardName || 'Quadro'} → ${settings.listName || 'Lista'}`
                    : 'Toque na engrenagem para configurar'}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Abrir configurações"
            className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
              !isTrelloReady || !isGeminiReady
                ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
                : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Settings className="w-5 h-5" />
            {(!isTrelloReady || !isGeminiReady) && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-400" />
            )}
          </button>
        </div>
      </header>

      {/* Conteúdo principal */}
      <main className="mx-auto w-full max-w-lg flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3.5 pb-12">
        {/* Banner de configuração pendente */}
        {(!isTrelloReady || !isGeminiReady) && (
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="w-full flex items-center justify-between rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left transition-colors hover:bg-amber-500/15"
          >
            <div className="pr-3">
              <p className="text-xs font-semibold text-amber-300">Configuração inicial pendente</p>
              <p className="text-[11px] text-amber-200/80 mt-0.5">
                {!isTrelloReady
                  ? 'Conecte sua API Key/Token do Trello e escolha sua Lista padrão.'
                  : 'Adicione sua Gemini API Key para processar áudio e imagem.'}
              </p>
            </div>
            <span className="shrink-0 rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-semibold text-slate-950">
              Configurar
            </span>
          </button>
        )}

        {/* Alertas de Feedback */}
        {errorMsg && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-200">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <p className="flex-1">{errorMsg}</p>
          </div>
        )}

        {successCard && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5">
            <div className="flex items-start gap-2.5 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-emerald-300">Card criado no Trello!</p>
                <p className="text-xs text-slate-200 truncate">{successCard.title}</p>
              </div>
            </div>
            <a
              href={successCard.shortUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30"
            >
              Abrir <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* 1. Gravador de Áudio */}
        <AudioRecorder
          ref={audioRecorderRef}
          audio={audio}
          onChange={setAudio}
          disabled={isGenerating || isCreating}
        />

        {/* 2. Imagem / Print de Contexto */}
        <ImagePicker
          ref={imagePickerRef}
          image={image}
          onChange={setImage}
          disabled={isGenerating || isCreating}
        />

        {/* 3. Nota / Texto */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <label htmlFor="quick-note" className="block text-sm font-medium text-slate-200 mb-2">
            Texto / Nota Rápida
          </label>
          <textarea
            ref={noteInputRef}
            id="quick-note"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={handlePaste}
            onFocus={(e) => {
              const target = e.currentTarget;
              window.setTimeout(() => {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 250);
            }}
            disabled={isGenerating || isCreating}
            placeholder="Digite um resumo, link ou complemente o áudio/foto... (Ctrl+V cola print)"
            className="w-full rounded-xl border border-slate-800 bg-slate-950/90 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none resize-y"
          />
        </div>

        {/* Toggle Envio Direto + Botão Principal */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={toggleDirectSend}
              className="flex items-center gap-2 text-xs text-slate-300"
            >
              <span
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                  settings.directSend ? 'bg-sky-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    settings.directSend ? 'translate-x-4.5' : 'translate-x-1'
                  }`}
                />
              </span>
              <span className="flex items-center gap-1 font-medium">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Envio Direto (pular revisão)
              </span>
            </button>

            <span className="text-[11px] text-slate-500">
              Capa: <strong className="text-slate-300">{activeCover.label}</strong>
            </span>
          </div>

          <button
            type="button"
            disabled={!hasAnyInput || isGenerating || isCreating}
            onClick={handleGenerateWithAI}
            className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 py-4 px-5 text-base font-semibold text-white shadow-xl shadow-blue-950/50 active:scale-[0.98] transition-all disabled:opacity-40 disabled:active:scale-100"
          >
            {isGenerating || isCreating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>
                  {isGenerating
                    ? generationStatus || 'Processando com Gemini...'
                    : 'Criando no Trello...'}
                </span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>
                  {settings.directSend
                    ? 'Processar com IA e Criar Direto'
                    : 'Gerar Card com IA'}
                </span>
              </>
            )}
          </button>

          {text.trim() && !audio && !image && (
            <button
              type="button"
              disabled={isGenerating || isCreating}
              onClick={handleQuickTextOnly}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 py-2.5 text-xs font-medium text-slate-300 transition-colors disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Criar direto do texto (sem usar IA)</span>
            </button>
          )}
        </div>

        {/* Histórico Recente */}
        {history.length > 0 && (
          <section className="pt-4 space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <History className="w-3.5 h-3.5" />
                Criados Recentemente
              </h2>
              <button
                type="button"
                onClick={() => setHistory([])}
                className="text-[11px] text-slate-500 hover:text-slate-300"
              >
                Limpar
              </button>
            </div>

            <div className="space-y-2">
              {history.slice(0, 6).map((item) => {
                const colorHex = TRELLO_COLOR_MAP[item.coverColor]?.hex || '#579dff';
                return (
                  <a
                    key={item.id}
                    href={item.shortUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-xl border border-slate-800/90 bg-slate-900/60 px-3.5 py-2.5 hover:bg-slate-900 transition-colors"
                  >
                    <span
                      className="h-7 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: colorHex }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-200 truncate">{item.title}</p>
                      <p className="text-[10px] text-slate-500">
                        {item.listName ? `${item.listName} • ` : ''}
                        {new Date(item.createdAt).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                  </a>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* Modais */}
      {pendingCard && (
        <ReviewModal
          card={pendingCard}
          settings={settings}
          lists={boardLists}
          isSubmitting={isCreating}
          onConfirm={submitCardToTrello}
          onClose={() => setPendingCard(null)}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          settings={settings}
          onSave={setSettings}
          onClose={() => setIsSettingsOpen(false)}
          onListsLoaded={setBoardLists}
        />
      )}
    </div>
  );
}

export default App;
