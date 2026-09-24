# PR153 原生 Chrome UI Find：81dcd5e 对照固定基线

实际被测 HEAD：`81dcd5ea916ec608a82ba8811978a95b513ec27b`；固定基线：`19a107527d1226585611f4547619320b430fab2a`。Chrome `153.0.8010.53`，同一进程、配置和标签页，正常生产动画、浅色主题。来源见 [source.json](source.json)，原始读数见 [observations.json](observations.json)。

结论：12场景采集完成，未发现本轮HEAD特有回归。两侧各3个初始关闭场景均0/0且未揭示，不能判为查找通过；两侧各3个开后稳定关闭场景均首次1/1、可信beforematch、揭示成功且无残留inert，后续内容键盘导航可用。建议将初始关闭共有问题单列范围裁定，不扩大本PR生产修复。

|侧|入口|初态|查询文字|匹配|揭示 / trusted beforematch|最终 expanded / hidden / inert|键盘检查|截图|
|---|---|---|---|---|---|---|---|---|
|base|children|初始关闭|`Connected repository id.`|0/0|否 / 无事件|false / 空属性普通hidden / false|未揭示，不验收内部导航|[截图](base-children-initial.jpg)|
|base|children|开后稳定关闭|`Connected repository id.`|1/1|是 / 是|true / 无 / false|目标copy按钮 Tab → ref|[截图](base-children-opened-closed.jpg)|
|base|value|初始关闭|`3DS challenge`|0/0|否 / 无事件|false / 空属性普通hidden / false|未揭示，不验收内部导航|[截图](base-value-initial.jpg)|
|base|value|开后稳定关闭|`3DS challenge`|1/1|是 / 是|true / 无 / false|目标copy按钮 Tab → products|[截图](base-value-opened-closed.jpg)|
|base|anyOf|初始关闭|`+14155550132`|0/0|否 / 无事件|false / 空属性普通hidden / false|未揭示，不验收内部导航|[截图](base-anyof-initial.jpg)|
|base|anyOf|开后稳定关闭|`+14155550132`|1/1|是 / 是|true / 无 / false|目标copy按钮 Tab → sms_opt_in|[截图](base-anyof-opened-closed.jpg)|
|head|children|初始关闭|`Connected repository id.`|0/0|否 / 无事件|false / 空属性普通hidden / false|未揭示，不验收内部导航|[截图](head-children-initial.jpg)|
|head|children|开后稳定关闭|`Connected repository id.`|1/1|是 / 是|true / 无 / false|目标copy按钮 Tab → ref|[截图](head-children-opened-closed.jpg)|
|head|value|初始关闭|`3DS challenge`|0/0|否 / 无事件|false / 空属性普通hidden / false|未揭示，不验收内部导航|[截图](head-value-initial.jpg)|
|head|value|开后稳定关闭|`3DS challenge`|1/1|是 / 是|true / 无 / false|目标copy按钮 Tab → products|[截图](head-value-opened-closed.jpg)|
|head|anyOf|初始关闭|`+14155550132`|0/0|否 / 无事件|false / 空属性普通hidden / false|未揭示，不验收内部导航|[截图](head-anyof-initial.jpg)|
|head|anyOf|开后稳定关闭|`+14155550132`|1/1|是 / 是|true / 无 / false|目标copy按钮 Tab → sms_opt_in|[截图](head-anyof-opened-closed.jpg)|

## 可复现步骤与证据边界

1. 启动固定两侧生产构建：base 3028，HEAD 3033；children/value 路由 `/kits/api-docs`，anyOf 路由 `/kits/api-docs/schema-composition`。不带 hash，每场完整重载；清空上次查找文字。
2. 初始场景不展开内容。第二类场景仅通过真实触发器打开、关闭，确认 hidden="until-found"、expanded=false、无 inert 后再查找。
3. 使用 Chrome 原生 Cmd+F，输入表中完整查询，不按额外 Enter。三个查询在命中场景均只有一个匹配，截图高亮分别位于 `body_gitSource_repoId`、`tx_txnOrderMsg_returnUrl`、`contact_phone_number` 内；未把外部说明文字当成目标。
4. 查找栏截图后 Escape 关闭。键盘检查使用已存在目标字段的 Copy link 按钮作为起点，再按 Tab，实际到达下一内部按钮；这是显式设定起点的键盘可用性检查，不声称 Escape 自动聚焦目标。base children 另尝试原生 Escape→Tab 时 activeElement 仍为 BODY，此原始读数保留，不将其误报为折叠焦点回归。
5. 仅安装被动 beforematch capture listener 记录事件id/isTrusted/time；只读DOM观察。没有 window.find、hash跳转、goTo/reveal、人工beforematch、hidden/inert删除或动画覆盖。最后重新加载清除了观察器。

原始读数注意：anyOf 的通用 keyboardProbe.expanded 使用 body 内首个 aria-expanded 按钮，因此该值不代表 Phone channel，应忽略；目标祖先状态、截图、顶层专门读回的 expanded，以及 HEAD 的 phoneExpanded 才是 Phone 分区证据。base children initial 为本轮工具读数的简要转录，其余为原始对象。

基线使用既有 hierarchy 生产构建，多一个未访问的 /__hierarchy 测试路由；实际验证普通 gallery 路由。基线 tracked源码干净，重算源码digest与构建stamp完全一致；HEAD为本轮 pnpm build、CSS检查通过的普通生产构建。两侧构建差异明确保留，不声称二进制或额外路由相同。

开始前 Chrome 曾切到其它业务页，未执行有效查找，切回验证标签后才采样；此次12张截图均地址、查询和页面匹配。初始失败截图显示0/0，目标因未揭示不在截图可见范围，关闭属性由DOM读数补充。

## 停止点

本轮不改生产代码、不修改ledger或#147 findings。`f-909f4f270010`、`f-fea517d9f1ac`：原始关闭焦点缺陷已在3afdc3d独立复审覆盖范围内确认解决；结构化disposition仍open，待按批准流程同步。真实UI Find补证与其分开。申请独立复审本次证据及共有初始失败的范围裁定；不宣称所有UI Find场景通过，不合并、不发布、不关闭#152、不实施PR B。
