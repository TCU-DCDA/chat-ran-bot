# Sandra — AI Chat Layer

The shared AI chat service powering contextual advising panels embedded inside department wizards in the [Advising Ecosystem](https://github.com/curtrode/ecosystem-docs).

Sandra answers questions about program requirements, career paths, and course selection using structured data from each wizard's advising manifest. The service is privacy-aware by design: no student login and no access to official student record systems. For development, testing, and limited pilot use, chat processing runs on Firebase-hosted services managed by the project team; broader institutional deployment is contingent on formal TCU review and TCU-approved infrastructure and controls.

## How It Works

Sandra is accessed exclusively through the chat panel built into each department wizard (e.g., [Engelina](https://english.digitcu.org), [Ada](https://dcda.digitcu.org)). Standalone access is disabled.

When a student opens the chat panel from within a wizard, Sandra receives the student's current planning context (program, selected courses) as a `wizardContext` string on each request. Two integration patterns are in use today:

- **Direct HTTP POST** (Ada, DCDA wizard) — `AdaPanel.tsx` posts the chat message, conversation history, `wizardContext`, and `personaName` directly to the `/api` Cloud Function. No iframe.
- **Embedded iframe + `postMessage`** (Engelina, English wizard) — the English wizard embeds Sandra's chat UI as an iframe and passes context through `postMessage` to that UI, which in turn calls `/api`.

Either way, Sandra answers questions informed by what the student is actively working on — no need to re-explain.

```
Department Wizard (Ada, Engelina, ...)
  └── Chat Panel (direct POST or iframe + postMessage)
        └── Sandra Cloud Function (/api)
              ├── Persona scope (Ada → DCDA only, Engelina → English only, Sandra → all)
              ├── Manifest registry + TTL cache (SWR)
              ├── Stable prefix + ephemeral prompt cache
              ├── Claude Sonnet 4 API
              └── Firestore (conversations, analytics)
```

## Architecture

| Component | Description |
|-----------|-------------|
| `functions/index.js` | Main Cloud Function — chat endpoint, feedback, admin API |
| `functions/manifest-loader.js` | Fetches and caches wizard manifests with TTL + stale-while-revalidate |
| `functions/manifest-to-context.js` | Converts manifest data into Claude context blocks |
| `functions/wizard-registry.json` | Registry of manifest URLs per department |
| `functions/program-data/` | Static fallback data for non-wizard departments (60 JSON files) |
| `public/index.html` | Chat UI (embed-only) |
| `public/admin.html` | Admin dashboard — conversation analytics, article management, feedback |
| `schemas/` | Manifest schema (copied from english-advising-wizard source of truth) |

## Key Features

- **Manifest pipeline**: Consumes structured data from any wizard that publishes an advising manifest. Adding a department expands Sandra's knowledge automatically.
- **Fallback chain**: Live manifest → Firestore cache → static JSON. Fail-closed per department on invalid schema.
- **Anonymous analytics**: Conversation logging with topic detection, program mentions, feedback tracking. No PII.
- **Rate limiting**: Per-IP limits, postMessage origin validation, Firebase security rules.
- **13 Cloud Functions**: chat, feedback, admin (conversations, articles, feedback), URL metadata, RSS feed checker, OpenAlex checker, relevance backfill, retention purge, and manual triggers.

## Local Development

```bash
cd functions && npm install && cd ..
firebase emulators:start
```

The app runs at http://127.0.0.1:5002

**API Key:** Create `functions/.secret.local` with:
```
ANTHROPIC_API_KEY=your-key-here
```

## Deployment

```bash
firebase deploy
```

## Tech Stack

| Component | Choice |
|-----------|--------|
| AI Model | Claude Sonnet 4 (Anthropic API) |
| Runtime | Firebase Cloud Functions v2 (Node.js 22) |
| Hosting | Firebase Hosting |
| Database | Firestore |
| Cost | $5–15/month at current usage |
