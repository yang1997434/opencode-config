# opencode-config

Complete installation and configuration for [OpenCode](https://opencode.ai) with [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode) multi-model agent routing and **runtime failover**.

**Goal**: Any AI or human reading this can fully replicate this setup from scratch.

---

## Environment

| Component | Version | Notes |
|-----------|---------|-------|
| macOS | 26.3 (Build 25D125) | Apple Silicon (arm64) |
| OpenCode | 1.2.15 | Binary at `~/.opencode/bin/opencode` |
| Bun | 1.3.10 | JavaScript runtime (used by opencode plugins) |
| Node.js | v25.6.1 | Optional, not strictly required |
| oh-my-opencode | latest (npm) | Agent/category model routing plugin |

---

## Directory Structure

```
~/.opencode/                          # OpenCode binary + runtime
├── bin/opencode                      # Main binary (~108MB, Mach-O arm64)
├── package.json                      # Runtime dependencies
├── node_modules/                     # Runtime modules
└── .gitignore

~/.config/opencode/                   # Configuration (this repo)
├── opencode.json                     # API keys + providers (gitignored!)
├── opencode.json.example             # Template — copy & fill your keys
├── oh-my-opencode.json               # Agent/category routing config
├── oh-my-opencode.dr.json            # Alternative routing (direct providers)
├── package.json                      # Plugin dependency
├── plugins/
│   ├── gotify-notify.js              # Push notifications via Gotify
│   └── omo-env-remover.js            # Strip dynamic env for cache hits
├── mcp-servers/                      # Custom MCP server configs
│   └── smart-search/
├── node_modules/                     # Plugin modules (auto-installed)
└── bun.lock

~/.local/bin/                           # Custom scripts
├── opencode-usage-status              # Anthropic rate limit → tmux status bar
└── oc                                 # opencode + tmux launcher

~/.tmux.conf                            # tmux config (status bar with usage display)

~/.local/share/opencode/              # Data directory (auto-created)
├── auth.json                         # OAuth tokens (never commit!)
├── opencode.db                       # Session database (SQLite)
├── log/                              # Logs
├── storage/                          # Plugin storage
└── tool-output/                      # Tool output cache
```

---

## Step-by-Step Installation

### Step 1: Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
```

Verify:
```bash
bun --version
# Expected: 1.3.x or later
```

### Step 2: Install OpenCode

```bash
bun install -g opencode-ai
```

This installs:
- Binary to `~/.opencode/bin/opencode`
- Adds `~/.opencode/bin` to your PATH (via shell profile)

Verify:
```bash
opencode --version
# Expected: 1.2.15
```

If `opencode` is not found, add to your shell profile:
```bash
# For zsh (~/.zshrc):
export PATH="$HOME/.opencode/bin:$PATH"

# For bash (~/.bashrc):
export PATH="$HOME/.opencode/bin:$PATH"
```

### Step 3: Clone This Config

```bash
# If ~/.config/opencode already exists, back it up first
mv ~/.config/opencode ~/.config/opencode.bak 2>/dev/null

# Clone
git clone git@github.com:yang1997434/opencode-config.git ~/.config/opencode
```

### Step 4: Configure API Keys

```bash
cp ~/.config/opencode/opencode.json.example ~/.config/opencode/opencode.json
```

Edit `~/.config/opencode/opencode.json` and replace:
- `YOUR_AIPRO_API_KEY` — Your AIPro API key (get from [https://aipro.love](https://docs.aipro.love/))

### Step 5: Install Plugin Dependencies

```bash
cd ~/.config/opencode && bun install
```

This installs:
- `@opencode-ai/plugin` (v1.2.15)
- `zod` (dependency)

### Step 6: Authenticate with API Providers

OpenCode uses OAuth for Anthropic and OpenAI direct access. Run:

```bash
opencode auth login
```

This creates `~/.local/share/opencode/auth.json` with OAuth tokens.

**Important**: The oh-my-opencode routing sends requests to these providers:
- `anthropic/*` models → Anthropic API (requires Anthropic OAuth or API key)
- `openai/*` models → OpenAI API (requires OpenAI OAuth or API key)
- `aipro/*` models → AIPro relay (uses the key in opencode.json)

### Step 7: Launch OpenCode

```bash
opencode
```

---

## Configuration Deep Dive

### opencode.json — Provider & Plugin Config

The main config file defines:

1. **Plugins**: `oh-my-opencode@latest` for multi-model routing
2. **Providers**: Custom OpenAI-compatible providers (like AIPro) with model definitions

Current setup uses a single relay provider (AIPro) that provides access to both **Claude** and **Gemini** models via an OpenAI-compatible API:

- **Claude models via AIPro** (`aipro/claude-opus-4-6`, `aipro/claude-sonnet-4-6`): used as **fallback targets** when direct Anthropic API is down
- **Gemini models via AIPro**: used for visual-engineering, artistry, writing, and multimodal tasks

### oh-my-opencode.json — Agent & Category Routing

This is the brain of the multi-model setup. It routes different agent roles and task categories to specific models, with **automatic failover**.

#### Agent Routing

| Agent | Model | Variant | Fallback Chain | Role |
|-------|-------|---------|---------------|------|
| **sisyphus** | anthropic/claude-opus-4-6 | max | aipro/claude-opus-4-6 → openai/gpt-5.2 | Main orchestrator |
| **hephaestus** | openai/gpt-5.3-codex | medium | anthropic/claude-opus-4-6 → aipro/claude-opus-4-6 | Implementation worker |
| **oracle** | openai/gpt-5.2 | high | anthropic/claude-opus-4-6 → aipro/claude-opus-4-6 | Architecture consultant |
| **librarian** | anthropic/claude-sonnet-4-6 | — | aipro/claude-sonnet-4-6 → aipro/gemini-3.1-pro-preview | Reference search |
| **explore** | anthropic/claude-haiku-4-5 | — | aipro/gemini-3-flash | Codebase grep |
| **multimodal-looker** | aipro/gemini-3-flash-preview | — | aipro/gemini-3-flash → aipro/gemini-2.5-pro | Image/PDF analysis |
| **prometheus** | anthropic/claude-opus-4-6 | max | aipro/claude-opus-4-6 → openai/gpt-5.2 | Planning |
| **metis** | anthropic/claude-opus-4-6 | max | aipro/claude-opus-4-6 → openai/gpt-5.2 | Pre-planning analysis |
| **momus** | openai/gpt-5.2 | medium | anthropic/claude-opus-4-6 → aipro/claude-opus-4-6 | Plan review/QA |
| **atlas** | anthropic/claude-sonnet-4-6 | — | aipro/claude-sonnet-4-6 → aipro/gemini-3.1-pro-preview | General support |

#### Category Routing

| Category | Model | Variant | Fallback Chain | Use Case |
|----------|-------|---------|---------------|----------|
| **visual-engineering** | aipro/gemini-3.1-pro-preview | — | aipro/gemini-2.5-pro → anthropic/claude-sonnet-4-6 | Frontend, UI/UX |
| **ultrabrain** | openai/gpt-5.3-codex | xhigh | anthropic/claude-opus-4-6 → aipro/claude-opus-4-6 | Hard logic problems |
| **deep** | openai/gpt-5.3-codex | medium | anthropic/claude-opus-4-6 → aipro/claude-opus-4-6 | Deep research |
| **artistry** | aipro/gemini-3.1-pro-preview | — | aipro/gemini-2.5-pro → anthropic/claude-sonnet-4-6 | Creative problem-solving |
| **quick** | anthropic/claude-haiku-4-5 | — | aipro/gemini-3-flash | Trivial changes |
| **unspecified-low** | anthropic/claude-sonnet-4-6 | — | aipro/claude-sonnet-4-6 → aipro/gemini-3.1-pro-preview | Misc low-effort |
| **unspecified-high** | anthropic/claude-opus-4-6 | max | aipro/claude-opus-4-6 → openai/gpt-5.2 | Misc high-effort |
| **writing** | aipro/gemini-3-flash-preview | — | aipro/gemini-3-flash → anthropic/claude-sonnet-4-6 | Documentation |

#### Runtime Fallback (Disaster Recovery)

Enabled via oh-my-opencode's `runtime_fallback` feature. When the primary model returns a retryable error (429, 500, 502, 503, 504, 529), it automatically tries the next model in the fallback chain.

```json
"runtime_fallback": {
  "enabled": true,
  "retry_on_errors": [429, 500, 502, 503, 504, 529],
  "max_fallback_attempts": 3,
  "cooldown_seconds": 60,
  "timeout_seconds": 30,
  "notify_on_fallback": true
}
```

**Fallback strategy**:
- **Anthropic down** → AIPro relay (same Claude model) → OpenAI cross-vendor
- **OpenAI down** → Anthropic → AIPro relay
- **AIPro down** → other AIPro model → Anthropic direct

Three providers, three independent failure domains. All three going down simultaneously is extremely unlikely.

#### Alternative Routing: oh-my-opencode.dr.json

The `.dr.json` (direct) file routes everything through direct Anthropic/OpenAI APIs. To switch:

```bash
cd ~/.config/opencode
cp oh-my-opencode.json oh-my-opencode.relay.json   # backup current
cp oh-my-opencode.dr.json oh-my-opencode.json       # switch to direct
```

### Plugins

| Plugin | File | Purpose |
|--------|------|---------|
| **gotify-notify** | `plugins/gotify-notify.js` | Sends push notifications on session completion, errors, and permission requests via [Gotify](https://gotify.net) |
| **omo-env-remover** | `plugins/omo-env-remover.js` | Strips the dynamic `<omo-env>` block (timezone, locale) from system prompts to improve prompt cache hit rates |

#### Gotify Setup (Optional)

```bash
export GOTIFY_URL="https://your-gotify-server.com"
export GOTIFY_TOKEN_FOR_OPENCODE="your-app-token"

# Optional: LLM-powered message summarization
export GOTIFY_NOTIFY_SUMMARIZER_MODEL="gpt-4o-mini"
export GOTIFY_NOTIFY_SUMMARIZER_ENDPOINT="https://api.openai.com/v1"
export GOTIFY_NOTIFY_SUMMARIZER_API_KEY="your-key"
```

---

## Troubleshooting

### "Token refresh failed: 400"

OAuth refresh token expired or revoked. Fix:

```bash
opencode auth login
```

This re-authenticates and generates new tokens in `~/.local/share/opencode/auth.json`.

Common causes:
- Token expired after long idle period
- Provider revoked the token
- `auth.json` corrupted

### "opencode: command not found"

Ensure `~/.opencode/bin` is in your PATH:

```bash
echo 'export PATH="$HOME/.opencode/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Plugin install fails

```bash
cd ~/.config/opencode
rm -rf node_modules bun.lock
bun install
```

### Model routing not working

1. Verify `oh-my-opencode.json` exists in `~/.config/opencode/`
2. Check that `"oh-my-opencode@latest"` is in the `plugin` array of `opencode.json`
3. Ensure model names match provider definitions (e.g., `aipro/gemini-3-flash` requires `aipro` provider with `gemini-3-flash` model defined)

---

## Security Notes

**Never commit these files:**
- `opencode.json` — contains API keys
- `auth.json` — contains OAuth tokens
- Any `.env` files with credentials

The `.gitignore` in this repo already excludes:
```
node_modules/
bun.lock
opencode.json
skills/
*.bak
*.bak.*
```

---

## Quick Reference: File Locations

| File | Path | Purpose |
|------|------|---------|
| Binary | `~/.opencode/bin/opencode` | OpenCode executable |
| Main config | `~/.config/opencode/opencode.json` | Providers + API keys |
| Agent routing | `~/.config/opencode/oh-my-opencode.json` | Model assignments + fallback |
| Auth tokens | `~/.local/share/opencode/auth.json` | OAuth credentials |
| Session DB | `~/.local/share/opencode/opencode.db` | Chat history |
| Logs | `~/.local/share/opencode/log/` | Debug logs |
