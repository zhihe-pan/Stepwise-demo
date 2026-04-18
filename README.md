# Stepwise Demo

一个完全独立的展示仓库，用 `Vite + React + Hash Router` 复刻 Stepwise 的核心前端体验；静态前端、本地 mock 与离线桩 API，默认部署到 GitHub Pages。

- **仓库**：[zhihe-pan/Stepwise-demo](https://github.com/zhihe-pan/Stepwise-demo)
- **线上预览**（推送 `main` 且 Pages 启用后）：[https://zhihe-pan.github.io/stepwise-demo/](https://zhihe-pan.github.io/stepwise-demo/)  
  首次请在仓库 **Settings → Pages** 将 **Build and deployment → Source** 设为 **GitHub Actions**。

> **编辑器报错「无法读取 …/stepwise-showcase/tsconfig」**：说明当前仍打开了**旧目录名**。请 **文件 → 打开文件夹**，改为打开本机上的 **`stepwise-demo`** 仓库根目录（重命名前的 `stepwise-showcase` 已不存在）。

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

与 GitHub Pages 实际访问路径 `/stepwise-demo/` 对齐。若将来仓库或 Pages 路径再改名，请同步修改 `vite.config.ts` 默认值，或在 CI / 本地构建前设置环境变量 `BASE_PATH`（见 `.github/workflows/deploy.yml`）。

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
