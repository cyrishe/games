import type { WeaponDefinition } from "../types";

export const weaponDefinitions: WeaponDefinition[] = [
  {
    id: "standard-shell",
    name: "普通炮",
    kind: "shell",
    maxCharge: 100,
    maxRange: 720,
    baseDamage: 34,
    blastRadius: 44,
    windFactor: 1
  },
  {
    id: "scatter-burst",
    name: "散弹炮",
    kind: "scatter",
    maxCharge: 100,
    maxRange: 650,
    baseDamage: 14,
    blastRadius: 24,
    windFactor: 1.15,
    pellets: 5,
    pelletDamageFactor: 0.2
  }
];
