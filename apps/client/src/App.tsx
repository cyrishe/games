import {
  mapDefinitions,
  prototypeGameConfig,
  tankDefinitions,
  weaponDefinitions
} from "@tank-battle/shared";
import type { CSSProperties, PropsWithChildren } from "react";

const previewMap = mapDefinitions[0];
const previewTank = tankDefinitions[0];
const previewWeapons = weaponDefinitions;

const integrityLabels = ["完好", "轻伤", "中伤", "重伤", "脆弱", "空洞"];
const groupedPlatforms = previewMap.platforms.reduce<Record<string, number>>((acc, platform) => {
  for (const tag of platform.tags ?? []) {
    acc[tag] = (acc[tag] ?? 0) + 1;
  }

  return acc;
}, {});

function formatDistance(units: number) {
  return `${Math.round(units)} u`;
}

export function App() {
  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Tank Battle Prototype</p>
          <h1>大地图回合制坦克对战原型</h1>
          <p className="hero-copy">
            当前骨架优先服务于地图、数值、玩法和联机的后续扩展。地图、坦克、
            武器和回合规则都已经配置化，可单独调整而不改核心结构。
          </p>
        </div>
        <div className="hero-metrics">
          <MetricCard label="默认地图" value={previewMap.name} />
          <MetricCard label="地图尺寸" value={`${previewMap.worldWidth} x ${previewMap.worldHeight}`} />
          <MetricCard label="回合时长" value={`${prototypeGameConfig.turn.turnDurationMs / 1000}s`} />
          <MetricCard label="移动预算" value={formatDistance(prototypeGameConfig.turn.moveBudgetUnits)} />
        </div>
      </header>

      <main className="layout">
        <section className="battlefield card">
          <div className="card-header">
            <div>
              <h2>战场布局预览</h2>
              <p>示意当前默认地图的视图结构，后续将替换为 Canvas 实时渲染。</p>
            </div>
            <div className="camera-pill">可拖动镜头 + 小地图联动</div>
          </div>

          <div className="world-frame">
            <div
              className="world"
              style={
                {
                  "--sky-top": previewMap.background.skyTop,
                  "--sky-bottom": previewMap.background.skyBottom,
                  "--world-width": `${previewMap.worldWidth / 3.2}px`,
                  "--world-height": `${previewMap.worldHeight / 3.2}px`
                } as CSSProperties
              }
            >
              {previewMap.platforms.map((platform) => (
                <div
                  key={platform.id}
                  className={`platform integrity-${platform.integrityLevel}`}
                  style={{
                    left: `${platform.x / 3.2}px`,
                    top: `${platform.y / 3.2}px`,
                    width: `${platform.width / 3.2}px`,
                    height: `${Math.max(platform.height / 3.2, 8)}px`
                  }}
                  title={`${platform.id} / ${integrityLabels[platform.integrityLevel]}`}
                />
              ))}

              {previewMap.spawnPoints.map((spawn) => (
                <div
                  key={spawn.id}
                  className={`tank-marker ${spawn.team}`}
                  style={{
                    left: `${spawn.position.x / 3.2}px`,
                    top: `${spawn.position.y / 3.2 - 22}px`
                  }}
                >
                  <span>{spawn.team === "left" ? "A" : "B"}</span>
                </div>
              ))}

              <div className="viewport-window" />
              <div className="trajectory-hint" />
            </div>

            <aside className="hud-panel">
              <Panel title="小地图">
                <div className="minimap">
                  <div className="minimap-floor" />
                  {previewMap.platforms
                    .filter((platform) => platform.id !== "bottom-floor")
                    .map((platform) => (
                      <div
                        key={platform.id}
                        className="minimap-platform"
                        style={{
                          left: `${(platform.x / previewMap.worldWidth) * 100}%`,
                          top: `${(platform.y / previewMap.worldHeight) * 100}%`,
                          width: `${(platform.width / previewMap.worldWidth) * 100}%`
                        }}
                      />
                    ))}
                  {previewMap.spawnPoints.map((spawn) => (
                    <div
                      key={spawn.id}
                      className={`minimap-marker ${spawn.team}`}
                      style={{
                        left: `${(spawn.position.x / previewMap.worldWidth) * 100}%`,
                        top: `${(spawn.position.y / previewMap.worldHeight) * 100}%`
                      }}
                    />
                  ))}
                  <div className="minimap-camera" />
                </div>
              </Panel>

              <Panel title="回合与风力">
                <InfoRow label="当前回合" value="玩家 A" />
                <InfoRow label="倒计时" value="08s" />
                <InfoRow label="风向 / 风力" value="→ / 2" />
                <InfoRow label="移动预算" value={formatDistance(prototypeGameConfig.turn.moveBudgetUnits)} />
              </Panel>

              <Panel title="瞄准与武器">
                <InfoRow label="当前坦克" value={previewTank.name} />
                <InfoRow label="仰角范围" value={`${previewTank.turretAngleMin}° - ${previewTank.turretAngleMax}°`} />
                <InfoRow label="主武器" value={previewWeapons[0].name} />
                <div className="charge-track">
                  <div className="charge-fill" />
                  <div className="charge-cursor" />
                </div>
              </Panel>
            </aside>
          </div>
        </section>

        <section className="card grid-two">
          <Panel title="配置化入口">
            <ul className="plain-list">
              <li>地图定义：平台位置、出生点、镜头限制、背景色。</li>
              <li>坦克定义：生命、移动、跳跃、仰角和重量级别。</li>
              <li>武器定义：射程、伤害、爆炸半径、风影响系数。</li>
              <li>回合规则：倒计时、移动预算、跳跃冷却、发射次数。</li>
            </ul>
          </Panel>

          <Panel title="默认地图摘要">
            <InfoRow label="平台总数" value={`${previewMap.platforms.length}`} />
            <InfoRow label="左侧资源" value={`${groupedPlatforms.left ?? 0} 个平台`} />
            <InfoRow label="右侧资源" value={`${groupedPlatforms.right ?? 0} 个平台`} />
            <InfoRow label="底层承接" value={`Y=${previewMap.finalFloorY}`} />
          </Panel>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2>下一步开发路线</h2>
              <p>先把单机原型打通，再接房间和 WebSocket 联机。</p>
            </div>
          </div>

          <div className="roadmap">
            <RoadmapStep
              title="阶段 1：Canvas 战场"
              description="将当前静态布局替换成可滚动、可缩放、可拖动的 Canvas 视图。"
            />
            <RoadmapStep
              title="阶段 2：战斗原型"
              description="加入坦克移动、跳跃、蓄力、角度控制和炮弹轨迹。"
            />
            <RoadmapStep
              title="阶段 3：道路破坏"
              description="落地像素表现与 5 级网格强度联动，支持脆弱平台坍塌。"
            />
            <RoadmapStep
              title="阶段 4：联机回合"
              description="引入房间、回合同步、服务端权威状态和胜负结算。"
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function Panel(props: PropsWithChildren<{ title: string }>) {
  return (
    <section className="panel">
      <h3>{props.title}</h3>
      {props.children}
    </section>
  );
}

function MetricCard(props: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function InfoRow(props: { label: string; value: string }) {
  return (
    <div className="info-row">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function RoadmapStep(props: { title: string; description: string }) {
  return (
    <article className="roadmap-step">
      <h3>{props.title}</h3>
      <p>{props.description}</p>
    </article>
  );
}
