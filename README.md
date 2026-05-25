# KnowLeaf 知叶

AI 智能笔记 + 思维导图，输入知识自动归纳生成思维导图，支持艾宾浩斯复习。

## 支持平台
- **手机端**（mobile-web/）：适配移动端浏览器，已部署 [GitHub Pages](https://jungleg-chin.github.io/knowleaf/mobile-web/)
- **桌面端**（desktop/）：计划中
- **小程序**（miniprogram/）：计划中

## 技术栈
- 前端：原生 HTML/CSS/JS（单文件），Markmap 思维导图
- AI 后端：通义千问 API（qwen-vl-max / qwen-max）
- 数据存储：localStorage（计划接入 LeanCloud 云存储 + 手机号登录）

## AI 模型兼容性

当前采用 OpenAI 兼容格式（`/v1/chat/completions`）调用各厂商 API，**视觉识别功能依赖模型自身能力**：

| 模型 | 视觉识别（图片） | 纯文本 | 说明 |
|------|:---:|:---:|------|
| **阿里云 qwen-vl-max** | ✅ | ✅ | 推荐，支持 |
| **阿里云 qwen-vl-plus** | ✅ | ✅ | 轻量版 |
| **阿里云 qwen-max** | ❌ | ✅ | 纯文本，不支持图片 |
| **DeepSeek deepseek-chat** | ❌ | ✅ | 不支持，传图会报错 `unknown variant 'image_url'` |
| **SiliconFlow Qwen/Qwen2-VL** | ✅ | ✅ | 走标准格式可选 |
| **GPT-4o / GPT-4o-mini** | ✅ | ✅ | 原生支持 |
| **Claude (Anthropic)** | ❌ | ✅ | 非 OpenAI 格式，需特殊适配 |

> 如果选了不支持图片的模型但上传了图片，会直接报错。**建议使用阿里云 qwen-vl-max 或 qwen-vl-plus**。

## 安装使用
1. 克隆项目
2. 访问 [阿里云百炼](https://dashscope.aliyun.com/) 获取 API Key
3. 在「设置」中填入 API Key，选择「阿里云」提供商
4. 打开 `mobile-web/index.html` 即可使用

## 项目约定
- Buddy 负责提供提示词和方案设计
- Claude Code 负责执行代码修改

## 待办
- [ ] LeanCloud 云存储 + 手机号登录（数据跨设备同步）
- [ ] 桌面端开发
- [ ] 小程序版本
