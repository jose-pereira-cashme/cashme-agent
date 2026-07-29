<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/cashme-logo-dark.svg">
  <img src="docs/cashme-logo-light.svg" alt="CashMe" width="220">
</picture>

# 🤖 cashme-agent

**Do ticket do Jira ao pull request pronto para revisão.**

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D24-5FA04E?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Express](https://img.shields.io/badge/Express-5-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![Claude Agent SDK](https://img.shields.io/badge/Claude%20Agent%20SDK-D97757?style=flat-square&logo=claude&logoColor=white)](https://docs.claude.com/en/api/agent-sdk/overview)
[![Uso interno](https://img.shields.io/badge/uso-interno-00BFFF?style=flat-square)](#)

</div>

---

## ✨ O que é

Serviço interno que transforma tickets do Jira em pull requests prontos para revisão. Tickets
de investigação (spike/discovery) recebem um resumo comentado no próprio ticket, sem código.

O Jira chama um webhook, o serviço junta o contexto do ticket (descrição, comentários e
páginas do Confluence vinculadas), um agente Claude classifica o trabalho e então o serviço
implementa a mudança nos repositórios relevantes — um PR por repositório — ou investiga e
responde. O resultado sempre volta como comentário no ticket, e **uma pessoa faz a revisão e o
merge final.**

> [!NOTE]
> Os detalhes de arquitetura e as alternativas avaliadas estão no
> [DESIGN.md](DESIGN.md).

## 🧰 Requisitos

| | |
| --- | --- |
| ⬢ | **Node.js >= 24** |
| 🌿 | **`git`** no PATH |
| 🐙 | **`gh`** (GitHub CLI) no PATH — é o que abre os PRs |
| 🔑 | Credenciais: chave da API da Anthropic, e-mail + API token do Jira e um token do GitHub com permissão de push e de abrir PR nos repositórios do catálogo |

## 🚀 Começando

```bash
npm install
cp .env.example .env   # preencha os valores
npm run dev
```

Para disparar um ticket:

```bash
curl -X POST http://localhost:3000/agent \
  -H "Content-Type: application/json" \
  -H "X-Agent-Secret: $AGENT_SECRET" \
  -d '{"issueKey":"CASH-123"}'
```

## 📜 Scripts

| Comando | O que faz |
| :--- | :--- |
| `npm run dev` | Sobe o serviço em watch mode (`tsx`), lendo `.env` se existir |
| `npm run build` | Compila para `dist/` |
| `npm start` | Roda o build (`node dist/index.js`), lendo `.env` se existir |

## 🌐 Endpoints

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `GET` | `/health` | Health check |
| `POST` | `/agent` | Enfileira um ticket. Body `{"issueKey":"CASH-123"}` e header `X-Agent-Secret`. Responde `202` na hora — o processamento é assíncrono |

## 📁 Estrutura de pastas

```
src/
├── index.ts          servidor Express: /health e /agent
├── queue.ts          fila serial em memória, deduplicada por issueKey
├── config.ts         variáveis de ambiente, validadas no boot
├── operations/       o fluxo: contexto → triagem → implementação ou pesquisa
│   └── implementation/  uma fase por arquivo: prepare, plan, implementRepo, replicate
├── agent/            camada fina sobre o Claude Agent SDK
├── tools/            Jira, Confluence, Git, Github (gh) e Catalog
└── utils/            ADF, exec, parsing, links e leitura de prompts

prompts/              prompts de sistema/instrução em Markdown
catalog.json          repositórios em que o agente pode atuar
```

## ⚙️ Configuração

As variáveis são lidas em [src/config.ts](src/config.ts), que **falha no boot** se alguma
obrigatória estiver faltando.

### 🔒 Obrigatórias

| Variável | Descrição |
| :--- | :--- |
| `AGENT_SECRET` | Segredo esperado no header `X-Agent-Secret` |
| `ANTHROPIC_API_KEY` | Chave da API da Anthropic |
| `JIRA_URL` | Base da instância Jira (ex.: `https://cashme.atlassian.net`) |
| `JIRA_EMAIL` | E-mail da conta Jira |
| `JIRA_API_KEY` | API token do Jira |
| `GITHUB_TOKEN` | Token com push e permissão de abrir PR |

### 🎛️ Opcionais

| Variável | Padrão | Descrição |
| :--- | :--- | :--- |
| `PORT` | `3000` | Porta do servidor |
| `MIRRORS_DIR` | `<tmp>/cashme-agent-mirrors` | Onde ficam os clones locais dos repositórios |
| `CATALOG_PATH` | `<cwd>/catalog.json` | Catálogo de repositórios |
| `PROMPTS_DIR` | `<cwd>/prompts` | Pasta dos prompts |
| `MAX_VERIFY_ATTEMPTS` | `3` | Tentativas de implementar + verificar por repositório |
| `JIRA_REVIEW_STATUS` | `Em revisão` | Status para onde o ticket vai quando há PR aberto |
| `AGENT_PROVIDER` | `claude` | Reservado; hoje só o runner Claude é implementado |

### 📚 `catalog.json`

Define em quais repositórios o agente pode atuar. A descrição é lida pelo agente de triagem —
é nela que ficam as regras de repositórios irmãos, então vale escrevê-la com cuidado:

```json
{
  "repos": [
    {
      "name": "cashmember",
      "description": "Portal do cliente (Next.js). Compartilha o MESMO código-base que 'cashplayer' — SEMPRE inclua os dois, salvo indicação explícita em contrário.",
      "url": "https://github.com/cash-me/cashmember.git",
      "defaultBranch": "master"
    }
  ]
}
```

### 💬 `prompts/`

Os prompts ficam fora do código, em Markdown, e podem ser ajustados sem recompilar:
`prompts/triage/` (classificação), `prompts/implementation/` (plano, implementação e aviso de
retentativa) e `prompts/research/` (investigação).

---

<div align="center">
<sub>🤖 Feito com Claude · CashMe · uso interno</sub>
</div>
