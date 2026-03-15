export type GridIntegrityLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type PlatformFragility = "stable" | "fragile" | "collapsed";

export type WeaponKind = "shell" | "scatter";

export interface Vector2 {
  x: number;
  y: number;
}

export interface TurnRules {
  turnDurationMs: number;
  moveBudgetUnits: number;
  shotLimit: number;
  jumpCooldownMs: number;
}

export interface WindRules {
  minForce: number;
  maxForce: number;
  defaultForce: number;
}

export interface DestructionRules {
  logicalCellSize: number;
  collapseThreshold: GridIntegrityLevel;
  criticalThreshold: GridIntegrityLevel;
  groundedDamagePerTier: number;
}

export interface TankDefinition {
  id: string;
  name: string;
  maxHealth: number;
  moveSpeed: number;
  jumpVelocity: number;
  turretAngleMin: number;
  turretAngleMax: number;
  baseWeaponId: string;
  weightClass: "light" | "medium" | "heavy";
}

export interface WeaponDefinition {
  id: string;
  name: string;
  kind: WeaponKind;
  maxCharge: number;
  maxRange: number;
  baseDamage: number;
  blastRadius: number;
  windFactor: number;
  pellets?: number;
  pelletDamageFactor?: number;
}

export interface PlatformDefinition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  integrityLevel: GridIntegrityLevel;
  tags?: string[];
}

export interface SpawnPoint {
  id: string;
  team: "left" | "right";
  position: Vector2;
}

export interface MapCamera {
  viewportWidth: number;
  viewportHeight: number;
  minZoom: number;
  maxZoom: number;
  allowFreePan: boolean;
}

export interface MapDefinition {
  id: string;
  name: string;
  worldWidth: number;
  worldHeight: number;
  background: {
    skyTop: string;
    skyBottom: string;
    dust: string;
  };
  camera: MapCamera;
  finalFloorY: number;
  platforms: PlatformDefinition[];
  spawnPoints: SpawnPoint[];
}

export interface PrototypeGameConfig {
  turn: TurnRules;
  wind: WindRules;
  destruction: DestructionRules;
  defaultMapId: string;
  defaultTankId: string;
}
