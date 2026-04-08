# Resume Lab

本地运行的简历分析与模拟面试工作台，基于 `Next.js App Router + LangGraph.js + LangChain + SQLite(node:sqlite)`。
项目使用 codex 进行开发。

## 功能

- 上传 PDF 简历并提取文本
- 运行 LLM 简历分析，抽取技能并映射到项目经历
- 生成多轮模拟面试并按问答过程评分
- 输出优势、薄弱项、改写建议和引导面试官提问的方向
- 站内编辑简历并保存新版本
- 展示各版本的分数和能力演进曲线

## 启动

1. 安装依赖

```bash
pnpm install
```

2. 配置环境变量

```bash
copy .example.env .env.local
```

把 `OPENAI_API_KEY` 填进去即可启用真实模型；如果不填，应用会以 mock 模式运行完整流程。

3. 启动开发服务器

```bash
pnpm dev
```

打开 `http://localhost:3000`。

## 说明

- 数据库存储在 `data/resume-lab.sqlite`
- 上传的 PDF 原件会保存在 `data/uploads`
- 当前版本不包含登录和多用户隔离，目标是本地快速验证产品闭环

# 后续需要迭代的方向
1. 优化前端界面交互体验，提供交互式简历修改体验
2. 支持流式传输，避免长时间等待
