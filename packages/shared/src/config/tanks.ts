import type { TankDefinition } from "../types.js";

export const tankDefinitions: TankDefinition[] = [
  {
    id: "trailblazer",
    name: "Trailblazer",
    maxHealth: 100,
    moveSpeed: 2.8,
    jumpVelocity: 8.2,
    turretAngleMin: 10,
    turretAngleMax: 90,
    baseWeaponId: "standard-shell",
    weightClass: "medium"
  }
];
