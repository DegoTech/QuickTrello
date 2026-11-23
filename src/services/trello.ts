import type {
  AppSettings,
  GeneratedCard,
  TrelloBoard,
  TrelloColor,
  TrelloList,
  TrelloMember,
} from '../types';

const TRELLO_API_BASE = 'https://api.trello.com/1';

export function getTrelloAuthUrl(apiKey: string): string {
  const cleanKey = encodeURIComponent(apiKey.trim());
  return `https://trello.com/1/authorize?expiration=never&name=QuickTrello&scope=read,write&response_type=token&key=${cleanKey}`;
}

async function trelloFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    if (response.status === 401) {
      throw new Error('Credenciais do Trello inválidas ou expiradas (401). Verifique API Key e Token.');
    }
    throw new Error(
      `Erro na API do Trello (${response.status}): ${errorText || response.statusText}`
    );
  }
  return (await response.json()) as T;
}

export async function fetchTrelloMember(apiKey: string, token: string): Promise<TrelloMember> {
  const params = new URLSearchParams({
    key: apiKey.trim(),
    token: token.trim(),
    fields: 'id,fullName,username',
  });
  return trelloFetch<TrelloMember>(`${TRELLO_API_BASE}/members/me?${params.toString()}`);
}

export async function fetchTrelloBoards(apiKey: string, token: string): Promise<TrelloBoard[]> {
  const params = new URLSearchParams({
    key: apiKey.trim(),
    token: token.trim(),
    filter: 'open',
    fields: 'id,name',
  });
  return trelloFetch<TrelloBoard[]>(`${TRELLO_API_BASE}/members/me/boards?${params.toString()}`);
}

export async function fetchTrelloLists(
  apiKey: string,
  token: string,
  boardId: string
): Promise<TrelloList[]> {
  const params = new URLSearchParams({
    key: apiKey.trim(),
    token: token.trim(),
    filter: 'open',
    fields: 'id,name',
  });
  return trelloFetch<TrelloList[]>(
    `${TRELLO_API_BASE}/boards/${encodeURIComponent(boardId)}/lists?${params.toString()}`
  );
}

interface TrelloCardResponse {
  id: string;
  name: string;
  shortUrl: string;
  url: string;
  cover?: {
    color?: TrelloColor | null;
    size?: 'normal' | 'full';
    brightness?: 'dark' | 'light';
  };
}

export async function createTrelloCard(
  settings: AppSettings,
  card: GeneratedCard
): Promise<TrelloCardResponse> {
  const apiKey = settings.trelloApiKey.trim();
  const token = settings.trelloToken.trim();

  if (!apiKey || !token) {
    throw new Error('Configure sua API Key e Token do Trello nas configurações.');
  }
  if (!card.listId) {
    throw new Error('Selecione um Quadro e uma Lista padrão nas configurações.');
  }

  const authParams = new URLSearchParams({
    key: apiKey,
    token,
  });

  const coverPayload = {
    color: card.coverColor,
    brightness: 'dark' as const,
    size: settings.coverSize,
  };

  const payload = {
    name: card.title.trim() || 'Novo Card',
    desc: card.description.trim(),
    idList: card.listId,
    pos: card.cardPos,
    idMembers: settings.trelloMemberId ? [settings.trelloMemberId] : [],
    cover: coverPayload,
  };

  const created = await trelloFetch<TrelloCardResponse>(
    `${TRELLO_API_BASE}/cards?${authParams.toString()}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  // Garantia de Capa: caso o POST do Trello ignore ou não aplique o cover completo, reforça com PUT
  const appliedColor = created.cover?.color;
  const appliedSize = created.cover?.size;
  if (appliedColor !== card.coverColor || appliedSize !== settings.coverSize) {
    try {
      const updated = await trelloFetch<TrelloCardResponse>(
        `${TRELLO_API_BASE}/cards/${encodeURIComponent(created.id)}?${authParams.toString()}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ cover: coverPayload }),
        }
      );
      return updated;
    } catch {
      // Se o card foi criado com sucesso mas o PUT de capa falhar por alguma restrição, retorna o criado
      return created;
    }
  }

  return created;
}
