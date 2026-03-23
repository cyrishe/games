# Cocos Creator 迁移方案

## 目标

当前仓库已经有一套基于 `TypeScript + React + Canvas + Node/WebSocket` 的可玩原型。

迁移到 `Cocos Creator` 的目标不是推倒重来，而是：

- 保留已有规则、配置和联机方向
- 将前端游戏表现层迁移到更适合做 2D 游戏的引擎
- 降低后续地图、美术、动画、粒子和镜头系统的实现成本
- 保留现有 `Node/WebSocket` 服务端作为权威状态层

## 迁移原则

### 1. 不直接替换当前原型

当前 `apps/client` 继续保留，作为：

- 可玩的旧版原型
- 规则验证基准
- 迁移时的行为对照组

新客户端放在 `apps/cocos-client`，并行推进。

### 2. 只迁移“表现层和游戏主循环”

优先保留的内容：

- `packages/shared` 中的类型定义
- 地图配置
- 坦克配置
- 武器配置
- 回合与规则配置
- 服务端房间与同步方向

优先重写的内容：

- 画面渲染
- 输入处理
- 摄像机逻辑
- UI HUD
- 物体节点管理
- 动画与特效

### 3. 先迁客户端，不先动服务端

这样风险最低：

- 不影响现有联机架构方向
- 不影响后续协议设计
- 不会让当前仓库同时重写前后端

## 推荐最终架构

```text
apps/
  client/         现有 React 原型，保留
  cocos-client/   新的 Cocos Creator 客户端
  server/         Node.js + WebSocket 权威服务端
packages/
  shared/         地图、武器、坦克、规则、协议
docs/
  *.md
```

## 哪些内容可以复用

### 可直接复用

- `packages/shared/src/types.ts`
- `packages/shared/src/config/game-rules.ts`
- `packages/shared/src/config/maps.ts`
- `packages/shared/src/config/tanks.ts`
- `packages/shared/src/config/weapons.ts`

这些内容应继续作为单一配置源。

### 可部分复用

- 炮弹命中规则
- 命中精度规则 `Perfect / Critical / Normal`
- 回合规则和移动限制
- 地形损伤思路

这些逻辑建议从当前 React 原型中“抽规则”，不要直接搬 UI 代码。

### 不建议直接复用

- `apps/client/src/App.tsx` 中的渲染和输入代码
- Canvas 上的直接绘制逻辑
- 当前前端里混合了渲染、输入和物理的单文件实现

这部分在 Cocos 中应该拆成：

- 场景脚本
- 坦克组件
- 炮弹组件
- 地形组件
- 摄像机控制组件
- HUD 组件

## 迁移分阶段

### 阶段 1：准备阶段

目标：

- 增加 `apps/cocos-client`
- 明确资源目录、脚本目录、共享配置接入方式
- 不接管当前可玩版本

输出：

- Cocos 客户端目录
- 迁移文档
- 共享配置复用策略

### 阶段 2：静态战场迁移

目标：

- 在 Cocos 中显示地图
- 渲染平台、坦克、小地图和 HUD
- 先不做完整玩法

输出：

- 基础场景
- 摄像机
- 节点层级
- UI 基本结构

### 阶段 3：操作迁移

目标：

- 坦克移动
- 跳跃
- 瞄准
- 蓄力
- 发射

输出：

- 可在 Cocos 中完成基础操作

### 阶段 4：地形与战斗迁移

目标：

- 地形破坏
- 炮弹与爆炸
- 命中精度判定
- 坦克伤害

输出：

- Cocos 版本单机战斗闭环

### 阶段 5：联机接入

目标：

- 接入 `apps/server`
- 房间、回合同步
- 服务端权威状态广播

输出：

- Cocos Web 联机版本

## Cocos 客户端建议目录

建议在 `apps/cocos-client` 中采用下面结构：

```text
apps/cocos-client/
  README.md
  assets/
    scenes/
    scripts/
      core/
      gameplay/
      ui/
      net/
    prefabs/
    textures/
  shared/
```

说明：

- `assets/scripts/core`：游戏循环、相机、输入、全局状态
- `assets/scripts/gameplay`：坦克、炮弹、地形、命中规则
- `assets/scripts/ui`：小地图、蓄力条、角度 HUD、战报
- `assets/scripts/net`：WebSocket、房间同步、协议适配

## 风险点

### 1. 共享代码不能直接无缝导入 Cocos

原因：

- Cocos 自己的构建体系和 Node 工作区并不完全一致
- 需要明确是“复制生成”还是“直接引用共享配置”

建议：

- 第一阶段先采用“导出静态配置 JSON 或 TS 纯数据文件”的方式接入
- 等 Cocos 工程稳定后，再决定是否做自动同步脚本

### 2. 当前前端逻辑耦合较高

原因：

- 目前 `App.tsx` 中混合了渲染、输入、物理、命中和地形逻辑

建议：

- 迁移时不要搬文件
- 要按职责拆成多个系统

### 3. 地形破坏实现方式可能需要在 Cocos 中重设计

原因：

- 现有网格破坏是为快速原型服务
- Cocos 中更适合转为纹理遮罩、TileMap 或自定义网格表示

建议：

- 第一版先保留当前离散网格逻辑
- 第二版再做更自然的地形系统

## 立即可执行的下一步

1. 在仓库中加入 `apps/cocos-client` 目录和迁移说明。
2. 保留 `packages/shared` 作为规则数据源。
3. 下一阶段在 Cocos 中重建静态场景和 HUD，而不是继续扩展 React 表现层。

## 结论

推荐路线是：

- `短期`：保留现有 React 原型继续作为规则验证环境
- `中期`：用 `Cocos Creator` 重建客户端表现层
- `长期`：形成 `Cocos 客户端 + Node 服务端 + shared 配置` 的正式架构
