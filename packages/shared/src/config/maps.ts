import type { MapDefinition } from "../types.js";

export const mapDefinitions: MapDefinition[] = [
  {
    id: "split-ridge",
    name: "Split Ridge",
    worldWidth: 3200,
    worldHeight: 1800,
    background: {
      skyTop: "#d8edff",
      skyBottom: "#f6f4d1",
      dust: "#dac89f"
    },
    camera: {
      viewportWidth: 1440,
      viewportHeight: 900,
      minZoom: 0.55,
      maxZoom: 1.3,
      allowFreePan: true
    },
    finalFloorY: 1580,
    platforms: [
      { id: "left-floor-a", x: 180, y: 1420, width: 340, height: 54, integrityLevel: 0, tags: ["left", "floor"] },
      { id: "left-floor-b", x: 620, y: 1360, width: 220, height: 46, integrityLevel: 0, tags: ["left", "floor"] },
      { id: "left-mid-a", x: 350, y: 1160, width: 280, height: 44, integrityLevel: 1, tags: ["left", "mid"] },
      { id: "left-mid-b", x: 690, y: 1060, width: 180, height: 40, integrityLevel: 1, tags: ["left", "mid"] },
      { id: "left-high-a", x: 260, y: 900, width: 180, height: 36, integrityLevel: 2, tags: ["left", "high"] },
      { id: "left-high-b", x: 540, y: 790, width: 200, height: 36, integrityLevel: 2, tags: ["left", "high"] },
      { id: "right-floor-a", x: 2680, y: 1420, width: 340, height: 54, integrityLevel: 0, tags: ["right", "floor"] },
      { id: "right-floor-b", x: 2360, y: 1360, width: 220, height: 46, integrityLevel: 0, tags: ["right", "floor"] },
      { id: "right-mid-a", x: 2550, y: 1160, width: 280, height: 44, integrityLevel: 1, tags: ["right", "mid"] },
      { id: "right-mid-b", x: 2330, y: 1000, width: 180, height: 40, integrityLevel: 1, tags: ["right", "mid"] },
      { id: "right-high-a", x: 2760, y: 900, width: 180, height: 36, integrityLevel: 2, tags: ["right", "high"] },
      { id: "right-high-b", x: 2470, y: 760, width: 200, height: 36, integrityLevel: 2, tags: ["right", "high"] },
      { id: "bottom-floor", x: 120, y: 1580, width: 2960, height: 58, integrityLevel: 0, tags: ["base"] }
    ],
    spawnPoints: [
      { id: "spawn-left", team: "left", position: { x: 440, y: 1128 } },
      { id: "spawn-right", team: "right", position: { x: 2690, y: 1128 } }
    ]
  }
];
