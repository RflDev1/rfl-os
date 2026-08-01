import { ItemStack } from "@minecraft/server";
import { GAME } from "../config/game.js";
import { distanceSquared, safe } from "../core/util.js";

const ITEM = { iron: "minecraft:iron_ingot", gold: "minecraft:gold_ingot", diamond: "minecraft:diamond", emerald: "minecraft:emerald" };

export class GeneratorSystem {
  constructor(engine) { this.engine = engine; }
  tick() {
    const match = this.engine.match;
    for (const [teamId, teamConfig] of Object.entries(match.arena.teams)) {
      this.trySpawn(`team:${teamId}:iron`, "iron", teamConfig.generator, teamId);
      this.trySpawn(`team:${teamId}:gold`, "gold", teamConfig.generator, teamId);
    }
    for (const generator of match.arena.generators) this.trySpawn(`map:${generator.id}`, generator.type, generator.location);
  }
  trySpawn(key, type, location, teamId) {
    const match = this.engine.match;
    const base = GAME.generators[type];
    const generatorLevel = teamId ? match.teams.get(teamId).upgrades.generator : 0;
    const interval = teamId ? GAME.teamGeneratorIntervals[type][generatorLevel] : base.intervalTicks;
    const elapsed = (match.generatorTicks.get(key) ?? 0) + GAME.tickInterval;
    if (elapsed < interval) return match.generatorTicks.set(key, elapsed);
    match.generatorTicks.set(key, elapsed - interval);
    const dimension = this.engine.dimension();
    const nearby = dimension.getEntities({ location, maxDistance: 2, type: "minecraft:item" })
      .filter(entity => entity.getComponent("minecraft:item")?.itemStack.typeId === ITEM[type]).length;
    if (nearby >= base.maxNearby) return;
    safe(() => dimension.spawnItem(new ItemStack(ITEM[type], 1), location), `${type} generator`);
  }
  nearestMapCountdown(location) {
    let nearest;
    for (const generator of this.engine.match.arena.generators) {
      if (!["diamond", "emerald"].includes(generator.type)) continue;
      const distance = distanceSquared(location, generator.location);
      if (distance > GAME.generatorHudRadius ** 2 || (nearest && distance >= nearest.distance)) continue;
      const interval = GAME.generators[generator.type].intervalTicks;
      const elapsed = this.engine.match.generatorTicks.get(`map:${generator.id}`) ?? 0;
      nearest = {
        type: generator.type,
        seconds: Math.max(0, Math.ceil((interval - elapsed) / 20)),
        distance
      };
    }
    return nearest;
  }
}
