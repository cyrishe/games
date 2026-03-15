import {
  mapDefinitions,
  prototypeGameConfig,
  tankDefinitions,
  weaponDefinitions
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

const previewMap = mapDefinitions[0];
const previewTank = tankDefinitions[0];
const previewWeapons = weaponDefinitions;
const moveAcceleration = 0.85;
const airControl = 0.3;
const friction = 0.82;
const gravity = 0.62;
const terminalVelocity = 20;
const tankWidth = 54;
const tankHeight = 28;

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

  const [viewportSize, setViewportSize] = useState({ width: 960, height: 540 });
  const [camera, setCamera] = useState<CameraState>(() => createInitialCameraState(960, 540));
  const [player, setPlayer] = useState<TankState>(() => createInitialTankState());
  const [followPlayer, setFollowPlayer] = useState(true);
  const [statusText, setStatusText] = useState("按方向键移动，Shift 跳跃，拖动战场可查看远处平台。");

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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "Shift", "ArrowUp", "ArrowDown", "Space"].includes(event.key)) {
        event.preventDefault();
      }

      pressedKeysRef.current.add(event.key);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      pressedKeysRef.current.delete(event.key);
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

      const nextPlayer = stepTank(tankRef.current, pressedKeysRef.current, timestamp, deltaSeconds);
      tankRef.current = nextPlayer;
      setPlayer(nextPlayer);

      const nextCamera = draggingRef.current.active
        ? cameraRef.current
        : updateCamera(cameraRef.current, nextPlayer, viewportSize.width, viewportSize.height, followPlayer);

      if (nextCamera !== cameraRef.current) {
        cameraRef.current = nextCamera;
        setCamera(nextCamera);
      }

      drawBattlefield(canvasRef.current, viewportSize.width, viewportSize.height, nextCamera, nextPlayer);
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
            缩放，以及坦克的左右移动和跳跃。后续会在这套基础上继续叠加蓄力、弹道、地形破坏和回合制。
          </p>
        </div>
        <div className="hero-metrics">
          <MetricCard label="默认地图" value={previewMap.name} />
          <MetricCard label="地图尺寸" value={`${previewMap.worldWidth} x ${previewMap.worldHeight}`} />
          <MetricCard label="镜头模式" value={followPlayer ? "跟随坦克" : "自由观察"} />
          <MetricCard label="玩家位置" value={`${Math.round(playerCenterX)}, ${Math.round(player.y)}`} />
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
                  {previewMap.platforms
                    .filter((platform) => platform.id !== "bottom-floor")
                    .map((platform) => (
                      <div
                        key={platform.id}
                        className={`minimap-platform integrity-${platform.integrityLevel}`}
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
                <InfoRow label="接地状态" value={player.grounded ? "已着陆" : "空中"} />
                <InfoRow label="水平速度" value={`${player.velocityX.toFixed(1)} u/f`} />
                <InfoRow label="垂直速度" value={`${player.velocityY.toFixed(1)} u/f`} />
                <InfoRow label="缩放" value={`${camera.zoom.toFixed(2)}x`} />
              </Panel>

              <Panel title="下一步待接入">
                <InfoRow label="武器" value={previewWeapons[0].name} />
                <InfoRow label="回合" value={`${prototypeGameConfig.turn.turnDurationMs / 1000}s`} />
                <InfoRow label="风力" value={`默认 ${prototypeGameConfig.wind.defaultForce}`} />
                <InfoRow label="地形破坏" value={`网格 ${prototypeGameConfig.destruction.logicalCellSize}px`} />
              </Panel>
            </aside>
          </div>
        </section>

        <section className="card grid-two">
          <Panel title="当前可操作内容">
            <ul className="plain-list">
              <li>方向键：左右移动坦克。</li>
              <li>Shift：起跳，支持从低层跳到较高平台。</li>
              <li>鼠标拖动：解除跟随并平移镜头。</li>
              <li>滚轮：缩放主视图，小地图视窗同步更新。</li>
            </ul>
          </Panel>

          <Panel title="接下来要补的系统">
            <ul className="plain-list">
              <li>蓄力条、仰角和弹道轨迹。</li>
              <li>平台受击后的像素破坏与网格强度。</li>
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

function stepTank(current: TankState, pressedKeys: Set<string>, timestamp: number, deltaSeconds: number): TankState {
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
    pressedKeys.has("Shift") &&
    next.grounded &&
    timestamp - next.lastJumpAt >= prototypeGameConfig.turn.jumpCooldownMs
  ) {
    next.velocityY = -previewTank.jumpVelocity;
    next.grounded = false;
    next.lastJumpAt = timestamp;
  }

  next.velocityY = clamp(next.velocityY + gravity * deltaSeconds, -30, terminalVelocity);

  let nextX = clamp(next.x + next.velocityX * deltaSeconds * 4.2, 0, previewMap.worldWidth - tankWidth);
  let nextY = next.y + next.velocityY * deltaSeconds * 4.2;

  const previousBottom = next.y + tankHeight;
  const nextBottom = nextY + tankHeight;
  let grounded = false;

  for (const platform of previewMap.platforms) {
    const overlapX = nextX + tankWidth > platform.x && nextX < platform.x + platform.width;
    const fallsOntoPlatform = next.velocityY >= 0 && overlapX && previousBottom <= platform.y && nextBottom >= platform.y;

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
  player: TankState
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
  drawPlatforms(context);
  drawSpawnHints(context);
  drawTank(context, player.x, player.y, "#2d7a56", player.facing);

  const enemySpawn = previewMap.spawnPoints.find((entry) => entry.team === "right") ?? previewMap.spawnPoints[0];
  drawTank(context, enemySpawn.position.x, enemySpawn.position.y - tankHeight, "#9f4b49", -1);

  context.restore();
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

function drawPlatforms(context: CanvasRenderingContext2D) {
  for (const platform of previewMap.platforms) {
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
    context.fillStyle = gradient;
    context.beginPath();
    context.roundRect(platform.x, platform.y, platform.width, platform.height, 12);
    context.fill();

    if (platform.integrityLevel >= prototypeGameConfig.destruction.collapseThreshold) {
      context.strokeStyle = "#c9751c";
      context.lineWidth = 4;
      context.setLineDash([14, 10]);
      context.stroke();
    }

    context.restore();
  }
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
  facing: 1 | -1
) {
  context.save();
  context.translate(x, y);

  context.fillStyle = "rgba(0, 0, 0, 0.16)";
  context.beginPath();
  context.ellipse(tankWidth / 2, tankHeight + 8, tankWidth / 2.1, 7, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = bodyColor;
  context.beginPath();
  context.roundRect(0, 10, tankWidth, 18, 8);
  context.fill();

  context.fillStyle = "#2a4360";
  context.beginPath();
  context.roundRect(12, 0, 30, 14, 7);
  context.fill();

  context.strokeStyle = "#213449";
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(28, 8);
  context.lineTo(28 + facing * 24, 2);
  context.stroke();

  context.fillStyle = "#213449";
  context.beginPath();
  context.arc(15, 28, 7, 0, Math.PI * 2);
  context.arc(39, 28, 7, 0, Math.PI * 2);
  context.fill();

  context.restore();
}
