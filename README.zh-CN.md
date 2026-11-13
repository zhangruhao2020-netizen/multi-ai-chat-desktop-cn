# Multi-AI Chat Desktop

[English](./README.md) · [繁體中文](./README.zh-TW.md) · **简体中文** · [日本語](./README.ja.md) · [Deutsch](./README.de.md)

只问一次，让五个已登录的 AI 网页会话互相回答、审查、质疑，再一起打磨结果。**ChatGPT、Claude、DeepSeek、Gemini、Grok 是默认阵容；Meta AI 是设置中实验性的备用选项。** Multi-AI Chat Desktop 是以 Tauri 2 打造的多 AI workflow 中枢，不只是把五个聊天窗口并排放在一起。

[**访问官方网站 →**](https://ted-h-com.github.io/multi-ai-chat-desktop/) · [下载 v1.9.8](https://github.com/TED-H-com/multi-ai-chat-desktop/releases/tag/v1.9.8) · [所有版本](https://github.com/TED-H-com/multi-ai-chat-desktop/releases) · MIT · 不需 API Key · 无分析追踪

> 本应用自动化的是您已经在用的服务商网页。服务商界面的变更可能暂时破坏某个 adapter，自动化使用也可能受各服务商条款约束。请只使用您有权使用的账号和内容。本应用从不绕过登录、订阅、年龄、速率限制或安全检查。

> **项目状态：** 六个预设、五种底层 workflow 模式、snapshot/replay 工具，以及可选的 AI-Sister 纪念版均已功能冻结。本次桌面更新包含 ChatGPT 与 Claude 兼容性修复、更安全的回复投递与安全维护。

## 先安装

从 [**v1.9.8 下载页**](https://github.com/TED-H-com/multi-ai-chat-desktop/releases/tag/v1.9.8) 获取当前稳定版。

| 平台 | 下载 | 首次启动说明 |
|---|---|---|
| **Windows 10/11 x64** | `x64-setup.exe` 或便携版 `.zip` | 安装包未签名，SmartScreen 可能警告。WebView2 通常已存在；缺失时安装程序可以获取它。 |
| **macOS Apple Silicon** | `aarch64.dmg` | 临时签名，未经 Apple 公证。不提供 Intel 版本。首次启动请按下方步骤操作。 |
| **Linux x86_64** | `.AppImage` | 运行 `chmod +x Multi-AI*.AppImage`。推荐 Ubuntu 22.04 / Debian 12 或更新版本。 |

每个服务商窗格打开一次，在服务商的真实页面上登录。凭据和 cookies 保存在该服务商隔离的本地 WebView 配置中；Multi-AI Chat Desktop 从不向您索要密码。

在实验性的 Meta AI 路径中，访客、邮箱/手机或 Facebook/Instagram 登录请**在 Meta 窗格内**完成。在其他浏览器中的登录无法回到隔离的应用配置。

对于 DeepSeek，手机/邮箱、Google 或 Apple 登录请**在 DeepSeek 窗格内**完成。在其他浏览器中的登录无法回到隔离的应用配置。

### macOS 首次启动

1. 移除任何旧的 `v1.0.0` 副本。打开当前 DMG，把应用拖到**应用程序**。
2. 先尝试打开一次应用。
3. 在大约一小时内，打开**系统设置 → 隐私与安全性**，滚动到**安全性**，选择**仍要打开**并确认。

临时签名保护了包的完整性，避免了 `v1.0.0` 出现的“应用已损坏”误报；只有 Developer ID 签名加公证才能免除这一步。受管理的 Mac 可能禁止此操作。

便携版 Windows 构建不显示应用内更新控件，请从 [GitHub Releases](https://github.com/TED-H-com/multi-ai-chat-desktop/releases/latest) 手动更新。安装版可以检查新版本并打开其下载页，但应用本身不下载或安装更新。

## v1.9.8 新内容

- **保留 ChatGPT 的回答** 当匹配的用户消息节点缺失时，有效捕获的回复不再变成误报的发送确认错误。历史回复和 prompt 回声仍被排除。
- **读取 Claude 回复正文** Claude adapter v5 识别 CDS 助手回复布局，同时保留较旧的 selector。登录状态下的兼容性仍需实机复测。
- **保护下一轮** 上一轮或页面重载带来的延迟确认和回调，不再消耗或终止下一条回复。
- **维护隐私与依赖** 诊断中的 API-key 字段会被脱敏，有漏洞的依赖已刷新，更新检查使用当前仓库。

安装桌面更新以获得 engine 与 bridge 修复；只刷新 adapter 不够。Windows 与 Apple Silicon 的启动/登录复测仍待进行。

[v1.9.8 发布说明](https://github.com/TED-H-com/multi-ai-chat-desktop/releases/tag/v1.9.8)

## v1.9.6 新内容

- **ChatGPT 的 Chat/Work 布局。** 部分 ChatGPT 账号现在会得到更新的页面布局，缺少应用过去用来跟随对话的标记。应用现在从您的消息气泡确认发送，只读取最终答案，并等到答案的操作行出现才结束。您自己消息上的控件永远不会算作已完成的答案。
- **未登录的 Grok 显示登录。** 匿名访问 grok.com 时，Sign in / Sign up 是链接且发送按钮保留，窗格过去会显示就绪。现在它会显示登录——无论在主页，还是发送后进入 Grok 的注册付费墙时。
- **ChatGPT 更新的输入框。** ChatGPT 的 ProseMirror 输入框已被识别，可用于输入和就绪判断。
- **页面被替换会让步骤失败。** 正在等待某个服务商的步骤，现在会在该服务商的页面于本轮中途被替换时失败，而不是默默等到超时。检测依据是新的 bootId。Prompt 不会重新发送到替换后的页面，因为如果原来的发送已经落地，重发可能造成重复发送。
- **输入框填充会被计量。** 建议性的 `STATUS_REPORT` 字段 `fill`、`fillChars` 和 `fillMs` 只携带字符数。Prompt 文本从不进入载荷或事件日志。
- **ChatGPT 回复能到达应用。** 当 ChatGPT 用折叠的 turn 取代您的消息时，捕获所钉住的锚点会离开页面。捕获现在会保留已采用的锚点、忽略已脱离的锚点，并在观察到生成之后读取没有锚点的回复。已在屏幕上完成的回复不再等到步骤超时。
- **Meta 发送与接收已确认。** 一次 Windows 上的 v1.9.3 运行，通过 Meta AI 完成了两次圆桌发言。停止、新会话重置与配置持久化仍未验证。
- **Meta 登录会被识别。** 可见、可编辑的输入框即算作已登录，即使页面上还留着登录按钮或惰性占位符。
- **Meta 登录留在窗格内。** Facebook 和 Instagram 登录在应用内完成。在其他浏览器中的登录无法回到隔离的 Meta 配置。
- **Grok Heavy 的恢复生成计时器。** 如果 Grok 恢复其停止控件并继续生成、而中间答案没有变化，过期的静默计时器会被取消，应用会再次等待生成完成。
- **可选的 Meta AI 备用。** 六家可选，恰好五家启用。五家默认不变；设置可以替换其中一家。配置保留，角色与目标会修复到当前阵容。
- **DeepSeek 加入默认阵容。** DeepSeek 网页端（chat.deepseek.com）是默认服务商。其输入框、发送按钮与助手消息选择器沿用公开的 dscli-agent 默认值，尚未在本应用内以已登录会话验证过。
- **头像与诊断。** Meta AI 和 DeepSeek 各有自己的头像。事件日志和调试包会标出它们，且不保存 prompt 或回复。

阅读[发布说明](https://github.com/TED-H-com/multi-ai-chat-desktop/releases/tag/v1.9.6)。

## 桌面版还是浏览器扩展？

| | **桌面版（本仓库）** | [**浏览器扩展**](https://ted-h-com.github.io/multi-ai-chat/) |
|---|---|---|
| 最适合 | 完整的引导式 workflow、聚焦的真实服务商视图、本地会话、snapshot/replay 和本地文本文件 | 在 Chrome 中配合已有服务商标签页轻量使用 |
| 运行方式 | Tauri 应用，每家服务商一份隔离的本地配置 | Chrome 侧边栏加普通浏览器标签页 |
| 安装 | Windows、Apple Silicon macOS 或 Linux 发布版 | [Chrome 网上应用店](https://chromewebstore.google.com/detail/multi-ai-chat/nomhpmmhkmolkmpkjfeainjoifkipdah)，审核通过的更新自动安装 |
| 共同核心 | 零 API Key、真实的已登录服务商页面、多服务商协作 | 零 API Key、真实的已登录服务商页面、多服务商协作 |

想要独立工作区和完整的本地 workflow 工具集时选桌面版；希望一切都留在 Chrome 里时选扩展版。

## 桌面版包含什么

- **一个问题，协调出的多份答案。** 让选定的服务商并行发送，或让结构化 workflow 在指定角色之间传递结果。
- **可靠的后台自动化。** 服务商窗格在未聚焦时仍能工作；背靠背发送被拒会重试一次，永久失败会明确呈现。
- **以对话为中心的工作区。** 对话记录可以扩展到整个窗口，服务商标签让实时页面和当前阅读位置易于辨认。
- **六个预设，五种稳定模式。** 自由分发、四方辩证、多方咨询、Coding、道理辩证，以及建立在冻结 workflow 运行时之上的额外头脑风暴预设。
- **可配置的角色。** 四角色默认让 ChatGPT、Claude、Gemini 和 Grok 各担任一次。按顺序执行的角色可以复用同一家服务商；并行执行的角色必须各不相同。
- **可选的 Meta AI 备用。** 设置可以恰好替换一家默认服务商。配置保留；角色与目标会修复到启用的五家。
- **本地连续性。** 开始一段干净对话，或重新打开最多 30 份本地保存的对话记录。恢复后的追问只获得同一会话内的有限上下文。
- **可读且忠实的输出。** 安全的语义 Markdown 支持标题、嵌套列表、链接、引用、代码块和可滚动表格，同时保留数学源码。只有图片的 ChatGPT 回复也能正常完成。
- **可复现的工作。** 可选的 snapshot 附带固定的隐私分级，还有 replay、checkpoint、Markdown 导出、服务商诊断，以及 2,000 条去重的内存日志。
- **界面语言与回复语言相互独立。** UI 支持 English、繁體中文、简体中文、日本語和 Deutsch。自动回复语言优先采用明确要求，其次是当前问题与对话，UI 语言只作兜底。
- **AI-Sister 纪念版。** 可选的四角色主题只装饰应用自有界面，从不给服务商页面换肤。
- **可由 Agent 启动的源码运行。** 显式调用的 Codex 与 Claude Code 仓库 Skills 可以审计前置条件并启动本地源码版应用，无需构建安装包。

## Workflows

| 预设 | 流程 | 适合用途 |
|---|---|---|
| **自由分发** | 选定的服务商并行回答 | 快速比较与绘图 prompt |
| **四方辩证** | 正方 → 反方 → 评判 → 综合 | 检验决策或论点 |
| **多方咨询** | 两份独立答案 → 审查 → 最终答案 | 研究与第二意见 |
| **Coding** | 规格 → 审查 → v1 → 测试 → v2 → 验收 → 最终版 | 结构化的软件规划与审查 |
| **道理辩证** | 5 轮 × 4 席 = 20 次发言 | 对困难问题进行缓慢的对抗式收敛 |
| **头脑风暴** | 12 轮 × 4 个轮换席位 = 48 次发言，分五个阶段 | 带完整上下文的构思、均衡的方案组合与具体实验 |

结构化 workflow 会预检每个必需角色。如果某家服务商不可用，应用会指出是哪一家，让您打开/登录、重新指派角色或改选其他模式；它从不悄悄替换服务商。一般的结构化 workflow 遇到持续的服务商错误会停止；头脑风暴则会暂停，等待您明确选择重试、跳过或取消。

头脑风暴刻意设计得很重：请让五家默认服务商会话都保持登录，并预留大约 **45 到 90 分钟**。其 48 次发言的恢复路径已有自动化覆盖；v1.9.6 没有新增真实账号的 ChatGPT↔Grok 慢速交接检查。

Workflow 结束后，可以从底部输入框继续同一段应用对话。需要干净的会话上下文时，请选择**新对话**。

## 隐私与安全

- 没有 API Key、Multi-AI Chat 账号、telemetry、analytics 或对话后端。
- Prompt 直接发往您选择的服务商页面。服务商仍会按其自身政策接收和处理这些内容。
- 每家服务商的 cookies 和浏览器配置保留在本地应用数据下，从不复制到 snapshot 或诊断中。
- 远程服务商 webview 不受信任，且拥有**零 Tauri 权限**。只有捆绑的本地控制窗格能调用应用命令。
- 可选的 adapter 更新是纯数据的 JSON，经过 schema 校验，不能扩展应用捆绑的服务商/登录/SSO URL 范围。
- Snapshot 是可选且本地的，附带出厂的 `metadata-only`、`hashes`、`prompt-text` 和 `full-local` 隐私分级。没有自动的整段对话上传或分享通道。
- 调试包、Markdown 导出以及分享/发布动作只在用户明确操作后运行。Adapter 诊断排除页面文本、输入值、cookies、存储、URL 查询和片段。

请通过 [SECURITY.md](./SECURITY.md) 私下报告漏洞；切勿在公开 issue 中放入 cookies、token、账号数据、对话、服务商 HTML 或本地配置文件。服务商自动化回归问题，可以在查看应用内诊断预览后使用 **Adapter broken** issue 表单。

## 已知限制与验证状态

- 服务商网站可能在无通知的情况下变更。DOM 或登录流程的变化可能暂时破坏自动输入、发送或完成检测，直到 adapter 更新发布。
- 服务商的账号、订阅、配额、地区可用性、条款和安全验证仍然适用。本应用既不自动化也不绕过它们。Claude 需要已认证的账号；Gemini 遇到 Google `/sorry` 拦截时可能需要系统浏览器指引；Grok 的验证必须在其窗格中手动完成。
- **Windows x64** 有已验证的打包启动证据，但安装包未签名，可能触发 SmartScreen。
- **macOS Apple Silicon** 部分验证。DMG 是临时签名且未公证；一份较早的真机报告打开了应用并登录了 ChatGPT、Claude 和 Gemini，而 Grok 停留在 Cloudflare。当前的 Grok 恢复仍需在 Apple Silicon 上实机复测。没有 Intel 版本。
- **Linux x86_64** 打包只有 CI 验证；没有维护者当前的真机启动报告。
- v1.9.6 的变更只有自动化覆盖，尚未实机复测。没有可用的 Chat/Work 账号，也没有捕获到已登录的 Grok 页面实况，因此下一次实机检查是：用一个 Chat/Work 账号自动发送一条 prompt，以及已登录的 Grok 窗格保持就绪。自 2026-09-30 起，已安装的应用通过 adapter 更新（启动时及每六小时）获取 Grok 和 ChatGPT 的 adapter 更新，但 ChatGPT Chat/Work 的 engine 变更需要 v1.9.6。如果某个服务商 engine 在其页面从未被替换的情况下沉默或卡住，仍会等满 10 分钟无活动窗口和 60 分钟绝对上限。Meta 和 DeepSeek 保持 `inputStrategy: "default"`。Meta 的停止、新会话重置和配置持久化仍未验证，Grok Heavy 未经演练。此前的 Windows 打包启动证据、较早的 Apple Silicon 上 ChatGPT/Claude/Gemini 登录报告（Grok 停留在 Cloudflare）以及 Linux 仅 CI 打包，仍是当前记录。v1.9.6 没有新的 Windows、macOS 或 Linux 启动检查。
- Meta AI 的访客、邮箱/手机或 Facebook/Instagram 登录必须在 Meta 窗格内完成。在其他浏览器中的登录无法回到本应用。
- DeepSeek 的手机/邮箱、Google 或 Apple 登录必须在 DeepSeek 窗格内完成。在其他浏览器中的登录无法回到本应用。DeepSeek 选择器取自公开的 dscli-agent 默认值（dscli-agent 0.6.0），未登录的登录页已于 2026-11-13 检查过，但尚未在本应用内以已登录会话实际发送/接收过。
- Snapshot/replay/checkpoint 以其已发布形态做兼容性维护。除 DeepSeek 默认服务商与实验性的 Meta AI 备用外，这个功能冻结的版本不计划做应用市场、图编辑器、更多服务商扩展、新的持久化 schema、内嵌终端 Agent、telemetry 路线图、Developer ID/公证计划或自更新器。

参见基于证据的[兼容性矩阵](./docs/COMPATIBILITY.md)。CI 和自动化测试从不会被表述为真实服务商账号或真实桌面设备已被演练的证明。

## 用 Codex 或 Claude Code 从源码启动

打开或克隆本仓库不会执行它。从源码启动则会执行受信任的检出、JavaScript 依赖生命周期脚本以及 Rust 构建脚本/过程宏，因此请先审阅仓库。

本仓库包含两个显式的本地 Skills：

- Codex：[`.agents/skills/launch-multi-ai-chat/SKILL.md`](./.agents/skills/launch-multi-ai-chat/SKILL.md)：在本地 Codex 应用、CLI 或 IDE 任务中调用 `$launch-multi-ai-chat`。
- Claude Code：[`.claude/skills/launch-multi-ai-chat/SKILL.md`](./.claude/skills/launch-multi-ai-chat/SKILL.md)：在本地图形化 Claude Code 会话中调用 `/launch-multi-ai-chat`。

这些 Skills 只能安装锁定的项目依赖、构建生成代码并启动 `tauri dev`。它们从不安装/移除宿主机工具链或全局包，不修改 `PATH` 或安全设置，不构建发布安装包，不读取服务商凭据，不上传回执，也不回滚宿主机变更。远程/云端 Agent 无法在您的电脑上显示 GUI。本项目刻意不提供 Docker 通道。

常见前置条件是 **Node.js ^22.13.0 || >=24.0.0**、pnpm/Corepack、稳定版 Rust，以及 [Tauri 2 平台前置条件](https://v2.tauri.app/start/prerequisites/)。第一次 Rust 构建可能需要几分钟。带版本的契约在 [`agent-release.json`](./agent-release.json) 和 [`docs/AGENT-READY-SOURCE-RELEASE.md`](./docs/AGENT-READY-SOURCE-RELEASE.md) 中。

## 开发

核心模块的详细规格和开发者使用示例见 [API 参考](./docs/API_REFERENCE.md)：
- `src/host`：桥接后端（Tauri）的 host API 代理。
- `src/bridge`：处理与服务商 webview 通信的自动化 bridge。
- `src/workflow`：编排 AI 服务商 workflow 的 workflow engine。

```sh
corepack enable # only if pnpm is unavailable
pnpm install --frozen-lockfile
pnpm verify
pnpm tauri dev
```

有用的生命周期检查：

```sh
node scripts/agent/doctor.mjs --json
node scripts/agent/launch.mjs --dry-run --json
node scripts/agent/launch.mjs --wait --timeout-ms 600000 --json
node scripts/agent/status.mjs --json --lines 80
node scripts/agent/stop.mjs --json
```

只有当前运行经身份验证的 `[MAC_AGENT] READY control-pane` 标记才表示源码应用已就绪。运行时状态和前后审计回执保留在被忽略的 `.agent-runtime/` 中，不会自动上传。`pnpm tauri build` 为当前平台构建安装包。

在改变行为之前，请阅读[规格](./docs/SPEC.md)、[架构](./docs/ARCHITECTURE.md)、[发布指南](./docs/RELEASE.md)、[源码启动契约](./docs/AGENT-READY-SOURCE-RELEASE.md)和[贡献指南](./CONTRIBUTING.md)。Adapter 变更必须保留 schema 和 URL 边界。

## 项目与致谢

Multi-AI Chat Desktop 是 MIT 许可的软件，由 **Ted Huang / TED-H**（[TED@TED-H.com](mailto:TED@TED-H.com)、[ted-h.com](https://ted-h.com)）创建，并由 [AI-Sister.com](https://ai-sister.com) 赞助。纪念版美术作品经项目特定许可纳入，并不独立按 MIT 软件许可提供；见其[美术作品声明](./src/assets/themes/ai-sister/NOTICE.md)。

贡献者致谢：

- [Rumi-3653](https://github.com/Rumi-3653) 在 [#78](https://github.com/TED-H-com/multi-ai-chat-desktop/pull/78) 贡献了 ChatGPT v7 未登录检测修复。
- [George Ku (`@ufgeorge`)](https://github.com/ufgeorge) 在 [#80](https://github.com/TED-H-com/multi-ai-chat-desktop/issues/80) 报告了服务商限制导致的头脑风暴中断，促成了 v1.8.6 的恢复流程。
- [Dave Tseng (`@DaveTseng2019`)](https://github.com/DaveTseng2019) 贡献了 `v1.3.1` 浮层可靠性修复；在 [#10](https://github.com/TED-H-com/multi-ai-chat-desktop/pull/10)、[#11](https://github.com/TED-H-com/multi-ai-chat-desktop/pull/11) 和 [#12](https://github.com/TED-H-com/multi-ai-chat-desktop/pull/12) 有详细的复现和提案；在 [#14](https://github.com/TED-H-com/multi-ai-chat-desktop/pull/14) 有序列化回归测试；在 [#39](https://github.com/TED-H-com/multi-ai-chat-desktop/pull/39) 和 [#40](https://github.com/TED-H-com/multi-ai-chat-desktop/pull/40) 有 Grok 验证和扩展焦点的工作；以及在 [#51](https://github.com/TED-H-com/multi-ai-chat-desktop/pull/51) 的全宽对话记录与滚动联动的服务商焦点。
- [CE Lin (`@ChingEnLin`)](https://github.com/ChingEnLin) 在 [#41](https://github.com/TED-H-com/multi-ai-chat-desktop/issues/41) 提供了服务商状态报告，并在 [#42](https://github.com/TED-H-com/multi-ai-chat-desktop/pull/42) 贡献了 ChatGPT、Gemini 和 Grok 的 adapter 修复。
- Windows 和 macOS 用户分享了可复现的报告和脱敏的调试日志，改进了首次启动打包、服务商自动化、会话连续性和发布验证。

在冻结的维护范围内欢迎 issue 和 pull request。可复现的非安全 bug 和维护问题请使用 [GitHub Issues](https://github.com/TED-H-com/multi-ai-chat-desktop/issues)。
