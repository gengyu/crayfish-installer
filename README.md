# 小龙虾安装器

面向 OpenClaw 的桌面安装器与配置工作台，帮助不熟悉命令行的用户在 Windows 和 macOS 上完成安装、配置、插件接入与智能体工作区管理。

它不是 OpenClaw 本体，而是一个围绕 OpenClaw CLI、配置文件和常见接入流程构建的图形化桌面应用。

## 当前能力

- 一键检测本机环境与已有 OpenClaw 安装状态
- 优先使用 `pnpm` 安装和更新 OpenClaw
- 自动执行基础初始化流程与运行时检查
- 图形化编辑常用 OpenClaw 配置
- 提供 Quick Setup、Plugin Center、Agent Studio 三块工作区
- 支持模型接口、IM 渠道、workspace 等常见配置入口
- 支持插件预设安装，并在界面中反馈安装中、成功、失败状态
- 支持微信 ClawBot 等插件式接入场景
- 支持导入、导出、分享 agent bundle
- 支持选择性卸载 OpenClaw、配置文件、workspace 和运行时依赖

## 产品定位

- 给不想写命令、也不想手改 `openclaw.json` 的用户使用
- 给需要交付 OpenClaw 环境的团队做统一安装与配置入口
- 给中文用户提供更友好的安装、插件接入和问题反馈体验

## 技术栈

- React 18
- TypeScript
- Vite 5
- Electron 28
- pnpm

## 开发启动

```bash
pnpm install
pnpm electron:dev
```

如果只需要启动前端页面：

```bash
pnpm dev
```

## 构建

```bash
pnpm build
pnpm build:mac
pnpm build:win
pnpm build:win:arm64
```

产物默认输出到 `release/`。

## 发布到 GitHub Release

仓库已预配置 GitHub Release 发布目标：

- owner: `gengyu`
- repo: `crayfish-installer`

### 方式一：本地发布

本地发布时需要在当前 shell 提供 `GH_TOKEN`：

```bash
export GH_TOKEN=你的_github_pat
pnpm build:release
```

只发布单平台：

```bash
pnpm build:release:mac
pnpm build:release:win
```

`GitHub Desktop` 的登录状态不能替代 `GH_TOKEN`。`electron-builder` 上传 Release 资产时走的是 GitHub API token。

### 方式二：GitHub Actions 自动发布

仓库已包含工作流：

- [.github/workflows/release.yml](./.github/workflows/release.yml)

默认行为：

- 推送 tag `v*` 时自动发布
- 也支持手动触发 `workflow_dispatch`
- `macos-latest` 负责构建并上传 `.dmg`
- `windows-latest` 负责构建并上传 `.exe`

这个工作流默认使用 GitHub Actions 自带的 `secrets.GITHUB_TOKEN`，通常不需要你再额外创建 `GH_TOKEN` secret。

### 推荐发布流程

1. 更新 `package.json` 里的版本号
2. 提交并推送代码到 `main`
3. 打 tag 并推送

```bash
git tag v1.0.0
git push origin v1.0.0
```

4. 等待 GitHub Actions 自动完成 Release 产物上传

## 项目结构

```text
crayfish-installer/
├── electron/                Electron 主进程与预加载
├── src/
│   ├── components/          安装页、配置页、插件页等界面
│   ├── lib/                 OpenClaw 配置映射、模型发现、状态计算
│   ├── styles/              全局样式
│   ├── test/                测试初始化
│   └── types/               类型定义
├── build/                   打包资源与应用图标
├── public/                  Web 侧静态资源
├── docs/                    需求与设计文档
└── release/                 打包产物输出目录
```

## 使用说明

### 安装页

- 检测 Node.js、pnpm、OpenClaw 等运行条件
- 一键安装或重新安装 OpenClaw
- 查看安装详情、运行时状态和卸载入口

### Configuration Workspace

- `Quick Setup`：快速配置模型、渠道、workspace 等高频项
- `Plugin Center`：按预设接入插件，并显示安装状态与结果反馈
- `Agent Studio`：导入、导出、分享智能体 bundle

## 关于模型与插件

- `Ollama`、腾讯、阿里云、自定义模型入口已做图形化封装
- 本地 Ollama 支持自动发现模型列表
- 其他云模型以 OpenClaw 实际配置方式写入 `openclaw.json`
- 插件安装默认优先保持相互独立，避免无关插件互相阻塞

## 协议

本项目采用 [Apache License 2.0](./LICENSE)。

选择 Apache-2.0 的原因：

- 允许商业使用、修改和再分发
- 要求保留版权与许可声明
- 修改版本需要明确标注变更
- 默认不授予项目名称、Logo 等商标使用权
- 对作者与贡献者有更清晰的专利和责任边界保护

补充说明见 [NOTICE](./NOTICE)。

## 与 OpenClaw 的关系

- 本项目是 OpenClaw 的安装器和配置工作台，不是 OpenClaw 官方仓库本体
- 使用时请同时遵守 OpenClaw 及相关插件、模型服务的各自协议与使用条款

## 测试

```bash
pnpm test
npx tsc --noEmit
```
