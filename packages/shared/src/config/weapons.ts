import type { WeaponDefinition } from "../types.js";

export const weaponDefinitions: WeaponDefinition[] = [
  {
    id: "standard-shell",
    name: "普通炮",
    kind: "shell",
    maxCharge: 100,
    rangeRatio: 0.96,
    baseDamage: 34,
    blastRadius: 34,
    windFactor: 1,
    speedFactor: 0.7
  },
  {
    id: "scatter-burst",
    name: "散弹炮",
    kind: "scatter",
    maxCharge: 100,
    rangeRatio: 0.75,
    baseDamage: 42,
    blastRadius: 26,
    windFactor: 0.7,
    speedFactor: 0.62,
    pellets: 5,
    pelletDamageFactor: 0.2
  }
];
