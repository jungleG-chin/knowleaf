## 完整更新日志

### 2026-05-25 v1.1

#### 优化

- **人工印记**：全局函数/变量简写化（`escHtml`→`esc`, `highlightText`→`hl`, `renderKnowledgeTree`→`drawTree`, `matchesFilter`→`isMatch`, `callDeepSeek`→`callAI`, `showToast`→`tip` 等 30+ 项）；清理 AI 风格冗余注释；关键 Bug 修复处添加 `// fix:` 标记（IME 输入法、text/summary 重复、事件委托、图片重试）；顶部新增版权声明

#### 新增

- **用户反馈功能**：在"我的"板块新增反馈卡片入口，支持 Bug/建议/体验/其他 4 种类型提交；双重存储（localStorage + Formspree 邮件发送到 2829479480@qq.com）；可查看反馈列表（类型彩色标签、时间倒序）、一键复制全部反馈；导出 ZIP 时 JSON 附带反馈数组
- **产品定位更新**：从"AI 学习笔记工具"升级为"随身智能笔记本"，不限学术场景
- **思维导图按学科折叠**：默认只显示一级学科名，通过学科切换条选择展开某学科子树，解决知识量过大时导图崩溃问题
- **搜索升级**：模糊匹配（分词 AND 逻辑）、搜索结果关键词高亮（`<mark>` 标签）、学科筛选下拉框
- **知识关联推荐**：点击知识点展开详情时，底部展示同一学科下 3 天以上未复习的关联条目（最多 3 条），点击可跳转
- **学科颜色标签**：每个学科根据名称 hash 计算稳定颜色，在知识库学科标题显示左侧色条
- **复习与学习板块导航衔接**：复习卡片答案展开后显示"查看知识详情 →"按钮，点击跳转到学习板块并高亮对应条目

#### 优化

- 搜索栏 layout 改为 flex 排列，容纳学科筛选下拉框
- 思维导图区域增加学科切换条 UI，展开导图时自动渲染
- 知识库空状态文案根据筛选条件动态调整

#### 修复

- **复习卡片答案重复显示**：图片上传模式时 `savedText` 为空，`|| item.summary` 导致 text 和 summary 相同，复习卡片拼接两个相同字段内容重复。数据层移除 fallback，显示层改为仅在 text 和 summary 不同时才拼接
- **思维导图学科折叠不完整**：选中单一学科时，`buildMarkdown` 仍遍历全部学科输出 `##` 节点。改为过滤 subjects 数组，只输出选中学科的内容树
- **学科筛选下拉框标签不清晰**：`<option>` 文案从"全学科"改为"📂 学科筛选"，`<select>` 增加 `title` 和 `aria-label` 属性
- **搜索 AND→OR**：`matchesFilter` 从 `keywords.every`（全部匹配）改为 `keywords.some`（任意匹配），避免搜索过于严格；切换导图学科时自动清空搜索框
- **搜索防误匹配**：`haystack` 移除学科名（`subj`），防止跨学科误命中（如搜索"中断"匹配到"计算机组成原理"中的"中"）；短关键词（≤2字）改为完整词边界匹配，避免单字在长词内部误命中
- **搜索框中文输入显示拼音**：增加 `compositionstart`/`compositionend` 事件处理，中文输入法打字时不触发搜索，组合确认后才执行过滤
- **知识详情页（维基百科风格）**：点击知识条目 → 全屏详情页，面包屑导航（学科 › 知识点）、完整内容展示、原始图片异步加载、AI 分析区块、关联知识列表（按 lastReview 排序，topic 标签展示）、暂无关联知识空态、上一条/下一条导航（单条时隐藏页码）
- **详情页 onclick 防冒泡**：`event.stopPropagation()` 阻止点击详情跳转时同时触发展开/收起切换
- **移除重复 @keyframes**：清理详情页 CSS 中与 review 动画重复的 `fadeIn`/`slideUp` 定义
- **搜索重写**：移除学科筛选下拉框，改为搜索按钮 + Enter 键触发搜索；有搜索词时切换为扁平搜索结果列表（学科色标 + 知识点名 + 摘要高亮 + 📷 标记），清空搜索词恢复树状视图；删除 `populateSubjectFilter`；IME 输入过程中不再自动搜索
- **复习界面重写（维基百科风格）**：复习板块改为卡片列表（学科色标 + 标题 + 摘要摘录 + 复习状态元信息），点击卡片弹出答案弹窗（知识点名 + 完整内容），答对/答错后卡片变灰标记；统计行新增"已完成"计数；`applyReviewResult` 重构为 `(subject, topic, itemIndex, correct)` 签名，内部完成数据加载/修改/保存
- **复习计数持久化**：`getTodayReviewState`/`saveTodayReviewState` 按天 localStorage 持久化复习进度（doneIds/forgotIds）；答对 → splice 移出队列 + 持久化 doneIds，刷新不丢失；答错 → 保留卡片 + 橙色左边框 + "🔁 需重记"标记 + 持久化 forgotIds；`totalTarget` 固定当天目标数，进度条不受队列变动影响
- **修复复习计数刷新跳动**：`totalTarget` 首次计算后固化到 `state.total`，刷新不再重算；`state.done` 在每次答对时同步写入；进度条改用 `totalTarget` 而非 `queue.length`；切换板块时避免重复 `loadReviewSession`
- **复习计数改为分数制**：`totalTarget` = 每日复习量上限（不再取 min with 到期数）；待复习 = `(target - done) / target` 分子递减；已完成 = `done / target` 分子递增；答错不改变计数；队列耗尽但未达标时显示完成界面并标注"待复习条目不足"；移除"连续天数"和"已掌握"统计卡片
- **点击事件全面迁移到事件委托**：移除所有 `onclick` 内联属性（搜索卡片、树状条目、复习卡片、关联知识列表），改用 `data-*` 属性 + 事件委托模式（`knowledgeTree`/`reviewWikiList`/`detailBody` 三处委托），彻底消除特殊字符导致 onclick 断裂的静默失效问题；删除 `escJs` 函数及 `window.openDetailPage`/`window.openWikiAnswer` 全局暴露

### 2026-05-26

#### 新增

- **分析流程增加分类选择步骤**：AI 提取知识点后弹出分类选择框，展示 3 个 AI 建议分类（可点选或自定义输入），用户确认后存入知识树；保存后底部 toast 询问"继续在此分类添加"或"切换分类"；三处 AI system prompt 追加 `suggestedSubjects` 字段输出
- **智能合并功能**：知识库区域新增"🔗 智能合并"按钮，扫描当前学科下所有 topic 名称，自动发现包含相同关键词的知识点（如"TCP三次握手"和"TCP四次挥手"），弹出确认框让用户选择是否创建公共父节点并归入其下

#### 修复

- **学科栏 "null" 彻底根治**：`addKnowledge` 入口增加 subject/topic 空值拦截（拒绝写入 null/undefined/空字符串）；`renderMindmapSubjectBar`、`buildMarkdown`、`renderKnowledgeTree` 三处过滤逻辑改为 `(s+'').trim()` 后判断，更鲁棒
- **智能合并检测不到合并项**：`findMergeCandidates` 算法从固定分隔符拆词改为公共子串发现（`findCommonSubstrings`），两两遍历 topic 名找长度≥2 的公共子串，覆盖 ≥2 个 topic 即为候选父节点；增加去重逻辑（同子项集合只保留最长 parent）
- **新分类不在思维导图显示**：`suggestedSubjects` 赋值后增加 null/空值过滤，防止无效分类名称进入分类选择框导致后续流程中断
- **思维导图单选学科时学科名重复**：`buildMarkdown` 单选模式下跳过 `##` 二级标题输出
- **escHtml 空值安全**：增加 null/undefined 判断，返回空字符串
- **自定义分类不生效**：`hideCategoryPicker()` 在确认按钮之前提前 `resolve(null)` 导致 Promise 吞值；移除 hide 中的 resolve 逻辑，确认/跳过按钮各自管理 resolve；新增弹窗遮罩点击关闭（resolve null）
- **知识库列表层级与思维导图一致化**：树状渲染重构为 parent/child 层级结构——父级 topic 下递归渲染子级（左侧缩进 18px），孤儿子 topic 兜底渲染
- **toast/placeholder 显示 null**：`showCategoryToast` 增加空值保护（null/"null"/"undefined"直接 return）；分析按钮调用前二次校验 `primarySubject`
- **智能合并改为前缀匹配**：不再扫描任意位置公共子串，只匹配以相同前缀开头的同级 topic（`parentTopic` 为空的顶级 topic）；前缀长度 ≥ 2 且严格短于两个 topic 名；移除 `findCommonSubstrings`，改用逐字符前缀比较
- **学科/知识点支持重命名和删除**：一级学科新增 ✏️ ✕ 按钮（`deleteSubject` 含 IndexedDB 图片清理 + `renameSubject` 含全量迁移）；二级知识点新增 ✏️ 按钮（`renameTopic` 自动更新所有子节点 `parentTopic` 引用）
- **思维导图高度增加至 600px**：解决深层级节点（如"保号性"）显示不全问题；`fitRatio` 从 0.85 调整为 0.75，留更多边距
- **子节点空 items 增加占位符**：`buildMarkdown` 中空 items 的子节点输出 `- （待添加内容）`，避免 Markmap 对空子节点渲染异常

#### 优化

- **英文 slogan 更新**：标题和 logo-tagline 英文改为 "the leaf, know all you need"
- **反馈功能接入 Formspree 邮件**：用户提交反馈后自动发送邮件到 2829479480@qq.com（`sendFeedbackEmail` → Formspree endpoint `mpqnyobk`），提交按钮逻辑改为先存 localStorage → 再 POST Formspree → 成功/失败不同 toast；解决原有"反馈存本地但开发者看不到"的问题
- **移除反馈字数限制**：前端校验从 `text.length < 10` 改为仅判空 `if (!text)`，不再强制 10 字下限

#### 工程

- **清理 Cloudflare Workers 残留**：删除 `.wrangler/` 缓存目录，`.gitignore` 新增 `.wrangler/` 规则

### 2026-05-27

#### 修复

- **分类弹窗失效（Bug1）**：`hideCategoryPicker()` 在确认按钮之前提前 `resolve(null)` 导致 Promise 吞值；移除 hide 中的 resolve，确认/跳过按钮各自管理 resolve；新增弹窗遮罩点击关闭
- **学科/知识点重命名和删除（Bug2）**：一级学科新增 ✏️ ✕ 按钮（`deleteSubject` 含 IndexedDB 图片清理 + `renameSubject` 含全量迁移）；二级知识点新增 ✏️ 按钮（`renameTopic` 自动更新所有子节点 `parentTopic` 引用）
- **复习设置持久化（Bug3-1）**：`myDailyLimit` 输入框清除 `inputmode="numeric"` + `pattern="[0-9]*"`（与 `type="number"` 冲突导致桌面端输入被拦截）；保存按钮补 `type="button"` 防误触页面刷新；保存后验证 localStorage 写入 + 输入框绿色确认闪烁 0.8s；失焦自动保存
- **复习计数分母不同步（Bug3-2）**：`loadReviewSession()` 的 `state.total` 只在首次为 0 时设置，后续改 dailyLimit 不更新；改为每次都 `state.total = getDailyLimit()`；`updateReviewStats()` 直接读 `getDailyLimit()` 不依赖缓存；切换复习 tab 每次 reload
- **思维导图条目点击跳转（Bug4）**：学科（`[data-subject]`）和知识点（`[data-topic]`）可跳转，但底层内容条目无对应 DOM 属性导致点击无反应；新增"向上遍历 SVG DOM 找父话题 → 定位话题区 → 文本匹配条目"三级降级逻辑，支持学科/话题/条目全覆盖跳转

#### 工程

- Buddy/Claude 协作规则更新：自己能直接改的不生成提示词文件，需要 Claude Code 接力执行的才生成

### 2026-05-25 v1.0

#### 新增

- **三板块界面重构**：底部 Tab 导航（📖 学习 | 📝 复习 | 👤 我的），CSS display 切换，默认进入学习板块
- **复习板块**：艾宾浩斯遗忘曲线算法（间隔 1→2→4→7→15→30→90 天），卡片式提问 UI，答对/答错动画，每日连续正确天数统计，复习进度条
- **图片上传 + OCR 识别**：📷 选择图片 / 📸 拍照，FileReader 读取 base64，Canvas 压缩，调用 qwen-vl-max 视觉模型提取文字
- **知识点合并逻辑**：AI 返回后检查同名知识点，弹窗选择"追加到现有"或"创建新分支"
- **知识点编辑**：✏️ 按钮弹窗修改学科/知识点/总结/原始内容，自动移动记录到新位置
- **知识点 AI 深度分析**：🤖 按钮调用 AI 生成核心概念/关键要点/易错提醒/记忆技巧/关联知识/自测题，弹窗展示结果（支持复制）
- **"我的"板块**：API 配置（Key/平台/URL/模型）、数据统计（条目/学科/已掌握/打卡天数）、数据管理（导出/导入/清空）、复习设置（每日题数上限/自动归档开关）、关于信息
- **IndexedDB 双存储**：全量知识数据异步备份到 IndexedDB，localStorage 丢失时自动恢复
- **自动备份提醒**：超过 7 天未导出时"我的"板块顶部显示黄色警告条，导出后自动记录时间
- **大模型自适应匹配**：PLATFORM_PRESETS 扩展 `models`/`visionModels` 数组，模型选择从文本框改为下拉框，支持视觉能力标注（👁/📝），`isVisionModel()` 关键词检测
- **思维导图层级嵌套**：AI 提取时返回 `parentTopic`，导图渲染支持 `###` → `####` 多级嵌套，知识树子话题缩进显示
- **autoDetectHierarchy**：存量数据自动检测父子关系（子串匹配 + 剩余字符 ≥1），每次初始化执行
- **图片查看器**：知识树缩略图点击全屏放大查看，移动端 touchend 事件支持，遮罩 + ✕ 关闭
- **AI 知识粒度细化**：三处 systemPrompt 末尾追加粒度拆分指令
- **默认 API Key**：测试阶段共享 Key，用户可自行替换
- **API 连接测试**：设置面板新增"测试连接"按钮
- **导出 ZIP（JSON + 思维导图 PDF）**：引入 jsPDF + JSZip CDN，导出时生成思维导图 PDF 打包进 ZIP，SVG→Canvas→PDF 纯浏览器端完成，深克隆数据不污染原数据
- **导出思维导图 PNG 图片**：思维导图折叠栏新增 🖼 导出图片按钮，离屏渲染后 `canvas.toBlob` 直接下载 PNG

#### 修复

- **导出功能加固**：`exportData` 增加 JSZip 加载检测（`window.JSZip`/`typeof JSZip` 双路兜底），未加载时降级为纯 JSON 导出；ZIP 打包失败时 catch 降级不中断；CDN 加载顺序不影响导出
- **Canvas 污染修复（Tainted canvases）**：新增 `sanitizeSvgForCanvas` 清洗 SVG 中的 emoji 字符和外部资源引用，`svgToCanvas` 中先清洗再渲染，渲染后用 `toDataURL` 验证 Canvas 未被污染
- **图片上传 API 格式异常**：`compressImage` 增加分辨率上限 1920px + 质量循环降级（0.6→0.2），压缩阈值从 2MB 降至 512KB；API 请求增加 `max_tokens: 4096` 防止响应截断；JSON 解析失败时输出原始返回前 200 字符便于调试
- **API 返回多对象拼接 JSON 解析失败**：`callDeepSeek` 返回前加容错层，正则匹配所有 `{...}` 块拆分为数组，自动将 `{...}{...}`→`[{...},{...}]`
- **generateMindmapPDF 改为离屏渲染（v2）**：创建 `position:fixed;left:-9999px` 隐藏容器 1600×1200，Markmap 重绘 → 轮询 15 次等渲染完成 → fit → 截图 → destroy。`duration:0` 跳动画，`initialExpandLevel:-1` 全展开
- 图片存储从 localStorage base64 迁移至 IndexedDB（`image` → `imageId`），解决容量和清晰度问题
- 图片加载失败重试逻辑：延迟 300ms 重试 3 次（Android 端 IndexedDB 异步时序问题）
- `lazy-thumb-placeholder` 替代空 `<img src="">` 避免 onerror 立即误触发
- 旧数据迁移：`image` (base64) → `imageId` (IndexedDB)，`migrateLegacyImages()` 初始化时 await
- 旧格式数组自动迁移：`data[subject][topic] = [...]` → `{ items: [...], parentTopic: null }`
- `autoDetectHierarchy` 阈值从 `≥2` 改为 `≥1`，修复短差值父子关系漏检
- `IMG_DB.get` 增加 5 秒超时保护，`exportData` 增加 try/catch 容错
- 图片查看器事件委托适配动态创建的 `<img>` 元素
- 移动端 `touchend` + `click` 双事件绑定，`preventDefault` 防双击缩放

#### 优化

- 思维导图 Markmap 配置：`colorFreezeLevel: 1`、`spacingHorizontal: 80`、`paddingX: 18`、`initialExpandLevel: -1`、`fitRatio: 0.85`
- 思维导图 CSS：`markmap-circle` 投影、`markmap-node` cursor pointer、SVG 内边距
- `compressForStorage` 已删除（IndexedDB 存原图，不压缩）
- `callDeepSeek` 统一为 `(text, imageBase64, analyzeMode)` 三参数，`buildContent()` 构建 multimodal 消息
- 设置面板 CSS 重构：卡片化布局、统计网格、按钮等分、复习设置行 flex 对齐
- 头部设置按钮改为跳转"我的"板块（不再弹模态窗口）
- 阿里百炼 `qwen-vl-max` 作为默认平台和模型

### 2026-05-24

#### 新增

- **图片识别**：接入通义千问 `qwen-vl-max`，支持拍照/上传提取知识点
- **复习板块**：艾宾浩斯遗忘曲线复习算法，自动计算下次复习时间
- **知识库思维导图**：Markmap 可视化知识树

#### 基础功能

- 主体输入/分析/渲染三区域架构
- localStorage 数据持久化
- 多平台 API 预设（DeepSeek / 通义千问 / SiliconFlow / Groq）
- 底部导航栏：学习 / 导图 / 复习三大板块切换
- 数据导入/导出 JSON