# opencode-config

My personal [opencode](https://opencode.ai) configuration, including provider definitions, oh-my-opencode agent routing, and custom plugins.

## Structure

```
~/.config/opencode/
├── opencode.json          # Real config with API keys (gitignored)
├── opencode.json.example  # Template — copy this and fill in your keys
├── oh-my-opencode.json    # Agent/category routing (relay providers)
├── oh-my-opencode.dr.json # Agent/category routing (direct providers)
├── package.json           # Plugin dev dependency
└── plugins/
    ├── gotify-notify.js   # Push notifications via Gotify
    └── omo-env-remover.js # Stabilize system prompt for better cache hits
```

## Quick Setup on a New Server

### 1. Prerequisites

Install [bun](https://bun.sh):
```bash
curl -fsSL https://bun.sh/install | bash
```

Install opencode:
```bash
bun install -g opencode-ai
```

### 2. Clone this repo

```bash
git clone git@github.com:yang1997434/opencode-config.git ~/.config/opencode
```

### 3. Configure API keys

```bash
cp ~/.config/opencode/opencode.json.example ~/.config/opencode/opencode.json
```

Edit `opencode.json` and replace the placeholders:
- `YOUR_OPENAI_RELAY_API_KEY` — OpenAI-compatible relay key
- `YOUR_GOOGLE_RELAY_API_KEY` — Google/Gemini relay key
- `YOUR_AIPRO_API_KEY` — AIPro relay key

### 4. Install plugin dependencies

```bash
cd ~/.config/opencode && bun install
```

### 5. (Optional) Gotify push notifications

Set environment variables for the `gotify-notify.js` plugin:

```bash
export GOTIFY_URL="https://your-gotify-server.com"
export GOTIFY_TOKEN_FOR_OPENCODE="your-app-token"
```

Optional summarizer (uses an LLM to summarize completion messages):
```bash
export GOTIFY_NOTIFY_SUMMARIZER_MODEL="gpt-4o-mini"
export GOTIFY_NOTIFY_SUMMARIZER_ENDPOINT="https://api.openai.com/v1"
export GOTIFY_NOTIFY_SUMMARIZER_API_KEY="your-key"
```

## oh-my-opencode

This config uses [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode) for agent/category-based model routing.

- `oh-my-opencode.json` — routes agents/categories to relay providers (aipro, google relay, openai relay)
- `oh-my-opencode.dr.json` — alternative routing using direct Anthropic/OpenAI providers

To switch between them, rename the file you want active to `oh-my-opencode.json`.

## Plugins

| Plugin | Purpose |
|--------|---------|
| `gotify-notify.js` | Sends push notifications on session completion, errors, and permission requests |
| `omo-env-remover.js` | Strips the dynamic `<omo-env>` block from system prompts to improve prompt cache hit rates |
