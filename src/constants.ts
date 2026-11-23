import type { AppSettings, TrelloColor } from './types';

export interface TrelloColorOption {
  id: TrelloColor;
  label: string;
  hex: string;
}

export const TRELLO_COLORS: TrelloColorOption[] = [
  { id: 'blue', label: 'Azul', hex: '#579dff' },
  { id: 'sky', label: 'Ciano', hex: '#6cc3e0' },
  { id: 'green', label: 'Verde', hex: '#4bce97' },
  { id: 'lime', label: 'Lima', hex: '#94c748' },
  { id: 'yellow', label: 'Amarelo', hex: '#f5cd47' },
  { id: 'orange', label: 'Laranja', hex: '#fea362' },
  { id: 'red', label: 'Vermelho', hex: '#f87168' },
  { id: 'pink', label: 'Rosa', hex: '#e774bb' },
  { id: 'purple', label: 'Roxo', hex: '#9f8fef' },
  { id: 'black', label: 'Escuro', hex: '#44546f' },
];

export const TRELLO_COLOR_MAP: Record<TrelloColor, TrelloColorOption> = TRELLO_COLORS.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<TrelloColor, TrelloColorOption>
);

export const DEFAULT_PROMPT = `Você é um assistente de produtividade especialista em transformar capturas rápidas (texto, áudio e imagem/print) em cartões claros e acionáveis para o Trello.

Analise todo o contexto fornecido (nota de texto, gravação de áudio e/ou imagem anexada) e gere um objeto JSON válido em português do Brasil com exatamente duas chaves: "title" e "description".

Regras:
1. "title": Título curto, direto e acionável (máximo ~80 caracteres), começando preferencialmente com um verbo no infinitivo ou substantivo claro (ex: "Corrigir erro de autenticação na tela de login").
2. "description": Descrição bem estruturada em Markdown para o Trello. Inclua apenas as seções relevantes para os dados fornecidos:
   - ## Contexto
     Resumo claro do pedido, problema ou ideia (incluindo o que foi falado no áudio e escrito no texto).
   - ## Ações / Checklist
     Lista de tarefas acionáveis em Markdown (- [ ] ...) caso existam próximos passos ou múltiplos itens mencionados.
   - ## Contexto da Imagem
     Se houver imagem, transcreva textos importantes, códigos de erro, valores, datas, nomes ou detalhes visuais relevantes (lembrando que a imagem em si não será anexada ao card, então extraia tudo que for útil).

Retorne APENAS o JSON no formato:
{
  "title": "...",
  "description": "..."
}`;

export const DEFAULT_SETTINGS: AppSettings = {
  trelloApiKey: '',
  trelloToken: '',
  trelloMemberId: '',
  trelloMemberName: '',
  trelloUsername: '',
  boardId: '',
  boardName: '',
  listId: '',
  listName: '',
  coverColor: 'blue',
  coverSize: 'normal',
  cardPos: 'top',
  directSend: false,
  geminiApiKey: '',
  geminiModel: 'gemini-3.8-flash',
  customPrompt: DEFAULT_PROMPT,
};

export const STORAGE_KEYS = {
  SETTINGS: 'quicktrello_settings_v1',
  HISTORY: 'quicktrello_history_v1',
};
