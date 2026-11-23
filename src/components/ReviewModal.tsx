import { useState } from 'react';
import { Check, Loader2, Send, UserCheck, X } from 'lucide-react';
import { TRELLO_COLORS, TRELLO_COLOR_MAP } from '../constants';
import type { AppSettings, GeneratedCard, TrelloColor, TrelloList } from '../types';

interface ReviewModalProps {
  card: GeneratedCard;
  settings: AppSettings;
  lists: TrelloList[];
  isSubmitting: boolean;
  onConfirm: (finalCard: GeneratedCard) => void;
  onClose: () => void;
}

export function ReviewModal({
  card,
  settings,
  lists,
  isSubmitting,
  onConfirm,
  onClose,
}: ReviewModalProps) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [coverColor, setCoverColor] = useState<TrelloColor>(card.coverColor);
  const [listId, setListId] = useState(card.listId);
  const [cardPos, setCardPos] = useState(card.cardPos);

  const activeColor = TRELLO_COLOR_MAP[coverColor];
  const currentListName =
    lists.find((l) => l.id === listId)?.name || settings.listName || 'Lista padrão';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;
    navigator.vibrate?.(50);
    onConfirm({
      title: title.trim(),
      description: description.trim(),
      coverColor,
      listId,
      cardPos,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
        {/* Faixa da cor da capa do Trello */}
        <div
          className="h-3 w-full shrink-0 transition-colors"
          style={{ backgroundColor: activeColor.hex }}
        />

        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-800/80">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Revisão Rápida</h2>
            <p className="text-xs text-slate-400">Ajuste se precisar e confirme com 1 toque</p>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            aria-label="Fechar revisão"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Seletor rápido de cor da capa */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-300">
                Cor da Capa ({activeColor.label})
              </span>
              <span className="text-[11px] text-slate-500">
                {settings.coverSize === 'full' ? 'Card inteiro' : 'Faixa superior'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {TRELLO_COLORS.map((color) => {
                const selected = color.id === coverColor;
                return (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => setCoverColor(color.id)}
                    title={color.label}
                    aria-label={`Cor ${color.label}`}
                    className={`flex h-7 w-9 items-center justify-center rounded-lg transition-transform ${
                      selected
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-105'
                        : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: color.hex }}
                  >
                    {selected && <Check className="w-3.5 h-3.5 text-slate-950 stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Título */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Título do Card
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título do cartão..."
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm font-medium text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Descrição (Markdown)
            </label>
            <textarea
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição gerada..."
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none resize-y"
            />
          </div>

          {/* Destino & Atribuição */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <UserCheck className="w-3.5 h-3.5" />
                <span>
                  Atribuído a{' '}
                  {settings.trelloMemberName || settings.trelloUsername || 'você'}
                </span>
              </div>
              <div className="flex items-center gap-1 rounded-lg bg-slate-900 p-0.5 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setCardPos('top')}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                    cardPos === 'top'
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Topo
                </button>
                <button
                  type="button"
                  onClick={() => setCardPos('bottom')}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                    cardPos === 'bottom'
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Final
                </button>
              </div>
            </div>

            {lists.length > 0 ? (
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Lista de destino</label>
                <select
                  value={listId}
                  onChange={(e) => setListId(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                >
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Destino: <strong className="text-slate-200">{settings.boardName}</strong> →{' '}
                <strong className="text-slate-200">{currentListName}</strong>
              </p>
            )}
          </div>

          <div className="pt-1 pb-2 flex gap-2.5">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-3.5 text-sm font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50"
            >
              Voltar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-sky-950/50 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Criando no Trello...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Confirmar e Criar Card</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
