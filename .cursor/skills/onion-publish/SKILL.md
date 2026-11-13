---
name: onion-publish
description: >-
  把洋葱（Onion）代码提交并推到 GitHub，再部署到 Cloudflare Pages（也叫 CS）。
  在用户说发布洋葱、推送 onion、上线 onion.gripe、同步 GitHub 和 CS/Cloudflare、
  或在 remote SSH 的 green/onion 目录要求发版时使用。
---

# 洋葱发布（GitHub + Cloudflare Pages / CS）

只处理洋葱这一条发布链。不要走 `publish-web` 的 frp/nginx 流程。

## 工作目录

```bash
cd /home/hello/application/green/onion
```

若目录不存在，先停下来告诉用户，不要在别的项目里发洋葱。

## 何时用

- 「推到 GitHub 和 CS」
- 「发布洋葱 / 部署 onion.gripe」
- 「把改动上线」

## 步骤

1. **确认现状**（并行）  
   - `git status -sb`  
   - `git diff` / `git diff --staged`  
   - `git log -5 --oneline`  
   - `git remote -v` 应包含 `https://github.com/heartthings/onion.git`

2. **对齐文档**  
   若行为有变，先改 `docs/product.md` / `docs/architecture.md` / `docs/data-model.md`，保持与 `src/` 一致。不要把过时内容写回 `docs/archive/` 当现行说明。

3. **检查**  
   ```bash
   npx tsc --noEmit
   npm run build
   ```

4. **提交（仅当用户明确要求提交时）**  
   - 不要提交密钥、`.env`、wrangler token、`node_modules`、`dist`（若未跟踪则保持忽略）  
   - 英文祈使句 commit message，说明为什么  
   - 用 HEREDOC：  
     ```bash
     git commit -m "$(cat <<'EOF'
     Fix the export menu clipping.

     EOF
     )"
     ```

5. **推 GitHub**  
   ```bash
   git push origin HEAD
   ```  
   失败就修凭据或网络，**禁止** `push --force` 到 `main`。

6. **部署 Cloudflare Pages（CS）**  
   ```bash
   npx wrangler pages deploy dist \
     --project-name onion \
     --branch main \
     --commit-hash "$(git rev-parse HEAD)" \
     --commit-message "$(git log -1 --pretty=%s)"
   ```  
   先确认：`npx wrangler whoami` 有 Pages 写权限。没有就请用户在本机执行 `npx wrangler login`，不要把 token 写进仓库或 skill。

7. **验收**  
   ```bash
   curl -s https://onion.gripe/ | grep -o 'index-[^"]*\.js' | head -1
   ls dist/assets/index-*.js
   ```  
   生产 HTML 引用的 bundle 名应与刚构建的 `dist/assets/index-*.js` 一致。向用户回报：commit、GitHub 是否已推、CS 预览/生产 URL。

## 硬规则

- 生产域名：https://onion.gripe  
- Pages 项目名：`onion`  
- 源码 remote：`heartthings/onion`，分支 `main`  
- 细则：`docs/publish.md`  
- 不把 SSH 密码、Cloudflare OAuth、模型 API Key 写进任何文件或提交
