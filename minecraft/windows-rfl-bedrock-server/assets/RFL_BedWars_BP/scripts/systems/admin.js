import { world } from "@minecraft/server";
import { tell } from "../core/util.js";

export class AdminSystem {
  constructor(engine) { this.engine = engine; }
  handle(event) {
    if (!event.id.startsWith("rfl:")) return;
    const player = event.sourceEntity;
    const [command, ...args] = event.id.slice(4).split(".");
    if (!player || player.typeId !== "minecraft:player") return;
    switch (command) {
      case "join": this.engine.join(player); break;
      case "leave": this.engine.leave(player); break;
      case "start": this.engine.forceStart(); break;
      case "stop": this.engine.end(undefined, "Stopped by an operator"); break;
      case "shop": this.engine.shop.open(player); break;
      case "upgrades": this.engine.shop.openUpgrades(player); break;
      case "status": tell(player, JSON.stringify(this.engine.match.snapshot())); break;
      case "setpos": this.setPosition(player, args[0] ?? event.message.trim()); break;
      case "help": this.help(player); break;
      default: tell(player, "Unknown RFL script event. Use /scriptevent rfl:help");
    }
  }
  setPosition(player, path) {
    if (!path) return tell(player, "Usage: /scriptevent rfl:setpos <lobby|spectator|red.spawn|red.bed|red.generator|red.shop|red.upgrades|blue...>");
    // Runtime overrides are intentionally world-local; copy reported coordinates
    // into arenas.js to make them part of a distributable pack.
    const location = { x: Math.floor(player.location.x) + 0.5, y: Math.floor(player.location.y), z: Math.floor(player.location.z) + 0.5 };
    const parts = path.split(".");
    if (parts.length === 1 && ["lobby", "spectator"].includes(path)) this.engine.match.arena[path] = location;
    else if (parts.length === 2 && this.engine.match.arena.teams[parts[0]]?.[parts[1]]) this.engine.match.arena.teams[parts[0]][parts[1]] = location;
    else return tell(player, `Invalid marker path: ${path}`);
    world.setDynamicProperty(`rfl:arena:${this.engine.match.arena.id}:${path}`, JSON.stringify(location));
    tell(player, `§aSet ${path} to ${JSON.stringify(location)}.`);
  }
  loadOverrides() {
    const arena = this.engine.match.arena;
    for (const path of ["lobby", "spectator", ...Object.keys(arena.teams).flatMap(t => ["spawn", "bed", "generator", "shop", "upgrades"].map(k => `${t}.${k}`))]) {
      const raw = world.getDynamicProperty(`rfl:arena:${arena.id}:${path}`);
      if (typeof raw !== "string") continue;
      try {
        const value = JSON.parse(raw);
        const parts = path.split(".");
        if (parts.length === 1) arena[path] = value; else arena.teams[parts[0]][parts[1]] = value;
      } catch (error) { console.warn(`[RFL] Invalid position override ${path}: ${error}`); }
    }
  }
  help(player) {
    tell(player, "Commands: join, leave, start, stop, shop, upgrades, status, setpos");
    tell(player, "Example: /scriptevent rfl:setpos red.spawn");
  }
}
