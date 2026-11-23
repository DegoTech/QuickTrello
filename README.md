# ⚡ QuickTrello

Aplicativo mobile-first (PWA + Android via Capacitor) 100% client-side para criar cartões no **Trello** em segundos usando **Texto**, **Áudio** e **Imagem (contexto)** processados por **IA (Google Gemini)**, já atribuídos ao seu usuário e com cor de capa predefinida.

---

## ✨ Funcionalidades

- **Captura Multimodal:**
  - 🎙️ **Áudio:** gravação nativa pelo navegador/WebView (`MediaRecorder`) com timer e player para revisão.
  - 📷 **Imagem / Print:** captura pela câmera, galeria ou colagem (`Ctrl+V`), redimensionada automaticamente no cliente (`1280px` max, JPEG) e enviada **apenas para a IA extrair contexto** (sem anexar arquivos no Trello).
  - ⌨️ **Texto:** campo rápido complementar, com opção de criar card direto sem usar IA quando houver apenas texto.
- **Processamento Inteligente (Gemini API):**
  - Gera título objetivo e descrição organizada em Markdown (`## Contexto`, `## Ações / Checklist`, `## Contexto da Imagem`).
  - **Fallback automático:** caso o modelo selecionado retorne `503`, `429` ou `404`, consulta os modelos ativos na sua chave e tenta variantes alternativas (priorizando `flash-lite`, `pro` e `flash`).
- **Criação Automática no Trello (`POST /1/cards`):**
  - Atribui o card automaticamente ao seu usuário (`idMembers` via `/1/members/me`).
  - Aplica a cor e o estilo de capa configurados (`normal` ou `full`), com reforço automático via `PUT` se necessário.
- **Fluxo de 1 Toque ou Envio Direto:**
  - Modal de **Revisão Rápida** para editar título/descrição, trocar lista, posição (`top`/`bottom`) ou cor antes de enviar — ou toggle **Envio Direto** para pular a revisão.
- **100% Client-Side & Privado:**
  - Suas chaves, preferências e histórico recente ficam salvos apenas no `localStorage` do seu dispositivo.

---

## 🛠️ Stack

- **Frontend:** React 19, TypeScript, Vite 6, Tailwind CSS v4, Lucide Icons
- **IA:** Google Gemini REST API (`v1beta` — padrão `gemini-3.8-flash`)
- **Trello:** Trello REST API (`1/members/me`, `boards`, `lists`, `cards`)
- **Mobile / Android:** PWA (`manifest.json` + Service Worker) e **Capacitor** (`android/`)

---

## 🚀 Como Rodar Localmente (Web / PWA)

```bash
# 1. Instalar dependências
npm install

# 2. Rodar em modo desenvolvimento
npm run dev

# 3. Gerar build estático de produção (pasta dist/)
npm run build
```

---

## 📱 Android (Sem Servidor Node)

O projeto usa **Capacitor** para embutir o build estático `dist/` dentro de um app Android nativo, com permissões de microfone e câmera configuradas em `AndroidManifest.xml` e `MainActivity.java`.

### Gerar APK automaticamente pelo GitHub Actions
O workflow [`.github/workflows/android-apk.yml`](.github/workflows/android-apk.yml) compila o projeto a cada push na branch `main` (ou `master`):
1. Acesse a aba **Actions** no repositório do GitHub.
2. Abra a execução **Build Android APK**.
3. Baixe o artefato **`QuickTrello-debug-apk`** e instale o `.apk` no seu celular Android.

### Sincronizar alterações web para o projeto Android
```bash
npm run android:sync
```

---

## ⚙️ Configuração Inicial no App

Ao abrir o **QuickTrello**, toque no ícone de **engrenagem** (Configurações):
1. Informe sua **Trello API Key** ([power-ups/admin](https://trello.com/power-ups/admin)), clique em **Gerar Token no Trello**, cole o token e toque em **Conectar Trello e Carregar Quadros**.
2. Escolha o **Quadro**, a **Lista padrão**, a **Posição** (`Topo` ou `Final`) e a **Cor da Capa**.
3. Informe sua **Gemini API Key** ([Google AI Studio](https://aistudio.google.com/apikey)) e, se desejar, clique em **Carregar Modelos** para listar os modelos ativos da sua conta.

---

## 📂 Estrutura Principal

```text
├── .github/workflows/android-apk.yml   # Build automático do APK no GitHub Actions
├── android/                            # Projeto nativo Android (Capacitor)
├── public/                             # Manifesto PWA, Service Worker e ícones
└── src/
    ├── components/
    │   ├── AudioRecorder.tsx           # Gravação de áudio via MediaRecorder
    │   ├── ImagePicker.tsx             # Câmera, galeria e colagem de imagem
    │   ├── ReviewModal.tsx             # Revisão rápida antes de criar o card
    │   └── SettingsModal.tsx           # Configuração guiada Trello + Gemini
    ├── services/
    │   ├── gemini.ts                   # Integração multimodal + fallback de modelos
    │   └── trello.ts                   # Integração REST API do Trello
    ├── utils/media.ts                  # Compressão de imagem e conversão base64
    ├── App.tsx                         # Tela principal e histórico
    ├── constants.ts                    # Cores do Trello, prompt padrão e defaults
    └── types.ts                        # Tipagens TypeScript
```
