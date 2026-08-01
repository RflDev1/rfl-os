export const GAME = Object.freeze({
  minimumPlayers: 2,
  maximumPlayers: 2,
  countdownSeconds: 20,
  respawnSeconds: 5,
  spawnProtectionSeconds: 3,
  matchSeconds: 20 * 60,
  endingSeconds: 8,
  voidY: -60,
  lobbyItems: true,
  rewards: { winCrowns: 25, lossCrowns: 5, killXp: 10, finalKillXp: 25, bedXp: 50, winXp: 100 },
  generators: {
    iron: { intervalTicks: 16, maxNearby: 48 },
    gold: { intervalTicks: 80, maxNearby: 16 },
    diamond: { intervalTicks: 300, maxNearby: 8 },
    emerald: { intervalTicks: 600, maxNearby: 4 }
  },
  teamGeneratorIntervals: {
    iron: [16, 13, 10],
    gold: [80, 66, 56]
  },
  fireGroundSeconds: 6,
  playerBurnSeconds: 3,
  generatorHudRadius: 10,
  shopRadius: 4,
  stationInteractionRadius: 2,
  tickInterval: 5
});

export const TEAMS = Object.freeze({
  red: { id: "red", name: "Red", color: "§c", wool: "minecraft:red_wool", concrete: "minecraft:red_concrete" },
  blue: { id: "blue", name: "Blue", color: "§9", wool: "minecraft:blue_wool", concrete: "minecraft:blue_concrete" }
});
