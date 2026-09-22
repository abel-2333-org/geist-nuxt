# API Docs 层级浏览器回归

从当前 checkout 构建并启动 gallery，然后在另一终端执行：

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm build
PORT=3015 HOST=127.0.0.1 node .output/server/index.mjs
```

```sh
BASE_URL=http://127.0.0.1:3015 pnpm test:browser:hierarchy
```

`BASE_URL` 必须指向同一 checkout 的运行实例。脚本记录的是执行目录 Git HEAD；它不能从任意远程 URL 证明部署来源。开发模式可用于调试，最终验收使用生产构建。CI 在 build 后运行并上传 `hierarchy-browser-<SHA>` artifact（保留 30 天）；PR 事件的 SHA 为 synthetic merge SHA，应结合该次 run 的 PR head 阅读。

输出在 `output/playwright/pr153/`：独立 PNG 截图与 `report.json`（HEAD、Chromium 版本、ARIA 生命周期、测量与断言结果）。运行失败也写报告；先确认 `status`，不要把已有截图当作成功结果。输出默认不入 Git，可用 `EVIDENCE_DIR` 指定独立目录，避免覆盖上一次结果。

覆盖范围以脚本断言和报告为准：真实 Tab / Enter / Space、焦点环、折叠目标显隐、重复深链接、浏览器 arrival cue、明暗 × 1024/375/320 布局，以及 compact 长记号压力样例。长记号通过明确的 DOM 替换构造，仅证明当前样式的换行能力，不等于作者 fixture 的渲染测试。

SSR 通过禁用 JavaScript 的独立浏览器 context 读取；客户端阶段另等 Nuxt hydration 完成。`aria-controls` 初始空值只作观测，不固化为必须保持的行为。隐藏属性、焦点行为与辅助技术树不是同一层证据。本脚本不代表 VoiceOver/NVDA 实测、不代替人工视觉采纳，也不验证真实消费项目安装。历史截图和旧 agent 的通过记录不是本次输出。
