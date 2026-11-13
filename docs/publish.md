# 发布：GitHub + Cloudflare Pages（CS）

机器上的 Cursor / agent 发布洋葱时，按 skill **onion-publish** 执行。本页是细则。

## 前提

- 工作目录：`/home/hello/application/green/onion`
- `git remote` 指向 `heartthings/onion`（服务器上已设为 `git@github.com:heartthings/onion.git`）
- 本机已登录 Cloudflare：`npx wrangler whoami` 能看到 Pages 写权限
- 本机 `git push` 能推到 `origin`（HTTPS token 或 SSH key）

## 标准流程

```bash
cd /home/hello/application/green/onion
npx tsc --noEmit
npm run build
# 若用户要求提交：
git add -A
git status && git diff && git log -5 --oneline
git commit -m "$(cat <<'EOF'
……英文祈使句，说明为什么。

EOF
)"
git push origin HEAD
npx wrangler pages deploy dist \
  --project-name onion \
  --branch main \
  --commit-hash "$(git rev-parse HEAD)" \
  --commit-message "$(git log -1 --pretty=%s)"
```

验证：

```bash
curl -s https://onion.gripe/ | grep -o 'index-[^"]*\.js' | head -1
ls dist/assets/index-*.js
# 两个文件名应一致
```

## 注意

- **不要**把 API Key、`.env`、wrangler OAuth token 写进仓库。  
- Pages git 集成不能代替 wrangler 部署。  
- 推送失败先查网络与凭据，不要强推 `main`。  
- 公网 frp / nginx 那套（`publish-web` skill）**不是**洋葱生产链路；洋葱生产走 Cloudflare Pages。
