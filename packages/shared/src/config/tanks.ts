import type { TankDefinition } from "../types";

export const tankDefinitions: TankDefinition[] = [
  {
    id: "trailblazer",
    name: "Trailblazer",
    maxHealth: 100,
    moveSpeed: 2.8,
    jumpVelocity: 8.2,
    turretAngleMin: 20,
    turretAngleMax: 160,
    baseWeaponId: "standard-shell",
    weightClass: "medium"
  }
];
