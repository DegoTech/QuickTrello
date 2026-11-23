import { DEFAULT_PROMPT } from '../constants';
import type { AppSettings } from '../types';

export interface ProcessContextInput {
  text: string;
  audioBase64?: string;
  audioMimeType?: string;
  imageBase64?: string;
  imageMimeType?: string;
  settings: AppSettings;
  onStatusUpdate?: (status: string) => void;
}

export interface GeminiCardResult {
  title: string;
  description: string;
}

export interface GeminiModelInfo {
  id: string;
  displayName: string;
}

interface GeminiModelsListResponse {
  models?: Array<{
    name?: string;
    displayName?: string;
    supportedGenerationMethods?: string[];
  }>;
  error?: {
    message?: string;
    code?: number;
  };
}

interface GeminiApiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
    code?: number;
  };
}

class GeminiHttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(`Erro na API do Gemini (${status}): ${message}`);
    this.status = status;
  }
}

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

function sanitizeMimeType(mimeType: string): string {
  return mimeType.split(';')[0].trim() || 'application/octet-stream';
}

function parseGeminiJson(rawText: string): GeminiCardResult {
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const parsed = JSON.parse(cleaned) as Partial<GeminiCardResult>;
  const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
  const description = typeof parsed.description === 'string' ? parsed.description.trim() : '';

  if (!title) {
    throw new Error('A IA não retornou um título válido para o cartão.');
  }

  return {
    title,
    description,
  };
}

function isSuitableTextMultimodalModel(modelId: string): boolean {
  const id = modelId.toLowerCase();
  if (!id.startsWith('gemini-')) return false;

  const excludedTokens = [
    'embedding',
    'imagen',
    'veo',
    'tts',
    'image-generation',
    'native-audio',
    'robotics',
    'computer-use',
    'deep-research',
  ];
  return !excludedTokens.some((token) => id.includes(token));
}

function scoreModelPriority(modelId: string): number {
  const id = modelId.toLowerCase();
  let score = 0;

  if (id.includes('flash-lite')) score += 90;
  else if (id.includes('flash')) score += 100;
  else if (id.includes('pro')) score += 70;
  else score += 50;

  // Prioriza versões mais recentes (ex: 3.8 > 3.5 > 3.0 > 2.5 > 2.0)
  const versionMatch = id.match(/gemini-(\d+)(?:\.(\d+))?/);
  if (versionMatch) {
    const major = Number(versionMatch[1] || 0);
    const minor = Number(versionMatch[2] || 0);
    score += major * 20 + minor * 2;
  }

  // Prefere aliases estáveis em relação a builds datados ou experimentais específicos
  if (id.includes('-latest')) score += 4;
  if (id.includes('-exp') || id.match(/-\d{3}$/)) score -= 5;

  return score;
}

export async function fetchAvailableGeminiModels(apiKey: string): Promise<GeminiModelInfo[]> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    throw new Error('Preencha sua Gemini API Key antes de carregar os modelos.');
  }

  const response = await fetch(
    `${GEMINI_API_BASE}/models?key=${encodeURIComponent(cleanKey)}`
  );
  const data = (await response.json().catch(() => ({}))) as GeminiModelsListResponse;

  if (!response.ok) {
    const apiMsg = data.error?.message || response.statusText;
    throw new Error(`Erro ao listar modelos do Gemini (${response.status}): ${apiMsg}`);
  }

  const models = (data.models || [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => {
      const rawName = m.name || '';
      const id = rawName.replace(/^models\//, '').trim();
      return {
        id,
        displayName: (m.displayName || id).trim(),
      };
    })
    .filter((m) => m.id && isSuitableTextMultimodalModel(m.id));

  models.sort((a, b) => scoreModelPriority(b.id) - scoreModelPriority(a.id));
  return models;
}

async function callGenerateContent(
  model: string,
  apiKey: string,
  parts: Array<Record<string, unknown>>
): Promise<GeminiCardResult> {
  const endpoint = `${GEMINI_API_BASE}/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    }),
  });

  const data = (await response.json().catch(() => ({}))) as GeminiApiResponse;

  if (!response.ok) {
    const apiMsg = data.error?.message || response.statusText;
    throw new GeminiHttpError(response.status, apiMsg);
  }

  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('O Gemini retornou uma resposta vazia. Tente novamente.');
  }

  try {
    return parseGeminiJson(rawText);
  } catch {
    throw new Error('Não foi possível interpretar o JSON retornado pelo Gemini.');
  }
}

function scoreFallbackPriority(modelId: string): number {
  const id = modelId.toLowerCase();
  let score = 0;

  // Em cenários de 503/429, prioriza pools menos congestionados: flash-lite -> pro -> outros flash
  if (id.includes('flash-lite')) score += 140;
  else if (id.includes('pro')) score += 100;
  else if (id.includes('flash')) score += 80;
  else score += 40;

  const versionMatch = id.match(/gemini-(\d+)(?:\.(\d+))?/);
  if (versionMatch) {
    const major = Number(versionMatch[1] || 0);
    const minor = Number(versionMatch[2] || 0);
    score += major * 10 + minor;
  }

  if (id.includes('-latest')) score += 4;
  if (id.includes('-exp') || id.match(/-\d{3}$/)) score -= 5;

  return score;
}

function isRetryableOrFallbackStatus(status: number): boolean {
  return status === 503 || status === 429 || status === 404;
}

export async function processContextWithGemini({
  text,
  audioBase64,
  audioMimeType,
  imageBase64,
  imageMimeType,
  settings,
  onStatusUpdate,
}: ProcessContextInput): Promise<GeminiCardResult> {
  const apiKey = settings.geminiApiKey.trim();
  if (!apiKey) {
    throw new Error('Configure sua Gemini API Key nas configurações para processar com IA.');
  }

  if (!text.trim() && !audioBase64 && !imageBase64) {
    throw new Error('Adicione texto, grave um áudio ou selecione uma imagem para criar o cartão.');
  }

  const rawModel = settings.geminiModel.trim();
  const primaryModel =
    !rawModel || rawModel === 'gemini-2.5-flash' ? DEFAULT_GEMINI_MODEL : rawModel;
  const promptInstruction = settings.customPrompt.trim() || DEFAULT_PROMPT;

  const parts: Array<Record<string, unknown>> = [{ text: promptInstruction }];

  if (text.trim()) {
    parts.push({
      text: `Texto/nota digitada pelo usuário:\n${text.trim()}`,
    });
  }

  if (audioBase64 && audioMimeType) {
    parts.push({
      inline_data: {
        mime_type: sanitizeMimeType(audioMimeType),
        data: audioBase64,
      },
    });
  }

  if (imageBase64 && imageMimeType) {
    parts.push({
      inline_data: {
        mime_type: sanitizeMimeType(imageMimeType),
        data: imageBase64,
      },
    });
  }

  let lastError: unknown;

  // 1. Tenta uma única vez no modelo principal; em caso de 503/429/404 parte direto para fallback
  onStatusUpdate?.(`Processando com ${primaryModel}...`);
  try {
    return await callGenerateContent(primaryModel, apiKey, parts);
  } catch (err) {
    lastError = err;
    if (!(err instanceof GeminiHttpError) || !isRetryableOrFallbackStatus(err.status)) {
      throw err;
    }
  }

  // 2. Fallback dinâmico: prioriza flash-lite e outros pools disponíveis na conta
  if (lastError instanceof GeminiHttpError && isRetryableOrFallbackStatus(lastError.status)) {
    onStatusUpdate?.(`Alta demanda (${lastError.status}), buscando modelo alternativo...`);

    let availableModels: GeminiModelInfo[] = [];
    try {
      availableModels = await fetchAvailableGeminiModels(apiKey);
    } catch {
      availableModels = [];
    }

    const fallbackCandidates = availableModels
      .map((m) => m.id)
      .filter((id) => id !== primaryModel && id !== 'gemini-2.5-flash')
      .sort((a, b) => scoreFallbackPriority(b) - scoreFallbackPriority(a))
      .slice(0, 6);

    for (const fallbackModel of fallbackCandidates) {
      onStatusUpdate?.(`Tentando ${fallbackModel}...`);
      try {
        return await callGenerateContent(fallbackModel, apiKey, parts);
      } catch (fallbackErr) {
        lastError = fallbackErr;
        if (
          fallbackErr instanceof GeminiHttpError &&
          !isRetryableOrFallbackStatus(fallbackErr.status)
        ) {
          throw fallbackErr;
        }
      }
    }
  }

  if (lastError instanceof GeminiHttpError && lastError.status === 503) {
    throw new Error(
      'Os servidores do Gemini estão com alta demanda no momento (503), inclusive nos modelos alternativos. Aguarde alguns segundos e tente novamente ou escolha um modelo flash-lite nas Configurações.'
    );
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Falha inesperada ao processar contexto no Gemini.');
}
