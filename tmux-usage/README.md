# tmux-usage — Anthropic 额度监控

在 tmux 状态栏实时显示 Anthropic API 额度（5h / 7d / Sonnet / Opus），带 mini 进度条和渐变色。

## 效果

```
5h █░░░░░ 14% 3h21m │ 7d ░░░░░░ 8% 5d21h │ son ░░░░ 2%
```

- 绿(<50%) → 黄(50-70%) → 橙(70-90%) → 红(>90%)
- reset 时间自动计算倒计时
- 30s 自动刷新（带本地缓存，不重复请求）

## 前提

- 已在 OpenCode 中通过 OAuth 登录 Anthropic（`/connect` → Anthropic）
- 登录后会生成 `~/.local/share/opencode/auth.json`，脚本从这里读 token
- 需要 Node.js（任意版本，无额外依赖）
- 需要 tmux

## 安装

```bash
# 1. 复制脚本
mkdir -p ~/.local/bin
cp opencode-usage-status ~/.local/bin/
cp oc ~/.local/bin/
chmod +x ~/.local/bin/opencode-usage-status ~/.local/bin/oc

# 2. 复制 tmux 配置（或合并到你现有的 .tmux.conf）
cp tmux.conf ~/.tmux.conf

# 3. 确保 ~/.local/bin 在 PATH 中
# 在 ~/.zshrc 或 ~/.bashrc 中加入：
export PATH="$HOME/.local/bin:$PATH"

# 4. 重载 tmux
tmux source-file ~/.tmux.conf
```

## 文件说明

| 文件 | 作用 |
|------|------|
| `opencode-usage-status` | 读取 OpenCode OAuth token，调 Anthropic API，输出 tmux 格式的额度条 |
| `tmux.conf` | tmux 状态栏配置：左=session名，右=额度+时间，30s 刷新 |
| `oc` | 启动器：自动创建 tmux session 并在其中运行 opencode |

## Token 刷新

脚本会自动用 refresh token 续期过期的 access token，并写回 `auth.json`。
如果 refresh token 也失效，状态栏显示 `⏳`，此时需在 OpenCode 中重新 `/connect` Anthropic。
