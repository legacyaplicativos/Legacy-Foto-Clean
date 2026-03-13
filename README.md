# 📸 PhotoClean — Deploy Netlify (sem build)

## Como funciona

O `index.html` é **um único arquivo** — carrega React pelo CDN, sem precisar de Node.js, npm ou build.

---

## ✅ Passo 1 — Configure o Client ID Google

Abra o `index.html` e edite a linha:
```js
GOOGLE_CLIENT_ID: "SEU_CLIENT_ID_AQUI.apps.googleusercontent.com"
```

**Como obter o Client ID:**
1. Acesse https://console.cloud.google.com/apis/credentials
2. Crie credencial → OAuth 2.0 → Web application
3. Ative as APIs: **Photos Library API** e **People API**
4. Authorized JS origins: `https://SEU-APP.netlify.app`
5. Copie o Client ID

---

## ✅ Passo 2 — Deploy no Netlify

**Opção A — Arrastar e soltar (mais simples):**
1. Acesse https://app.netlify.com
2. Clique em "Add new site → Deploy manually"
3. Arraste a pasta `photoclean-v2` inteira para a área de upload
4. Aguarde o deploy (30 segundos)

**Opção B — Via GitHub:**
1. Suba a pasta no GitHub
2. Netlify → New site from Git → selecione o repositório
3. Build command: (deixe vazio)
4. Publish directory: `.`

---

## ✅ Passo 3 — Variável de ambiente no Netlify

No painel Netlify → Site settings → Environment variables, adicione:
```
SESSION_SECRET = uma-string-aleatoria-bem-longa-aqui
```

---

## ✅ Passo 4 — Use o site

1. Acesse `https://seu-app.netlify.app`
2. Clique em "Conectar com Google Photos"
3. Cole sua chave Gemini (de https://aistudio.google.com/app/apikey)
4. Analise e limpe suas fotos!

---

## Estrutura

```
photoclean-v2/
├── index.html              ← App completo (React via CDN, sem build)
├── netlify.toml            ← Configuração de deploy e rotas
├── netlify/
│   └── functions/
│       ├── session.js      ← Salva chave Gemini criptografada em cookie
│       ├── photos.js       ← Lista fotos do Google Photos
│       ├── analyze.js      ← Analisa foto com Gemini
│       ├── chat.js         ← Chat com Gemini
│       └── photos-delete.js← Move fotos para lixeira
└── README.md
```
