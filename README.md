# 小龙虾一键安装器

基于 Vite + Electron 构建的 OpenClaw 图形化安装客户端，参考 [openclaw/openclaw](https://github.com/openclaw/openclaw) 官方仓库流程，目标人群是不懂代码和命令行的普通用户，当前重点支持 Windows 和 macOS。

产品级 PRD 见：[docs/需求文档.md](/Users/gengyu/code/crayfish-installer/docs/需求文档.md)

## 功能特性

- ✅ **自动环境检测** - 自动检测系统平台、架构、内存、CPU 等信息
- ✅ **双平台交付** - 当前聚焦 Windows、macOS
- ✅ **已有安装检测** - 自动检测并显示已安装的 OpenClaw 版本
- ✅ **环境检查** - 自动检查 Node.js、npm、pnpm、openclaw 当前状态
- ✅ **pnpm 优先安装** - 优先使用 `pnpm add -g openclaw@latest`
- ✅ **镜像配置** - 中文环境自动配置 npm / pnpm 国内镜像
- ✅ **onboard 初始化** - 安装后自动执行 `openclaw onboard --install-daemon`
- ✅ **一键卸载** - 支持通过 pnpm 卸载全局 openclaw

## 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite 5
- **桌面框架**: Electron 28
- **包管理器**: pnpm
- **样式**: 原生 CSS

## 安装

```bash
# 安装依赖
pnpm install

# 启动前端开发环境
pnpm dev

# 启动 Electron 开发环境
pnpm electron:dev

# 构建当前系统安装包
pnpm build

# 构建 Windows x64 安装程序
pnpm build:win

# 构建 Windows ARM 安装程序
pnpm build:win:arm64
```

## 项目结构

```
crayfish-installer/
├── electron/           # Electron 主进程代码
│   ├── main.ts        # 主进程入口
│   └── preload.ts     # 预加载脚本
├── src/               # 渲染进程代码 (React)
│   ├── components/    # React 组件
│   │   ├── Installer.tsx
│   │   └── ProgressBar.tsx
│   ├── styles/        # CSS 样式
│   │   └── index.css
│   ├── types/         # TypeScript 类型定义
│   │   └── index.ts
│   ├── App.tsx        # 主应用组件
│   └── main.tsx       # 渲染进程入口
├── index.html         # HTML 入口
├── package.json       # 项目配置
├── vite.config.ts     # Vite 配置
└── tsconfig.json      # TypeScript 配置
```

## 产品定位

- 面向不会代码和命令行的用户
- 默认只暴露必要信息，不让用户处理压缩包、终端和脚本
- 当前交付重点为 Windows 与 macOS
- Linux 逻辑仍在代码中保留，但不是主目标平台

## 安装步骤规划

1. 检查当前系统是否已安装 Node.js 22 或更高版本
2. 检查 npm 是否可用
3. 检查 pnpm 是否可用；如果不可用，则使用 npm 全局安装 pnpm
4. 在中文环境下配置 npm / pnpm registry 为 `https://registry.npmmirror.com`
5. 使用 `pnpm add -g openclaw@latest` 安装 OpenClaw CLI
6. 执行 `openclaw onboard --install-daemon`
7. 校验 `openclaw` 命令是否可用，完成安装

## 卸载步骤规划

1. 检查 pnpm 和 openclaw 是否存在
2. 执行 `pnpm remove -g openclaw`
3. 根据 openclaw 提示完成 daemon 停用或残留清理
4. 保留默认数据目录配置，方便重新安装

## 默认数据目录

根据用户环境自动给出 OpenClaw 数据目录建议：

- **Windows**: `C:\Users\<用户名>\.openclaw`
- **macOS**: `~/.openclaw`

## 环境检测功能

安装器会自动检测以下环境信息：

1. **系统平台**: Windows / macOS
2. **系统架构**: x64 / arm64
3. **操作系统版本**: 显示当前 OS 版本
4. **内存信息**: 总内存和可用内存
5. **CPU 核心数**: 处理器核心数量
6. **已有安装**: 检测现有 openclaw 全局命令
7. **镜像配置**: 检查 npm / pnpm registry 是否已指向国内镜像

## 开发

```bash
# 前端热重载
pnpm dev

# Electron 主进程 + 前端联调
pnpm electron:dev

# 构建安装包
pnpm build

# 预览生产构建
pnpm preview
```

## 交付建议

- macOS 和 Windows 的安装包建议分别在对应系统或 CI 环境中构建
- Windows 默认应优先发布 `x64` 安装程序，`arm64` 仅用于 ARM Windows 设备
- Windows 产物为 NSIS 安装程序，支持安装目录选择、桌面快捷方式、开始菜单和卸载入口
- 正式发布前建议补充 Node.js 缺失时的下载引导页和平台化安装器
- 继续完善 daemon 卸载与状态检测，避免只卸掉 CLI 但 daemon 仍残留
- 如果后续要覆盖非技术用户，优先补充安装失败时的可恢复提示，而不是继续增加技术细节

## 关于 OpenClaw

OpenClaw 是经典游戏 Captain Claw 的开源重制版本。原游戏是 Monolith Productions 于 1997 年发布的平台冒险游戏。

- 项目地址: https://github.com/openclaw/openclaw
- 游戏类型: 平台跳跃 / 冒险
- 开源协议: GPL-2.0

## 许可证

MIT License
