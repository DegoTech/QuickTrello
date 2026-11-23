import { useEffect, useState } from 'react';
import {
  Check,
  ExternalLink,
  KeyRound,
  Loader2,
  Palette,
  RefreshCw,
  RotateCcw,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import { DEFAULT_PROMPT, TRELLO_COLORS } from '../constants';
import {
  fetchAvailableGeminiModels,
  type GeminiModelInfo,
} from '../services/gemini';
import {
  fetchTrelloBoards,
  fetchTrelloLists,
  fetchTrelloMember,
  getTrelloAuthUrl,
} from '../services/trello';
import type { AppSettings, TrelloBoard, TrelloList } from '../types';

interface SettingsModalProps {
  settings: AppSettings;
  onSave: (next: AppSettings) => void;
  onClose: () => void;
  onListsLoaded?: (lists: TrelloList[]) => void;
}

export function SettingsModal({
  settings,
  onSave,
  onClose,
  onListsLoaded,
}: SettingsModalProps) {
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [boards, setBoards] = useState<TrelloBoard[]>([]);
  const [lists, setLists] = useState<TrelloList[]>([]);
  const [availableModels, setAvailableModels] = useState<GeminiModelInfo[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [geminiStatusMsg, setGeminiStatusMsg] = useState<string | null>(null);
  const [geminiErrorMsg, setGeminiErrorMsg] = useState<string | null>(null);

  // Carrega quadros/listas automaticamente se já houver credenciais salvas ao abrir
  useEffect(() => {
    if (!draft.trelloApiKey || !draft.trelloToken) return;
    let cancelled = false;

    const preload = async () => {
      try {
        const fetchedBoards = await fetchTrelloBoards(draft.trelloApiKey, draft.trelloToken);
        if (cancelled) return;
        setBoards(fetchedBoards);

        if (draft.boardId) {
          const fetchedLists = await fetchTrelloLists(
            draft.trelloApiKey,
            draft.trelloToken,
            draft.boardId
          );
          if (cancelled) return;
          setLists(fetchedLists);
          onListsLoaded?.(fetchedLists);
        }
      } catch {
        // Silencioso no preload para não poluir antes do usuário editar
      }
    };

    preload();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleConnectTrello = async () => {
    if (!draft.trelloApiKey.trim() || !draft.trelloToken.trim()) {
      setErrorMsg('Preencha a Trello API Key e o Trello Token antes de conectar.');
      return;
    }

    setErrorMsg(null);
    setStatusMsg(null);
    setIsConnecting(true);

    try {
      const [member, fetchedBoards] = await Promise.all([
        fetchTrelloMember(draft.trelloApiKey, draft.trelloToken),
        fetchTrelloBoards(draft.trelloApiKey, draft.trelloToken),
      ]);

      setBoards(fetchedBoards);

      let nextBoardId = draft.boardId;
      let nextBoardName = draft.boardName;
      if (!fetchedBoards.some((b) => b.id === nextBoardId)) {
        nextBoardId = fetchedBoards[0]?.id || '';
        nextBoardName = fetchedBoards[0]?.name || '';
      }

      let nextListId = draft.listId;
      let nextListName = draft.listName;
      if (nextBoardId) {
        const fetchedLists = await fetchTrelloLists(
          draft.trelloApiKey,
          draft.trelloToken,
          nextBoardId
        );
        setLists(fetchedLists);
        onListsLoaded?.(fetchedLists);
        if (!fetchedLists.some((l) => l.id === nextListId)) {
          nextListId = fetchedLists[0]?.id || '';
          nextListName = fetchedLists[0]?.name || '';
        }
      } else {
        setLists([]);
      }

      setDraft((prev) => ({
        ...prev,
        trelloMemberId: member.id,
        trelloMemberName: member.fullName,
        trelloUsername: member.username,
        boardId: nextBoardId,
        boardName: nextBoardName,
        listId: nextListId,
        listName: nextListName,
      }));

      setStatusMsg(`Conectado como ${member.fullName} (@${member.username})`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao conectar com o Trello.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleBoardChange = async (boardId: string) => {
    const selectedBoard = boards.find((b) => b.id === boardId);
    setDraft((prev) => ({
      ...prev,
      boardId,
      boardName: selectedBoard?.name || '',
      listId: '',
      listName: '',
    }));

    if (!boardId) {
      setLists([]);
      return;
    }

    setIsLoadingLists(true);
    setErrorMsg(null);
    try {
      const fetchedLists = await fetchTrelloLists(draft.trelloApiKey, draft.trelloToken, boardId);
      setLists(fetchedLists);
      onListsLoaded?.(fetchedLists);
      if (fetchedLists[0]) {
        setDraft((prev) => ({
          ...prev,
          listId: fetchedLists[0].id,
          listName: fetchedLists[0].name,
        }));
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao carregar listas do quadro.');
    } finally {
      setIsLoadingLists(false);
    }
  };

  const handleListChange = (listId: string) => {
    const selectedList = lists.find((l) => l.id === listId);
    setDraft((prev) => ({
      ...prev,
      listId,
      listName: selectedList?.name || '',
    }));
  };

  const handleLoadGeminiModels = async () => {
    setGeminiErrorMsg(null);
    setGeminiStatusMsg(null);
    setIsLoadingModels(true);

    try {
      const models = await fetchAvailableGeminiModels(draft.geminiApiKey);
      setAvailableModels(models);
      if (models.length === 0) {
        setGeminiErrorMsg('Nenhum modelo compatível encontrado para esta chave.');
      } else {
        setGeminiStatusMsg(`${models.length} modelos ativos carregados da sua conta.`);
      }
    } catch (err) {
      setGeminiErrorMsg(
        err instanceof Error ? err.message : 'Erro ao carregar modelos do Gemini.'
      );
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(draft);
    onClose();
  };

  const canGenerateToken = draft.trelloApiKey.trim().length > 10;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[94dvh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Configurações do QuickTrello</h2>
            <p className="text-xs text-slate-400">
              Suas chaves ficam salvas apenas no navegador deste dispositivo
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar configurações"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* Passo 1: Credenciais do Trello */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400">
                <KeyRound className="w-3.5 h-3.5" />
                1. Credenciais do Trello
              </h3>
              <a
                href="https://trello.com/power-ups/admin"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:underline"
              >
                Obter API Key <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Trello API Key
              </label>
              <input
                type="text"
                value={draft.trelloApiKey}
                onChange={(e) => setDraft({ ...draft, trelloApiKey: e.target.value })}
                placeholder="Cole sua API Key do Trello"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-300">Trello Token</label>
                {canGenerateToken && (
                  <a
                    href={getTrelloAuthUrl(draft.trelloApiKey)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md bg-sky-500/15 px-2 py-0.5 text-[11px] font-medium text-sky-300 hover:bg-sky-500/25"
                  >
                    Gerar Token no Trello <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <input
                type="password"
                value={draft.trelloToken}
                onChange={(e) => setDraft({ ...draft, trelloToken: e.target.value })}
                placeholder="Cole o Token gerado pelo Trello"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleConnectTrello}
              disabled={isConnecting}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/15 py-2.5 text-sm font-medium text-sky-300 hover:bg-sky-500/25 transition-colors disabled:opacity-50"
            >
              {isConnecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span>Conectar Trello e Carregar Quadros</span>
            </button>

            {draft.trelloMemberId && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-3 py-2 text-xs text-emerald-300">
                <UserCheck className="w-4 h-4 shrink-0" />
                <span>
                  Atribuído automaticamente a: <strong>{draft.trelloMemberName}</strong> (@
                  {draft.trelloUsername})
                </span>
              </div>
            )}

            {statusMsg && !errorMsg && (
              <p className="text-xs text-emerald-400">{statusMsg}</p>
            )}
            {errorMsg && (
              <p className="rounded-xl bg-rose-500/10 border border-rose-500/25 px-3 py-2 text-xs text-rose-300">
                {errorMsg}
              </p>
            )}
          </section>

          {/* Passo 2: Quadro, Lista e Posição */}
          <section className="space-y-3 pt-2 border-t border-slate-800/80">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-sky-400">
              2. Quadro e Lista Padrão
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Quadro</label>
                {boards.length > 0 ? (
                  <select
                    value={draft.boardId}
                    onChange={(e) => handleBoardChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                  >
                    <option value="">Selecione um quadro...</option>
                    {boards.map((board) => (
                      <option key={board.id} value={board.id}>
                        {board.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-xs text-slate-500">
                    {draft.boardName || 'Conecte o Trello acima para listar'}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Lista {isLoadingLists && '(carregando...)'}
                </label>
                {lists.length > 0 ? (
                  <select
                    value={draft.listId}
                    onChange={(e) => handleListChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                  >
                    <option value="">Selecione uma lista...</option>
                    {lists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-xs text-slate-500">
                    {draft.listName || 'Escolha um quadro primeiro'}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Posição do Novo Card na Lista
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, cardPos: 'top' })}
                  className={`rounded-xl border py-2 text-xs font-medium transition-colors ${
                    draft.cardPos === 'top'
                      ? 'border-sky-500 bg-sky-500/20 text-sky-300'
                      : 'border-slate-700 bg-slate-950 text-slate-400'
                  }`}
                >
                  Topo da Lista
                </button>
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, cardPos: 'bottom' })}
                  className={`rounded-xl border py-2 text-xs font-medium transition-colors ${
                    draft.cardPos === 'bottom'
                      ? 'border-sky-500 bg-sky-500/20 text-sky-300'
                      : 'border-slate-700 bg-slate-950 text-slate-400'
                  }`}
                >
                  Final da Lista
                </button>
              </div>
            </div>
          </section>

          {/* Passo 3: Cor e Estilo da Capa */}
          <section className="space-y-3 pt-2 border-t border-slate-800/80">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400">
              <Palette className="w-3.5 h-3.5" />
              3. Cor Padrão da Capa
            </h3>

            <div className="grid grid-cols-5 gap-2.5">
              {TRELLO_COLORS.map((color) => {
                const selected = draft.coverColor === color.id;
                return (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => setDraft({ ...draft, coverColor: color.id })}
                    className={`flex flex-col items-center gap-1 rounded-xl p-1.5 border transition-all ${
                      selected
                        ? 'border-white bg-slate-800'
                        : 'border-transparent hover:bg-slate-800/50'
                    }`}
                  >
                    <span
                      className="flex h-7 w-full items-center justify-center rounded-lg"
                      style={{ backgroundColor: color.hex }}
                    >
                      {selected && <Check className="w-3.5 h-3.5 text-slate-950 stroke-[3]" />}
                    </span>
                    <span className="text-[10px] text-slate-300">{color.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDraft({ ...draft, coverSize: 'normal' })}
                className={`rounded-xl border py-2 text-xs font-medium transition-colors ${
                  draft.coverSize === 'normal'
                    ? 'border-sky-500 bg-sky-500/20 text-sky-300'
                    : 'border-slate-700 bg-slate-950 text-slate-400'
                }`}
              >
                Faixa Superior
              </button>
              <button
                type="button"
                onClick={() => setDraft({ ...draft, coverSize: 'full' })}
                className={`rounded-xl border py-2 text-xs font-medium transition-colors ${
                  draft.coverSize === 'full'
                    ? 'border-sky-500 bg-sky-500/20 text-sky-300'
                    : 'border-slate-700 bg-slate-950 text-slate-400'
                }`}
              >
                Card Inteiro Colorido
              </button>
            </div>
          </section>

          {/* Passo 4: Gemini AI */}
          <section className="space-y-3 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-400">
                <Sparkles className="w-3.5 h-3.5" />
                4. Inteligência Artificial (Gemini)
              </h3>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-purple-300 hover:underline"
              >
                Google AI Studio <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Gemini API Key
              </label>
              <input
                type="password"
                value={draft.geminiApiKey}
                onChange={(e) => setDraft({ ...draft, geminiApiKey: e.target.value })}
                placeholder="AIza..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="block text-xs font-medium text-slate-300">
                  Modelo do Gemini
                </label>
                <div className="flex items-center gap-2.5">
                  {draft.geminiModel !== 'gemini-3.8-flash' && (
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, geminiModel: 'gemini-3.8-flash' })}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Padrão
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleLoadGeminiModels}
                    disabled={isLoadingModels}
                    className="inline-flex items-center gap-1 rounded-md bg-purple-500/15 px-2 py-0.5 text-[11px] font-medium text-purple-300 hover:bg-purple-500/25 disabled:opacity-50"
                  >
                    {isLoadingModels ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    <span>Carregar Modelos</span>
                  </button>
                </div>
              </div>

              <input
                type="text"
                value={draft.geminiModel}
                onChange={(e) => setDraft({ ...draft, geminiModel: e.target.value })}
                placeholder="gemini-3.8-flash"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-purple-500 focus:outline-none"
              />

              <div className="mt-2 flex flex-wrap gap-1.5">
                {[
                  { id: 'gemini-3.8-flash', label: '3.8 Flash' },
                  { id: 'gemini-3.8-flash-lite', label: '3.8 Flash-Lite (mais estável)' },
                  { id: 'gemini-3.7-flash-lite', label: '3.7 Flash-Lite' },
                  { id: 'gemini-3.5-flash-lite', label: '3.5 Flash-Lite' },
                ].map((preset) => {
                  const active = draft.geminiModel === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setDraft({ ...draft, geminiModel: preset.id })}
                      className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        active
                          ? 'border-purple-500 bg-purple-500/20 text-purple-200'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {availableModels.length > 0 && (
                <select
                  value={
                    availableModels.some((m) => m.id === draft.geminiModel)
                      ? draft.geminiModel
                      : ''
                  }
                  onChange={(e) => {
                    if (e.target.value) {
                      setDraft({ ...draft, geminiModel: e.target.value });
                    }
                  }}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-purple-500 focus:outline-none"
                >
                  <option value="">Selecionar um modelo ativo da lista...</option>
                  {availableModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.displayName} ({model.id})
                    </option>
                  ))}
                </select>
              )}

              {geminiStatusMsg && !geminiErrorMsg && (
                <p className="mt-1.5 text-[11px] text-emerald-400">{geminiStatusMsg}</p>
              )}
              {geminiErrorMsg && (
                <p className="mt-1.5 rounded-xl bg-rose-500/10 border border-rose-500/25 px-3 py-2 text-xs text-rose-300">
                  {geminiErrorMsg}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-300">
                  Instruções da IA (Prompt)
                </label>
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, customPrompt: DEFAULT_PROMPT })}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
                >
                  <RotateCcw className="w-3 h-3" />
                  Restaurar padrão
                </button>
              </div>
              <textarea
                rows={4}
                value={draft.customPrompt}
                onChange={(e) => setDraft({ ...draft, customPrompt: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300 focus:border-purple-500 focus:outline-none"
              />
            </div>
          </section>

          <div className="sticky bottom-0 pt-3 pb-2 bg-slate-900 border-t border-slate-800/80">
            <button
              type="submit"
              className="w-full rounded-xl bg-sky-600 hover:bg-sky-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-sky-950/50 transition-colors"
            >
              Salvar Configurações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
