# Voice & Content

文案是设计的一部分，保持精确、无废话。以下规范取自 Vercel Geist（`vercel.com/design` → Voice & Content），生成任何 UI 文本时遵循。

## 大小写

- **Title Case**：标签、按钮、标题、标签页（`Deploy Project`、`API Keys`）。
- **Sentence case**：正文、帮助文本、toast（`Your changes are saved automatically.`）。

## 动作命名

- 用**动词 + 名词**：`Deploy Project`、`Delete Member`、`Create Endpoint`。
- **禁止**裸 `Confirm`、`OK`、单个动词。

## 错误信息

格式 = **发生了什么 + 下一步怎么办**：

> `Build failed. Bundle exceeds 50 MB. Reduce it or raise the limit.`

不要只说 `Error` 或 `Something went wrong`。

## Toast

- 点明**具体变更的对象**，**去掉句末句号**，**绝不用 "successfully"**：
  - ✅ `Project deleted`
  - ❌ `Successfully deleted the project.`

## 空状态

指向**第一个动作**：

> `No deployments yet. Push to your Git repository to create one.`

## 进行中状态

用**现在分词 + 省略号**（用省略号字符 `…`，非三个点）：`Deploying…`、`Saving…`。

## 其它

- 用**数字**（`3 projects`，不是 `three projects`）。
- 用**弯引号**（`"…"`）和**省略号字符**（`…`）。
- **跳过** `please` 和营销式最高级（"blazing fast"、"amazing"…）。

## 应用到 API 文档场景组件

本 starter 面向 API 文档领域（`EndpointHeader`、`ParamsTable`、`CodeSample`、`ResponseBlock`），文案尤其要严谨：

- HTTP 方法、状态码、参数名用 **Mono**（`font-mono`），保持 tabular。
- 参数说明用 sentence case，必填/可选用标签而非仅颜色（配合 `focus-a11y.md` 的"不要只用颜色"）。
- 错误响应示例遵循"发生了什么 + 怎么办"。
- 端点动作按钮用动词+名词（`Send Request`、`Copy cURL`）。

## 源码参考

- Geist 规范：`vercel.com/design`（Voice & Content）
