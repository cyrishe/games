import type { TankDefinition } from "../types";

export const tankDefinitions: TankDefinition[] = [
  {
    id: "trailblazer",
    name: "Trailblazer",
    maxHealth: 100,
    moveSpeed: 5.2,
    jumpVelocity: 12,
    turretAngleMin: 20,
    turretAngleMax: 160,
    baseWeaponId: "standard-shell",
    weightClass: "medium"
  }
];
