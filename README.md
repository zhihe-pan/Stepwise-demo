# Stepwise Demo

一个完全独立的展示仓库，用 `Vite + React + Hash Router` 复刻 Stepwise 的核心前端体验。

它只保留静态前端、本地 mock 数据和假规划交互，不接登录、数据库或 AI 接口，默认部署目标是 GitHub Pages。

## 当前包含

- Landing 展示页
- 静态登录视觉页
- `Dashboard / Today / Goals / Diary / Add Goal / Settings`
- 两套本地演示情境：`default` 与 `recruiter-demo`
- 本地 mock 规划流程：填写目标 -> 生成计划 -> 保存到展示状态
- GitHub Pages 工作流：`.github/workflows/deploy.yml`

## 本地运行

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
npm run typecheck
npm run lint
```

## GitHub Pages

`vite.config.ts` 已预留：

```ts
base: process.env.BASE_PATH || "/stepwise-demo/"
```

默认适配仓库名为 `stepwise-demo` 的 Pages 子路径部署；如果仓库名不同，可以在构建前设置 `BASE_PATH`。

由于使用的是 `Hash Router`，刷新子页面不会出现 GitHub Pages 的 404 白屏问题。

## 目录说明

```text
src/
  app/           应用入口、providers、路由
  pages/         页面拼装层
  components/    纯展示组件和本地交互组件
  demo/          fixture、scenario、mock generator、本地状态
  domain/        类型与纯函数
  styles/        全局样式和 token
public/
  preview/       README 中会引用的截图目录
```

## 预览截图

后续可将截图放入：

- `public/preview/dashboard.png`
- `public/preview/today.png`
- `public/preview/goals.png`

当前目录已预留占位说明文件，方便后续直接替换。
