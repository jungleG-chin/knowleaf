# 项目说明

KnowLeaf 知叶 - AI 学习笔记工具

## 技术栈

- 纯前端 HTML+CSS+JS，单文件
- AI API（多平台：DeepSeek / 硅基流动 / 阿里百炼 / Groq / 自定义）
- Markmap (markmap-autoloader CDN) 渲染思维导图
- 数据存 localStorage

## 项目结构

```
knowleaf/
├── desktop/
│   └── index.html          ← 桌面版（三栏布局）
├── mobile-web/
│   └── index.html          ← 手机浏览器版（单栏，带多模型切换）
├── miniprogram/            ← 微信小程序版（待开发）
└── CLAUDE.md
```

## localStorage 键名

| Key | 用途 | 默认值 |
|---|---|---|
| `knowleaf_deepseek_apikey` | API Key | - |
| `knowleaf_api_url` | API 端点 | `https://api.deepseek.com/chat/completions` |
| `knowleaf_model` | 模型名称 | `deepseek-chat` |
| `knowleaf_data` | 知识库数据 | `{}` |

## 数据结构

```json
{
  "学科名": {
    "知识点名": [
      {
        "text": "原始输入内容",
        "summary": "一句话总结",
        "time": "2026/5/25 12:00:00"
      }
    ]
  }
}
```

## 常用指令

- 改功能直接改代码，不用问，不用确认
- 每次改动完成后告诉我文件变化
- 优先编辑现有文件，不新建不必要的文件

## 各版本功能对照

| 功能 | desktop | mobile-web |
|---|---|---|
| DeepSeek API 调用 | ✓ | ✓ |
| 多模型切换 | - | ✓ |
| localStorage 存储 | ✓ | ✓ |
| Markmap 思维导图 | ✓ | ✓（可折叠） |
| 知识库折叠树 | ✓ | ✓ |
| 搜索过滤 | ✓ | ✓ |
| 导入/导出 JSON | ✓ | ✓ |
| 设置面板 | ✓ | ✓（含模型配置） |
| 单条删除 | ✓ | ✓ |
| 清空全部 | ✓ | ✓ |
| Favicon | ✓ | ✓ |
