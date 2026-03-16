import type { PrototypeGameConfig } from "../types.js";

export const prototypeGameConfig: PrototypeGameConfig = {
  turn: {
    turnDurationMs: 10_000,
    moveBudgetUnits: 180,
    shotLimit: 1,
    jumpCooldownMs: 1_250
  },
  wind: {
    minForce: -5,
    maxForce: 5,
    defaultForce: 2
  },
  destruction: {
    logicalCellSize: 16,
    collapseThreshold: 4,
    criticalThreshold: 5,
    groundedDamagePerTier: 12
  },
  defaultMapId: "split-ridge",
  defaultTankId: "trailblazer"
};
