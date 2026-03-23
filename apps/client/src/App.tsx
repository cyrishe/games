import {
  mapDefinitions,
  prototypeGameConfig,
  tankDefinitions,
  weaponDefinitions,
  type PlatformDefinition
} from "@tank-battle/shared";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent
} from "react";

type CameraState = {
  x: number;
  y: number;
  zoom: number;
};

type TankState = {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  grounded: boolean;
  facing: 1 | -1;
  lastJumpAt: number;
};

type AimState = {
  angle: number;
  charging: boolean;
  chargeDirection: 1 | -1;
  chargeValue: number;
};

type ProjectileState = {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  active: boolean;
};

type ExplosionState = {
  x: number;
  y: number;
  radius: number;
  ttl: number;
};

type HitQuality = "perfect" | "critical" | "normal";

type HitFeedback = {
  label: "Perfect" | "Critical" | "Normal";
  quality: HitQuality;
  damage: number;
  ttl: number;
};

type EnemyState = {
  x: number;
  y: number;
  health: number;
  facing: 1 | -1;
};

type PlatformState = PlatformDefinition & {
  destroyed: boolean;
  cellSize: number;
  cols: number;
  rows: number;
  solidCells: boolean[];
};

const previewMap = mapDefinitions[0];
const previewTank = tankDefinitions[0];
const previewWeapons = weaponDefinitions;
const activeWeapon = previewWeapons[0];
const moveAcceleration = 0.17;
const airControl = 0.14;
const friction = 0.88;
const gravity = 0.48;
const terminalVelocity = 14;
const movementScale = 2.35;
const aimAdjustStep = 0.72;
const chargeSpeed = 0.009;
const tankWidth = 92;
const tankHeight = 52;
const projectileRadius = 10;
const projectileCollisionRadius = 1.2;
const projectileScale = 1.34;
const windAcceleration = prototypeGameConfig.wind.defaultForce * 0.045;
const enemyInitialHealth = 100;
const hitFeedbackDurationsMs = 1600;
const explosionDurationMs = 420;
const terrainCellSize = 1;

function getWeaponMaxRange() {
  return previewMap.worldWidth * activeWeapon.rangeRatio;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function createInitialTankState(): TankState {
  const spawn = previewMap.spawnPoints.find((entry) => entry.team === "left") ?? previewMap.spawnPoints[0];

  return {
    x: spawn.position.x,
    y: spawn.position.y - tankHeight,
    velocityX: 0,
    velocityY: 0,
    grounded: false,
    facing: 1,
    lastJumpAt: -prototypeGameConfig.turn.jumpCooldownMs
  };
}

function createInitialAimState(): AimState {
  return {
    angle: 42,
    charging: false,
    chargeDirection: 1,
    chargeValue: 0
  };
}

function createIdleProjectile(): ProjectileState {
  return {
    x: 0,
    y: 0,
    velocityX: 0,
    velocityY: 0,
    active: false
  };
}

function createInitialEnemyState(): EnemyState {
  const spawn = previewMap.spawnPoints.find((entry) => entry.team === "right") ?? previewMap.spawnPoints[0];

  return {
    x: spawn.position.x,
    y: spawn.position.y - tankHeight,
    health: enemyInitialHealth,
    facing: -1
  };
}

function createInitialPlatformsState(): PlatformState[] {
  return previewMap.platforms.map((platform) => ({
    ...platform,
    destroyed: false,
    cellSize: terrainCellSize,
    cols: Math.max(1, Math.ceil(platform.width / terrainCellSize)),
    rows: Math.max(1, Math.ceil(platform.height / terrainCellSize)),
    solidCells: Array.from({
      length: Math.max(1, Math.ceil(platform.width / terrainCellSize)) * Math.max(1, Math.ceil(platform.height / terrainCellSize))
    }, () => true)
  }));
}

function createInitialCameraState(viewportWidth: number, viewportHeight: number): CameraState {
  const spawn = previewMap.spawnPoints.find((entry) => entry.team === "left") ?? previewMap.spawnPoints[0];
  const zoom = 0.58;

  return clampCamera(
    {
      x: spawn.position.x - viewportWidth / (2 * zoom),
      y: spawn.position.y - viewportHeight / (2 * zoom),
      zoom
    },
    viewportWidth,
    viewportHeight
  );
}

function clampCamera(camera: CameraState, viewportWidth: number, viewportHeight: number): CameraState {
  const visibleWidth = viewportWidth / camera.zoom;
  const visibleHeight = viewportHeight / camera.zoom;

  return {
    ...camera,
    x: clamp(camera.x, 0, Math.max(0, previewMap.worldWidth - visibleWidth)),
    y: clamp(camera.y, 0, Math.max(0, previewMap.worldHeight - visibleHeight))
  };
}

export function App() {
  const battlefieldRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const pressedKeysRef = useRef(new Set<string>());
  const cameraRef = useRef<CameraState>({ x: 0, y: 0, zoom: 1 });
  const tankRef = useRef<TankState>(createInitialTankState());
  const draggingRef = useRef<{ active: boolean; originX: number; originY: number; cameraX: number; cameraY: number }>({
    active: false,
    originX: 0,
    originY: 0,
    cameraX: 0,
    cameraY: 0
  });
  const lastTimeRef = useRef<number | null>(null);
  const aimRef = useRef<AimState>(createInitialAimState());
  const projectileRef = useRef<ProjectileState>(createIdleProjectile());
  const explosionRef = useRef<ExplosionState | null>(null);
  const enemyRef = useRef<EnemyState>(createInitialEnemyState());
  const hitFeedbackRef = useRef<HitFeedback | null>(null);
  const platformsRef = useRef<PlatformState[]>(createInitialPlatformsState());
  const previousSpaceDownRef = useRef(false);

  const [viewportSize, setViewportSize] = useState({ width: 960, height: 540 });
  const [camera, setCamera] = useState<CameraState>(() => createInitialCameraState(960, 540));
  const [player, setPlayer] = useState<TankState>(() => createInitialTankState());
  const [aim, setAim] = useState<AimState>(() => createInitialAimState());
  const [projectile, setProjectile] = useState<ProjectileState>(() => createIdleProjectile());
  const [explosion, setExplosion] = useState<ExplosionState | null>(null);
  const [enemy, setEnemy] = useState<EnemyState>(() => createInitialEnemyState());
  const [hitFeedback, setHitFeedback] = useState<HitFeedback | null>(null);
  const [platforms, setPlatforms] = useState<PlatformState[]>(() => createInitialPlatformsState());
  const [followPlayer, setFollowPlayer] = useState(true);
  const [statusText, setStatusText] = useState("按方向键移动，Shift 跳跃，Space 蓄力，拖动战场可查看远处平台。");

  useLayoutEffect(() => {
    const element = battlefieldRef.current;

    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const width = Math.max(640, Math.floor(entry.contentRect.width));
      const height = Math.max(420, Math.floor(Math.min(entry.contentRect.height, width * 0.62)));

      setViewportSize({ width, height });
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const initialCamera = createInitialCameraState(viewportSize.width, viewportSize.height);
    cameraRef.current = initialCamera;
    setCamera(initialCamera);
  }, [viewportSize.height, viewportSize.width]);

  useEffect(() => {
    const blockedCodes = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "ShiftLeft", "ShiftRight", "Space"]);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (blockedCodes.has(event.code)) {
        event.preventDefault();
      }

      pressedKeysRef.current.add(event.code);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (blockedCodes.has(event.code)) {
        event.preventDefault();
      }

      pressedKeysRef.current.delete(event.code);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const loop = (timestamp: number) => {
      const previous = lastTimeRef.current ?? timestamp;
      const deltaSeconds = Math.min((timestamp - previous) / 16.67, 1.6);
      lastTimeRef.current = timestamp;

      const nextPlayer = stepTank(tankRef.current, pressedKeysRef.current, timestamp, deltaSeconds, platformsRef.current);
      const nextAim = stepAim(aimRef.current, pressedKeysRef.current, deltaSeconds, nextPlayer.facing);
      const spaceDown = pressedKeysRef.current.has("Space");
      tankRef.current = nextPlayer;
      aimRef.current = nextAim;
      setPlayer(nextPlayer);
      setAim(nextAim);

      if (
        previousSpaceDownRef.current &&
        !spaceDown &&
        !projectileRef.current.active &&
        enemyRef.current.health > 0
      ) {
        const nextProjectile = createProjectile(nextPlayer, nextAim);
        const resetAim = {
          ...nextAim,
          charging: false,
          chargeDirection: 1 as const,
          chargeValue: 0
        };
        projectileRef.current = nextProjectile;
        aimRef.current = resetAim;
        setProjectile(nextProjectile);
        setAim(resetAim);
        setStatusText(`已发射 ${activeWeapon.name}，观察落点并判断是否命中。`);
      }

      previousSpaceDownRef.current = spaceDown;

      const projectileStep = stepProjectile(projectileRef.current, deltaSeconds, enemyRef.current, platformsRef.current);

      if (projectileStep.projectile !== projectileRef.current) {
        projectileRef.current = projectileStep.projectile;
        setProjectile(projectileStep.projectile);
      }

      if (projectileStep.explosion !== undefined) {
        explosionRef.current = projectileStep.explosion;
        setExplosion(projectileStep.explosion);
      } else if (explosionRef.current) {
        const nextExplosion = stepExplosion(explosionRef.current, deltaSeconds);
        explosionRef.current = nextExplosion;
        setExplosion(nextExplosion);
      }

      if (projectileStep.hitResult) {
        enemyRef.current = projectileStep.hitResult.enemy;
        hitFeedbackRef.current = projectileStep.hitResult.feedback;
        setEnemy(projectileStep.hitResult.enemy);
        setHitFeedback(projectileStep.hitResult.feedback);
        setStatusText(
          projectileStep.hitResult.enemy.health <= 0
            ? `${projectileStep.hitResult.feedback.label} 命中，造成 ${projectileStep.hitResult.feedback.damage} 伤害，目标已被击毁。`
            : `${projectileStep.hitResult.feedback.label} 命中，造成 ${projectileStep.hitResult.feedback.damage} 伤害。`
        );
      } else if (hitFeedbackRef.current) {
        const nextFeedback = stepHitFeedback(hitFeedbackRef.current, deltaSeconds);
        hitFeedbackRef.current = nextFeedback;
        setHitFeedback(nextFeedback);
      }

      if (projectileStep.missed) {
        setStatusText("炮弹落在空地或平台上，没有击中目标。");
      }

      if (projectileStep.platforms) {
        platformsRef.current = projectileStep.platforms;
        setPlatforms(projectileStep.platforms);

        if (projectileStep.platformDamageSummary.destroyed.length > 0) {
          setStatusText(`命中地形，${projectileStep.platformDamageSummary.destroyed.length} 处平台已坍塌。`);
        } else if (projectileStep.platformDamageSummary.damaged.length > 0 && !projectileStep.hitResult) {
          setStatusText(`命中地形，${projectileStep.platformDamageSummary.damaged.length} 处平台受损。`);
        }
      }

      const nextCamera = draggingRef.current.active
        ? cameraRef.current
        : updateCamera(cameraRef.current, nextPlayer, viewportSize.width, viewportSize.height, followPlayer);

      if (nextCamera !== cameraRef.current) {
        cameraRef.current = nextCamera;
        setCamera(nextCamera);
      }

      drawBattlefield(
        canvasRef.current,
        viewportSize.width,
        viewportSize.height,
        nextCamera,
        nextPlayer,
        nextAim,
        projectileRef.current,
        explosionRef.current,
        enemyRef.current,
        platformsRef.current
      );
      animationFrameRef.current = window.requestAnimationFrame(loop);
    };

    animationFrameRef.current = window.requestAnimationFrame(loop);

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [followPlayer, viewportSize.height, viewportSize.width]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    draggingRef.current = {
      active: true,
      originX: event.clientX,
      originY: event.clientY,
      cameraX: cameraRef.current.x,
      cameraY: cameraRef.current.y
    };
    setFollowPlayer(false);
    setStatusText("自由观察中，点击“回到坦克”恢复镜头跟随。");
    canvas.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current.active) {
      return;
    }

    const dx = event.clientX - draggingRef.current.originX;
    const dy = event.clientY - draggingRef.current.originY;

    const nextCamera = clampCamera(
      {
        ...cameraRef.current,
        x: draggingRef.current.cameraX - dx / cameraRef.current.zoom,
        y: draggingRef.current.cameraY - dy / cameraRef.current.zoom
      },
      viewportSize.width,
      viewportSize.height
    );

    cameraRef.current = nextCamera;
    setCamera(nextCamera);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    draggingRef.current.active = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleWheel = (event: ReactWheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const worldX = cameraRef.current.x + pointerX / cameraRef.current.zoom;
    const worldY = cameraRef.current.y + pointerY / cameraRef.current.zoom;
    const nextZoom = clamp(
      cameraRef.current.zoom * (event.deltaY < 0 ? 1.08 : 0.92),
      previewMap.camera.minZoom,
      previewMap.camera.maxZoom
    );

    const nextCamera = clampCamera(
      {
        zoom: nextZoom,
        x: worldX - pointerX / nextZoom,
        y: worldY - pointerY / nextZoom
      },
      viewportSize.width,
      viewportSize.height
    );

    setFollowPlayer(false);
    setStatusText("缩放已切换到手动镜头。");
    cameraRef.current = nextCamera;
    setCamera(nextCamera);
  };

  const visibleWidth = viewportSize.width / camera.zoom;
  const visibleHeight = viewportSize.height / camera.zoom;
  const playerCenterX = player.x + tankWidth / 2;
  const playerCenterY = player.y + tankHeight / 2;

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Tank Battle Prototype</p>
          <h1>可操作的单机战场原型</h1>
          <p className="hero-copy">
            这一版已经进入真正的原型阶段：左侧主战场由 Canvas 绘制，支持镜头跟随、拖动、
            缩放，以及坦克的左右移动、跳跃、蓄力、瞄准和真实发射。后续会在这套基础上继续叠加地形破坏和回合制。
          </p>
        </div>
        <div className="hero-metrics">
          <MetricCard label="默认地图" value={previewMap.name} />
          <MetricCard label="地图尺寸" value={`${previewMap.worldWidth} x ${previewMap.worldHeight}`} />
          <MetricCard label="镜头模式" value={followPlayer ? "跟随坦克" : "自由观察"} />
          <MetricCard label="瞄准" value={`${aim.angle.toFixed(0)}° / ${Math.round(aim.chargeValue * 100)}%`} />
        </div>
      </header>

      <main className="layout">
        <section className="battlefield card">
          <div className="card-header">
            <div>
              <h2>战场原型</h2>
              <p>{statusText}</p>
            </div>
            <div className="header-actions">
              <div className="camera-pill">拖动平移 / 滚轮缩放</div>
              <button
                className="reset-button"
                type="button"
                onClick={() => {
                  const nextCamera = updateCamera(cameraRef.current, tankRef.current, viewportSize.width, viewportSize.height, true);
                  setFollowPlayer(true);
                  setStatusText("镜头已回到当前坦克。");
                  cameraRef.current = nextCamera;
                  setCamera(nextCamera);
                }}
              >
                回到坦克
              </button>
            </div>
          </div>

          <div className="world-frame interactive">
            <div ref={battlefieldRef} className="canvas-shell">
              <canvas
                ref={canvasRef}
                className="battle-canvas"
                width={viewportSize.width}
                height={viewportSize.height}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onWheel={handleWheel}
              />
            </div>

            <aside className="hud-panel">
              <Panel title="小地图">
                <div className="minimap">
                  <div className="minimap-floor" />
                  {platforms
                    .filter((platform) => platform.id !== "bottom-floor")
                    .map((platform) => (
                      <div
                        key={platform.id}
                        className={`minimap-platform integrity-${platform.integrityLevel} ${platform.destroyed ? "destroyed" : ""}`}
                        style={{
                          left: `${(platform.x / previewMap.worldWidth) * 100}%`,
                          top: `${(platform.y / previewMap.worldHeight) * 100}%`,
                          width: `${(platform.width / previewMap.worldWidth) * 100}%`
                        }}
                      />
                    ))}
                  <div
                    className="minimap-marker left"
                    style={{
                      left: `${(playerCenterX / previewMap.worldWidth) * 100}%`,
                      top: `${(playerCenterY / previewMap.worldHeight) * 100}%`
                    }}
                  />
                  <div
                    className="minimap-marker right"
                    style={{
                      left: `${(previewMap.spawnPoints[1].position.x / previewMap.worldWidth) * 100}%`,
                      top: `${(previewMap.spawnPoints[1].position.y / previewMap.worldHeight) * 100}%`
                    }}
                  />
                  <div
                    className="minimap-camera"
                    style={{
                      left: `${(camera.x / previewMap.worldWidth) * 100}%`,
                      top: `${(camera.y / previewMap.worldHeight) * 100}%`,
                      width: `${(visibleWidth / previewMap.worldWidth) * 100}%`,
                      height: `${(visibleHeight / previewMap.worldHeight) * 100}%`
                    }}
                  />
                </div>
              </Panel>

              <Panel title="实时状态">
                <InfoRow label="控制坦克" value={previewTank.name} />
                <InfoRow label="敌方生命" value={`${Math.max(0, Math.round(enemy.health))} / ${enemyInitialHealth}`} />
                <InfoRow label="接地状态" value={player.grounded ? "已着陆" : "空中"} />
                <InfoRow label="水平速度" value={`${player.velocityX.toFixed(1)} u/f`} />
                <InfoRow label="垂直速度" value={`${player.velocityY.toFixed(1)} u/f`} />
                <InfoRow label="仰角" value={`${aim.angle.toFixed(1)}°`} />
                <InfoRow label="缩放" value={`${camera.zoom.toFixed(2)}x`} />
              </Panel>

              <Panel title="瞄准与武器">
                <InfoRow label="武器" value={previewWeapons[0].name} />
                <InfoRow label="蓄力" value={`${Math.round(aim.chargeValue * 100)}%`} />
                <InfoRow label="风力" value={`默认 ${prototypeGameConfig.wind.defaultForce}`} />
                <InfoRow label="命中判定" value={hitFeedback ? hitFeedback.label : "等待命中"} />
                <InfoRow label="地形状态" value={`${platforms.filter((platform) => !platform.destroyed).length} 段可用`} />
                <InfoRow label="回合" value={`${prototypeGameConfig.turn.turnDurationMs / 1000}s`} />
                <div className="charge-track">
                  <div className="charge-fill" style={{ width: `${aim.chargeValue * 100}%` }} />
                  <div className="charge-cursor" style={{ left: `${aim.chargeValue * 100}%` }} />
                </div>
              </Panel>

              <Panel title="命中反馈">
                <InfoRow label="结果" value={hitFeedback ? hitFeedback.label : "未命中"} />
                <InfoRow label="伤害" value={hitFeedback ? `${hitFeedback.damage}` : "0"} />
                <InfoRow label="精度层级" value={hitFeedback ? hitFeedback.quality : "none"} />
              </Panel>
            </aside>
          </div>
        </section>

        <section className="card grid-two">
          <Panel title="当前可操作内容">
            <ul className="plain-list">
              <li>方向键：左右移动坦克，速度已调慢。</li>
              <li>Shift：起跳，跳跃高度已降低。</li>
              <li>Space：按住蓄力，松手后发射。</li>
              <li>Up / Down：调整炮塔仰角，并影响弹道。</li>
              <li>命中精度会显示 Perfect / Critical / Normal。</li>
              <li>炮弹命中平台会留下坑洞，并提升平台损坏等级。</li>
              <li>鼠标拖动：解除跟随并平移镜头。</li>
              <li>滚轮：缩放主视图，小地图视窗同步更新。</li>
            </ul>
          </Panel>

          <Panel title="接下来要补的系统">
            <ul className="plain-list">
              <li>更细的像素级破坏和局部承重。</li>
              <li>风力对真实弹道的更细致影响。</li>
              <li>回合制输入锁和倒计时。</li>
              <li>服务端权威同步与房间系统。</li>
            </ul>
          </Panel>
        </section>
      </main>
    </div>
  );
}

function Panel(props: { title: string; children: React.ReactNode }) {
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

function stepTank(
  current: TankState,
  pressedKeys: Set<string>,
  timestamp: number,
  deltaSeconds: number,
  platforms: PlatformState[]
): TankState {
  const next = { ...current };
  const horizontalInput = (pressedKeys.has("ArrowRight") ? 1 : 0) - (pressedKeys.has("ArrowLeft") ? 1 : 0);

  if (horizontalInput !== 0) {
    next.velocityX += horizontalInput * moveAcceleration * (next.grounded ? 1 : airControl) * deltaSeconds;
    next.facing = horizontalInput > 0 ? 1 : -1;
  } else {
    next.velocityX *= Math.pow(friction, deltaSeconds);
  }

  next.velocityX = clamp(next.velocityX, -previewTank.moveSpeed, previewTank.moveSpeed);

  if (
    (pressedKeys.has("ShiftLeft") || pressedKeys.has("ShiftRight")) &&
    next.grounded &&
    timestamp - next.lastJumpAt >= prototypeGameConfig.turn.jumpCooldownMs
  ) {
    next.velocityY = -previewTank.jumpVelocity;
    next.grounded = false;
    next.lastJumpAt = timestamp;
  }

  next.velocityY = clamp(next.velocityY + gravity * deltaSeconds, -30, terminalVelocity);

  let nextX = clamp(next.x + next.velocityX * deltaSeconds * movementScale, 0, previewMap.worldWidth - tankWidth);
  let nextY = next.y + next.velocityY * deltaSeconds * movementScale;

  const previousBottom = next.y + tankHeight;
  const nextBottom = nextY + tankHeight;
  let grounded = false;

  for (const platform of platforms) {
    if (platform.destroyed) {
      continue;
    }

    const overlapX = nextX + tankWidth > platform.x && nextX < platform.x + platform.width;
    const fallsOntoPlatform =
      next.velocityY >= 0 &&
      overlapX &&
      previousBottom <= platform.y &&
      nextBottom >= platform.y &&
      hasSolidSupport(platform, nextX + 6, nextX + tankWidth - 6);

    if (fallsOntoPlatform) {
      nextY = platform.y - tankHeight;
      next.velocityY = 0;
      grounded = true;
      break;
    }
  }

  if (!grounded) {
    const floorTop = previewMap.finalFloorY;

    if (nextBottom >= floorTop) {
      nextY = floorTop - tankHeight;
      next.velocityY = 0;
      grounded = true;
    }
  }

  next.x = nextX;
  next.y = nextY;
  next.grounded = grounded;

  return next;
}

function stepAim(current: AimState, pressedKeys: Set<string>, deltaSeconds: number, facing: 1 | -1): AimState {
  const next = { ...current };
  const aimDirection = (pressedKeys.has("ArrowUp") ? 1 : 0) - (pressedKeys.has("ArrowDown") ? 1 : 0);
  const minAngle = previewTank.turretAngleMin;
  const maxAngle = previewTank.turretAngleMax;

  if (aimDirection !== 0) {
    next.angle = clamp(next.angle + aimDirection * aimAdjustStep * deltaSeconds * 2.2, minAngle, maxAngle);
  } else {
    next.angle = clamp(next.angle, minAngle, maxAngle);
  }

  if (pressedKeys.has("Space")) {
    next.charging = true;
    next.chargeValue += next.chargeDirection * chargeSpeed * deltaSeconds * 1.8;

    if (next.chargeValue >= 1) {
      next.chargeValue = 1;
      next.chargeDirection = -1;
    } else if (next.chargeValue <= 0) {
      next.chargeValue = 0;
      next.chargeDirection = 1;
    }
  } else if (next.charging) {
    next.charging = false;
  }

  return next;
}

function createProjectile(player: TankState, aim: AimState): ProjectileState {
  const angleRadians = getTurretAngleRadians(aim.angle, player.facing);
  const speed = (getWeaponMaxRange() / 112) * activeWeapon.speedFactor * Math.max(0.12, aim.chargeValue);

  return {
    x: player.x + tankWidth / 2 + Math.cos(angleRadians) * 28,
    y: player.y + 14 - Math.sin(angleRadians) * 15,
    velocityX: Math.cos(angleRadians) * speed,
    velocityY: -Math.sin(angleRadians) * speed,
    active: true
  };
}

function stepProjectile(
  current: ProjectileState,
  deltaSeconds: number,
  enemy: EnemyState,
  platforms: PlatformState[]
): {
  projectile: ProjectileState;
  explosion?: ExplosionState | null;
  hitResult?: { enemy: EnemyState; feedback: HitFeedback };
  missed?: boolean;
  platforms?: PlatformState[];
  platformDamageSummary: { damaged: string[]; destroyed: string[] };
} {
  if (!current.active) {
    return { projectile: current, platformDamageSummary: { damaged: [], destroyed: [] } };
  }

  const nextVelocityX = current.velocityX + windAcceleration * activeWeapon.windFactor * deltaSeconds * 5;
  const nextVelocityY = clamp(current.velocityY + gravity * projectileScale * deltaSeconds, -40, 26);
  const nextX = current.x + nextVelocityX * deltaSeconds * projectileScale;
  const nextY = current.y + nextVelocityY * deltaSeconds * projectileScale;

  const nextProjectile: ProjectileState = {
    x: nextX,
    y: nextY,
    velocityX: nextVelocityX,
    velocityY: nextVelocityY,
    active: true
  };

  if (isProjectileInsideTank(nextX, nextY, enemy)) {
    return resolveImpact(nextProjectile, enemy, false, platforms);
  }

  for (const platform of platforms) {
    if (platform.destroyed) {
      continue;
    }

    const contactPoint = findSegmentPlatformContact(current.x, current.y, nextX, nextY, platform);

    if (contactPoint) {
      return resolveImpact(
        {
          ...nextProjectile,
          x: contactPoint.x,
          y: contactPoint.y
        },
        enemy,
        true,
        platforms
      );
    }
  }

  const floorContact = findSegmentHorizontalContact(current.x, current.y, nextX, nextY, previewMap.finalFloorY);

  if (floorContact) {
    return resolveImpact(
      {
        ...nextProjectile,
        x: floorContact.x,
        y: floorContact.y
      },
      enemy,
      true,
      platforms
    );
  }

  if (nextX < 0 || nextX > previewMap.worldWidth || nextY < 0 || nextY > previewMap.worldHeight) {
    return {
      projectile: createIdleProjectile(),
      explosion: null,
      missed: true,
      platformDamageSummary: { damaged: [], destroyed: [] }
    };
  }

  return { projectile: nextProjectile, platformDamageSummary: { damaged: [], destroyed: [] } };
}

function resolveImpact(
  projectile: ProjectileState,
  enemy: EnemyState,
  missed: boolean,
  platforms: PlatformState[]
): {
  projectile: ProjectileState;
  explosion: ExplosionState;
  hitResult?: { enemy: EnemyState; feedback: HitFeedback };
  missed?: boolean;
  platforms: PlatformState[];
  platformDamageSummary: { damaged: string[]; destroyed: string[] };
} {
  const explosion: ExplosionState = {
    x: projectile.x,
    y: projectile.y,
    radius: activeWeapon.blastRadius,
    ttl: explosionDurationMs
  };
  const hitResult = resolveHitQuality(projectile.x, projectile.y, enemy);
  const terrainResult = applyTerrainDamage(platforms, projectile.x, projectile.y, activeWeapon.blastRadius);

  return {
    projectile: createIdleProjectile(),
    explosion,
    hitResult,
    missed: hitResult ? false : missed,
    platforms: terrainResult.platforms,
    platformDamageSummary: terrainResult.summary
  };
}

function applyTerrainDamage(
  platforms: PlatformState[],
  impactX: number,
  impactY: number,
  blastRadius: number
): {
  platforms: PlatformState[];
  summary: { damaged: string[]; destroyed: string[] };
} {
  const damaged: string[] = [];
  const destroyed: string[] = [];

  const nextPlatforms = platforms.map((platform) => {
    if (platform.destroyed) {
      return platform;
    }

    const closestX = clamp(impactX, platform.x, platform.x + platform.width);
    const closestY = clamp(impactY, platform.y, platform.y + platform.height);
    const distance = Math.hypot(impactX - closestX, impactY - closestY);

    if (distance > blastRadius) {
      return platform;
    }

    const isBaseFloor = platform.id === "bottom-floor";
    const relativeX = clamp(impactX - platform.x, 10, platform.width - 10);
    const relativeY = clamp(impactY - platform.y, 4, platform.height - 4);
    const carveResult = carvePlatformCells(platform, relativeX, relativeY, blastRadius);
    const removedRatio = 1 - carveResult.remainingRatio;
    const nextIntegrity = Math.min(
      isBaseFloor ? 1 : prototypeGameConfig.destruction.criticalThreshold,
      Math.floor(removedRatio * 6)
    ) as PlatformState["integrityLevel"];
    const nextDestroyed = isBaseFloor ? false : carveResult.remainingRatio <= 0.08;

    damaged.push(platform.id);

    if (nextDestroyed) {
      destroyed.push(platform.id);
    }

    return {
      ...platform,
      integrityLevel: nextIntegrity,
      destroyed: nextDestroyed,
      solidCells: nextDestroyed ? platform.solidCells.map(() => false) : carveResult.solidCells
    };
  });

  return {
    platforms: nextPlatforms,
    summary: { damaged, destroyed }
  };
}

function carvePlatformCells(
  platform: PlatformState,
  centerX: number,
  centerY: number,
  blastRadius: number
) {
  const solidCells = [...platform.solidCells];
  const centerCol = clamp(Math.floor(centerX / platform.cellSize), 0, platform.cols - 1);
  const estimatedRow = clamp(Math.floor(centerY / platform.cellSize), 0, platform.rows - 1);
  const centerRow = findSurfaceRow(platform, solidCells, centerCol, estimatedRow);
  const craterRadiusCells = Math.max(5, Math.floor(Math.min(blastRadius * 0.2, platform.width * 0.12) / platform.cellSize));
  const craterDepthCells = Math.max(4, Math.floor(Math.min(blastRadius * 0.24, platform.height * 0.95) / platform.cellSize));
  const protectedRows = platform.id === "bottom-floor" ? 4 : 0;

  for (let row = centerRow; row <= centerRow + craterDepthCells; row += 1) {
    for (let col = centerCol - craterRadiusCells; col <= centerCol + craterRadiusCells; col += 1) {
      if (row < 0 || row >= platform.rows || col < 0 || col >= platform.cols) {
        continue;
      }

      if (row >= platform.rows - protectedRows) {
        continue;
      }

      const index = row * platform.cols + col;
      if (!solidCells[index]) {
        continue;
      }

      const dx = (col - centerCol) / craterRadiusCells;
      const dy = (row - centerRow) / craterDepthCells;
      const hemisphere = dx * dx + dy * dy;
      const threshold = ((col * 19 + row * 23) % 13) / 12;
      const chance = clamp(1.06 - hemisphere * 0.95, 0.08, 1);

      if (hemisphere <= 1 && threshold <= chance) {
        solidCells[index] = false;
      }
    }
  }

  settleUnsupportedCells(platform, solidCells);

  const remainingCount = solidCells.filter(Boolean).length;

  return {
    solidCells,
    remainingRatio: remainingCount / solidCells.length
  };
}

function findSurfaceRow(platform: PlatformState, solidCells: boolean[], centerCol: number, estimatedRow: number) {
  for (let row = estimatedRow; row < platform.rows; row += 1) {
    const index = row * platform.cols + centerCol;
    if (solidCells[index]) {
      return row;
    }
  }

  for (let row = estimatedRow; row >= 0; row -= 1) {
    const index = row * platform.cols + centerCol;
    if (solidCells[index]) {
      return row;
    }
  }

  return estimatedRow;
}

function settleUnsupportedCells(platform: PlatformState, solidCells: boolean[]) {
  let changed = true;

  while (changed) {
    changed = false;

    for (let row = platform.rows - 2; row >= 0; row -= 1) {
      for (let col = 0; col < platform.cols; col += 1) {
        const index = row * platform.cols + col;

        if (!solidCells[index]) {
          continue;
        }

        const below = (row + 1) * platform.cols + col;
        const belowLeft = col > 0 ? (row + 1) * platform.cols + (col - 1) : -1;
        const belowRight = col < platform.cols - 1 ? (row + 1) * platform.cols + (col + 1) : -1;

        const supported =
          solidCells[below] ||
          (belowLeft >= 0 && solidCells[belowLeft]) ||
          (belowRight >= 0 && solidCells[belowRight]);

        if (!supported) {
          solidCells[index] = false;
          changed = true;
        }
      }
    }
  }
}

function findSegmentPlatformContact(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  platform: PlatformState
) {
  const steps = Math.max(8, Math.ceil(Math.hypot(endX - startX, endY - startY) / 2));
  let previousPoint = { x: startX, y: startY };

  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const x = startX + (endX - startX) * t;
    const y = startY + (endY - startY) * t;

    if (isPointInsideSolidPlatform(x, y, platform, projectileCollisionRadius)) {
      return {
        x: previousPoint.x,
        y: previousPoint.y
      };
    }

    previousPoint = { x, y };
  }

  return null;
}

function isPointInsideSolidPlatform(x: number, y: number, platform: PlatformState, radius = 0) {
  if (
    x + radius < platform.x ||
    x - radius > platform.x + platform.width ||
    y + radius < platform.y ||
    y - radius > platform.y + platform.height
  ) {
    return false;
  }

  const localX = x - platform.x;
  const localY = y - platform.y;
  const minCol = clamp(Math.floor((localX - radius) / platform.cellSize), 0, platform.cols - 1);
  const maxCol = clamp(Math.floor((localX + radius) / platform.cellSize), 0, platform.cols - 1);
  const minRow = clamp(Math.floor((localY - radius) / platform.cellSize), 0, platform.rows - 1);
  const maxRow = clamp(Math.floor((localY + radius) / platform.cellSize), 0, platform.rows - 1);

  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      if (platform.solidCells[row * platform.cols + col]) {
        return true;
      }
    }
  }

  return false;
}

function hasSolidSupport(platform: PlatformState, worldStartX: number, worldEndX: number) {
  const localStartX = clamp(worldStartX - platform.x, 0, platform.width - 1);
  const localEndX = clamp(worldEndX - platform.x, 0, platform.width - 1);
  const minCol = clamp(Math.floor(localStartX / platform.cellSize), 0, platform.cols - 1);
  const maxCol = clamp(Math.floor(localEndX / platform.cellSize), 0, platform.cols - 1);

  for (let col = minCol; col <= maxCol; col += 1) {
    if (platform.solidCells[col]) {
      return true;
    }
  }

  return false;
}

function findSegmentHorizontalContact(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  horizontalY: number
) {
  if (startY <= horizontalY && endY >= horizontalY) {
    const denominator = endY - startY;
    const t = denominator === 0 ? 0 : (horizontalY - startY) / denominator;

    return {
      x: startX + (endX - startX) * t,
      y: horizontalY
    };
  }

  return null;
}

function resolveHitQuality(
  impactX: number,
  impactY: number,
  enemy: EnemyState
): { enemy: EnemyState; feedback: HitFeedback } | undefined {
  if (enemy.health <= 0) {
    return undefined;
  }

  const enemyCenterX = enemy.x + tankWidth / 2;
  const enemyCenterY = enemy.y + tankHeight / 2;
  const distance = Math.hypot(impactX - enemyCenterX, impactY - enemyCenterY);

  if (distance > activeWeapon.blastRadius) {
    return undefined;
  }

  let quality: HitQuality;
  let label: HitFeedback["label"];
  let multiplier: number;

  if (distance <= 14) {
    quality = "perfect";
    label = "Perfect";
    multiplier = 1.85;
  } else if (distance <= 30) {
    quality = "critical";
    label = "Critical";
    multiplier = 1.35;
  } else {
    quality = "normal";
    label = "Normal";
    multiplier = Math.max(0.55, 1 - distance / activeWeapon.blastRadius);
  }

  const damage = Math.max(8, Math.round(activeWeapon.baseDamage * multiplier));

  return {
    enemy: {
      ...enemy,
      health: Math.max(0, enemy.health - damage)
    },
    feedback: {
      label,
      quality,
      damage,
      ttl: hitFeedbackDurationsMs
    }
  };
}

function stepExplosion(current: ExplosionState, deltaSeconds: number): ExplosionState | null {
  const nextTtl = current.ttl - deltaSeconds * 16.67;

  if (nextTtl <= 0) {
    return null;
  }

  return {
    ...current,
    ttl: nextTtl
  };
}

function stepHitFeedback(current: HitFeedback, deltaSeconds: number): HitFeedback | null {
  const nextTtl = current.ttl - deltaSeconds * 16.67;

  if (nextTtl <= 0) {
    return null;
  }

  return {
    ...current,
    ttl: nextTtl
  };
}

function updateCamera(
  current: CameraState,
  player: TankState,
  viewportWidth: number,
  viewportHeight: number,
  followPlayer: boolean
): CameraState {
  if (!followPlayer) {
    return current;
  }

  const visibleWidth = viewportWidth / current.zoom;
  const visibleHeight = viewportHeight / current.zoom;
  const targetX = player.x + tankWidth / 2 - visibleWidth * 0.42;
  const targetY = player.y + tankHeight / 2 - visibleHeight * 0.58;
  const nextCamera = clampCamera(
    {
      ...current,
      x: current.x + (targetX - current.x) * 0.08,
      y: current.y + (targetY - current.y) * 0.08
    },
    viewportWidth,
    viewportHeight
  );

  if (
    Math.abs(nextCamera.x - current.x) < 0.1 &&
    Math.abs(nextCamera.y - current.y) < 0.1 &&
    nextCamera.zoom === current.zoom
  ) {
    return current;
  }

  return nextCamera;
}

function drawBattlefield(
  canvas: HTMLCanvasElement | null,
  viewportWidth: number,
  viewportHeight: number,
  camera: CameraState,
  player: TankState,
  aim: AimState,
  projectile: ProjectileState,
  explosion: ExplosionState | null,
  enemy: EnemyState,
  platforms: PlatformState[]
) {
  const context = canvas?.getContext("2d");

  if (!context || !canvas) {
    return;
  }

  context.clearRect(0, 0, viewportWidth, viewportHeight);

  const gradient = context.createLinearGradient(0, 0, 0, viewportHeight);
  gradient.addColorStop(0, previewMap.background.skyTop);
  gradient.addColorStop(1, previewMap.background.skyBottom);
  context.fillStyle = gradient;
  context.fillRect(0, 0, viewportWidth, viewportHeight);

  context.save();
  context.scale(camera.zoom, camera.zoom);
  context.translate(-camera.x, -camera.y);

  drawGrid(context);
  drawPlatforms(context, platforms);
  drawSpawnHints(context);
  if (!projectile.active) {
    drawTrajectoryPreview(context, player, aim);
  }
  drawProjectile(context, projectile);
  drawExplosion(context, explosion);
  drawTank(context, player.x, player.y, "#2d7a56", player.facing, aim.angle);
  drawTank(context, enemy.x, enemy.y, enemy.health > 0 ? "#9f4b49" : "#6e7177", enemy.facing);

  context.restore();
  drawTankAimHud(context, camera, player, aim);
}

function drawTrajectoryPreview(context: CanvasRenderingContext2D, player: TankState, aim: AimState) {
  const originX = player.x + tankWidth / 2;
  const originY = player.y + 14;
  const angleRadians = getTurretAngleRadians(aim.angle, player.facing);
  const speed = (getWeaponMaxRange() / 112) * activeWeapon.speedFactor * Math.max(0.12, aim.chargeValue);
  const vx = Math.cos(angleRadians) * speed;
  const vy = -Math.sin(angleRadians) * speed;

  context.save();
  context.strokeStyle = aim.charging ? "rgba(194, 82, 32, 0.95)" : "rgba(44, 77, 97, 0.7)";
  context.lineWidth = 3;
  context.setLineDash([10, 9]);
  context.beginPath();

  for (let step = 0; step <= 45; step += 1) {
    const time = step * 0.26;
    const x = originX + vx * time;
    const y = originY + vy * time + 0.5 * gravity * projectileScale * time * time * 22;

    if (step === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }

    if (x < 0 || x > previewMap.worldWidth || y > previewMap.worldHeight) {
      break;
    }
  }

  context.stroke();
  context.restore();
}

function drawProjectile(context: CanvasRenderingContext2D, projectile: ProjectileState) {
  if (!projectile.active) {
    return;
  }

  context.save();
  context.fillStyle = "#31414a";
  context.beginPath();
  context.arc(projectile.x, projectile.y, projectileRadius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawExplosion(context: CanvasRenderingContext2D, explosion: ExplosionState | null) {
  if (!explosion) {
    return;
  }

  const progress = explosion.ttl / explosionDurationMs;

  context.save();
  context.globalAlpha = Math.max(0.18, progress);
  context.fillStyle = "rgba(226, 140, 36, 0.24)";
  context.strokeStyle = "rgba(194, 79, 28, 0.9)";
  context.lineWidth = 4;
  context.beginPath();
  context.arc(explosion.x, explosion.y, explosion.radius * (1.2 - progress * 0.35), 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
}

function isProjectileInsideTank(x: number, y: number, enemy: EnemyState) {
  if (enemy.health <= 0) {
    return false;
  }

  return x >= enemy.x && x <= enemy.x + tankWidth && y >= enemy.y && y <= enemy.y + tankHeight;
}

function drawGrid(context: CanvasRenderingContext2D) {
  context.save();
  context.strokeStyle = "rgba(52, 87, 103, 0.12)";
  context.lineWidth = 1;

  for (let x = 0; x <= previewMap.worldWidth; x += 200) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, previewMap.worldHeight);
    context.stroke();

    context.fillStyle = "rgba(36, 58, 70, 0.48)";
    context.font = "20px Trebuchet MS";
    context.fillText(`${x}`, x + 8, previewMap.finalFloorY - 18);
  }

  context.restore();
}

function drawPlatforms(context: CanvasRenderingContext2D, platforms: PlatformState[]) {
  for (const platform of platforms) {
    if (platform.destroyed) {
      continue;
    }

    context.save();

    const colors = [
      ["#8f775d", "#6e5946"],
      ["#8c735c", "#695442"],
      ["#846a56", "#604a3d"],
      ["#7a624d", "#594438"],
      ["#725843", "#4f3b30"],
      ["#d0c4b0", "#b9ad97"]
    ] as const;
    const [top, bottom] = colors[platform.integrityLevel];
    const gradient = context.createLinearGradient(0, platform.y, 0, platform.y + platform.height);
    gradient.addColorStop(0, top);
    gradient.addColorStop(1, bottom);
    for (let row = 0; row < platform.rows; row += 1) {
      for (let col = 0; col < platform.cols; col += 1) {
        if (!platform.solidCells[row * platform.cols + col]) {
          continue;
        }

        const cellX = platform.x + col * platform.cellSize;
        const cellY = platform.y + row * platform.cellSize;
        const localT = platform.rows <= 1 ? 0 : row / (platform.rows - 1);
        context.fillStyle = interpolateColor(top, bottom, localT);
        context.fillRect(
          cellX,
          cellY,
          Math.min(platform.cellSize, platform.x + platform.width - cellX),
          Math.min(platform.cellSize, platform.y + platform.height - cellY)
        );
      }
    }

    if (platform.integrityLevel >= prototypeGameConfig.destruction.collapseThreshold) {
      context.strokeStyle = "#c9751c";
      context.lineWidth = 4;
      context.setLineDash([14, 10]);
      context.stroke();
    }

    context.restore();
  }
}

function interpolateColor(start: string, end: string, t: number) {
  const from = hexToRgb(start);
  const to = hexToRgb(end);
  const r = Math.round(from.r + (to.r - from.r) * t);
  const g = Math.round(from.g + (to.g - from.g) * t);
  const b = Math.round(from.b + (to.b - from.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function drawSpawnHints(context: CanvasRenderingContext2D) {
  context.save();
  context.font = "bold 28px Trebuchet MS";
  context.fillStyle = "rgba(35, 57, 69, 0.75)";

  const leftSpawn = previewMap.spawnPoints.find((entry) => entry.team === "left") ?? previewMap.spawnPoints[0];
  const rightSpawn = previewMap.spawnPoints.find((entry) => entry.team === "right") ?? previewMap.spawnPoints[0];
  context.fillText("玩家 A", leftSpawn.position.x - 40, leftSpawn.position.y - 30);
  context.fillText("玩家 B", rightSpawn.position.x - 40, rightSpawn.position.y - 30);
  context.restore();
}

function drawTank(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  bodyColor: string,
  facing: 1 | -1,
  relativeAngle?: number
) {
  context.save();
  context.translate(x, y);

  context.fillStyle = "rgba(0, 0, 0, 0.16)";
  context.beginPath();
  context.ellipse(tankWidth / 2, tankHeight + 3, tankWidth / 2.1, 7, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#243744";
  context.beginPath();
  context.roundRect(8, 32, tankWidth - 16, 14, 8);
  context.fill();

  context.fillStyle = bodyColor;
  context.beginPath();
  context.roundRect(6, 18, tankWidth - 12, 22, 12);
  context.fill();

  context.fillStyle = "#2a4360";
  context.beginPath();
  context.roundRect(20, 10, tankWidth - 40, 18, 9);
  context.fill();

  context.fillStyle = "#f5f0df";
  context.beginPath();
  context.arc(tankWidth / 2 - 11, 18, 4, 0, Math.PI * 2);
  context.arc(tankWidth / 2 + 11, 18, 4, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#20303d";
  context.beginPath();
  context.arc(tankWidth / 2 - 11, 18, 1.8, 0, Math.PI * 2);
  context.arc(tankWidth / 2 + 11, 18, 1.8, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "#213449";
  context.lineWidth = 6;
  context.beginPath();
  context.moveTo(tankWidth / 2, 18);
  if (relativeAngle !== undefined) {
    const turretAngle = getTurretAngleRadians(relativeAngle, facing);
    context.lineTo(tankWidth / 2 + Math.cos(turretAngle) * 36, 18 - Math.sin(turretAngle) * 36);
  } else {
    context.lineTo(tankWidth / 2 + facing * 36, 12);
  }
  context.stroke();

  context.fillStyle = "#18262f";
  for (let i = 0; i < 4; i += 1) {
    context.beginPath();
    context.arc(18 + i * 13, 44, 6.8, 0, Math.PI * 2);
    context.fill();
  }

  context.strokeStyle = "rgba(255,255,255,0.22)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(tankWidth / 2 - 9, 28);
  context.lineTo(tankWidth / 2 + 9, 28);
  context.stroke();

  context.restore();
}

function getTurretAngleRadians(relativeAngle: number, facing: 1 | -1) {
  const clamped = clamp(relativeAngle, previewTank.turretAngleMin, previewTank.turretAngleMax);
  const worldAngle = facing === 1 ? clamped : 180 - clamped;
  return (worldAngle * Math.PI) / 180;
}

function drawTankAimHud(
  context: CanvasRenderingContext2D,
  camera: CameraState,
  player: TankState,
  aim: AimState
) {
  const anchorX = (player.x - camera.x) * camera.zoom - 12;
  const anchorY = (player.y - camera.y) * camera.zoom - 82;
  const panelWidth = 150;
  const panelHeight = 54;

  context.save();
  context.translate(anchorX, anchorY);
  context.fillStyle = "rgba(24, 36, 45, 0.82)";
  context.strokeStyle = "rgba(242, 233, 214, 0.65)";
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(0, 0, panelWidth, panelHeight, 12);
  context.fill();
  context.stroke();

  context.fillStyle = "#f5f0df";
  context.font = "bold 13px Trebuchet MS";
  context.fillText(`Angle ${Math.round(aim.angle)}°`, 12, 18);
  context.font = "12px Trebuchet MS";
  context.fillText(`Power ${Math.round(aim.chargeValue * 100)}%`, 12, 34);

  context.fillStyle = "rgba(255,255,255,0.16)";
  context.beginPath();
  context.roundRect(12, 40, 126, 8, 999);
  context.fill();

  context.fillStyle = aim.charging ? "#f08a24" : "#d9b65e";
  if (aim.chargeValue > 0) {
    context.beginPath();
    context.roundRect(12, 40, 126 * aim.chargeValue, 8, 999);
    context.fill();
  }

  context.strokeStyle = "#c44b35";
  context.lineWidth = 3;
  const cursorX = 12 + 126 * aim.chargeValue;
  context.beginPath();
  context.moveTo(cursorX, 38);
  context.lineTo(cursorX, 50);
  context.stroke();
  context.restore();
}
