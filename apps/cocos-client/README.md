# Cocos Client Placeholder

这个目录用于承接后续 `Cocos Creator` 客户端迁移。

当前阶段只做迁移准备，不直接替换已有的 `apps/client`。

## 迁移目标

- 用 Cocos Creator 重建客户端表现层
- 保留现有 `packages/shared` 规则与配置
- 后续接入 `apps/server` 的 WebSocket 联机

## 计划中的目录

```text
apps/cocos-client/
  assets/
    scenes/
    scripts/
      core/
      gameplay/
      ui/
      net/
    prefabs/
    textures/
```

## 当前约束

- 暂不在这个仓库内直接生成 Cocos 工程文件
- 先明确迁移边界、共享配置复用策略和实施顺序

详细方案见：

- `docs/cocos-migration-plan.md`
