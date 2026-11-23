export type TrelloColor =
  | 'pink'
  | 'yellow'
  | 'lime'
  | 'blue'
  | 'black'
  | 'orange'
  | 'red'
  | 'purple'
  | 'sky'
  | 'green';

export type CoverSize = 'normal' | 'full';
export type CardPosition = 'top' | 'bottom';

export interface AppSettings {
  trelloApiKey: string;
  trelloToken: string;
  trelloMemberId: string;
  trelloMemberName: string;
  trelloUsername: string;
  boardId: string;
  boardName: string;
  listId: string;
  listName: string;
  coverColor: TrelloColor;
  coverSize: CoverSize;
  cardPos: CardPosition;
  directSend: boolean;
  geminiApiKey: string;
  geminiModel: string;
  customPrompt: string;
}

export interface GeneratedCard {
  title: string;
  description: string;
  coverColor: TrelloColor;
  listId: string;
  cardPos: CardPosition;
}

export interface HistoryItem {
  id: string;
  title: string;
  shortUrl: string;
  createdAt: string;
  coverColor: TrelloColor;
  listName?: string;
}

export interface TrelloMember {
  id: string;
  fullName: string;
  username: string;
}

export interface TrelloBoard {
  id: string;
  name: string;
}

export interface TrelloList {
  id: string;
  name: string;
}

export interface CompressedImage {
  base64: string;
  mimeType: string;
  previewUrl: string;
}

export interface RecordedAudio {
  blob: Blob;
  base64: string;
  mimeType: string;
  previewUrl: string;
  durationSec: number;
}
