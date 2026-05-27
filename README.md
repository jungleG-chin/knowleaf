# KnowLeaf 知叶

拍照/打字就能提取知识点，自动生成思维导图，按遗忘曲线复习 — 一个给大学生用的 AI 学习助手。

👉 **在线使用**：[GitHub Pages](https://jungleg-chin.github.io/knowleaf/mobile-web/)

## 核心功能

- **学习板块**：文字输入或拍照上传 → AI 提取知识点 → 自动生成思维导图
- **复习板块**：艾宾浩斯遗忘曲线算法（1/2/4/7/15/30/90 天间隔），卡片式问答
- **图片识别**：拍课件/笔记 → OCR 提取文字 → AI 归纳知识点
- **数据管理**：导出 ZIP（JSON + 思维导图 PDF）、导入恢复、自动备份提醒

## AI 模型兼容性

| 模型 | 图片识别 | 纯文本 | 推荐 |
|------|:---:|:---:|:---:|
| 阿里 qwen-vl-max | ✅ | ✅ | ⭐ 推荐 |
| 阿里 qwen-vl-plus | ✅ | ✅ | 轻量 |
| 阿里 qwen-max | ❌ | ✅ | - |
| DeepSeek deepseek-chat | ❌ | ✅ | - |
| GPT-4o / GPT-4o-mini | ✅ | ✅ | - |

## 快速开始

1. 获取 API Key：[阿里云百炼](https://dashscope.aliyun.com/)
2. 打开 [KnowLeaf](https://jungleg-chin.github.io/knowleaf/mobile-web/)
3. 在「我的 → API 配置」填入 Key，选择「阿里云」平台
4. 开始拍照或输入笔记

## 技术栈

纯 HTML/CSS/JS 单文件应用 · Markmap 思维导图 · IndexedDB 图片存储 · 通义千问 API · jsPDF + JSZip 导出
