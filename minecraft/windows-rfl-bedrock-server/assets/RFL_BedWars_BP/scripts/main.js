import { CommandPermissionLevel, CustomCommandParamType, system } from "@minecraft/server";
import { BedWarsEngine } from "./core/engine.js";

system.beforeEvents.startup.subscribe(event => {
  event.customCommandRegistry.registerCommand({
    name: "rfl:fight",
    description: "Check in to an RFL website match",
    permissionLevel: CommandPermissionLevel.Any,
    cheatsRequired: false,
    mandatoryParameters: [
      { name: "code", type: CustomCommandParamType.String }
    ]
  }, (origin, code) => {
    const player = origin.sourceEntity;
    if (player?.typeId !== "minecraft:player") return;
    const normalized = String(code ?? "").trim().toUpperCase();
    system.run(() => {
      if (!/^[A-Z0-9]{8}$/.test(normalized)) {
        player.sendMessage("§c[RFL] Enter the eight-character code shown in your private match room.");
        return;
      }
      player.sendMessage("§e[RFL] Checking your fight code...");
      console.warn(`[RFL][FIGHT_CODE] ${JSON.stringify({
        minecraftUsername: player.name,
        code: normalized
      })}`);
    });
  });

  event.customCommandRegistry.registerCommand({
    name: "rfl:testwin",
    description: "Finish a one-player RFL test and report the win",
    permissionLevel: CommandPermissionLevel.Any,
    cheatsRequired: false
  }, origin => {
    const player = origin.sourceEntity;
    if (player?.typeId !== "minecraft:player") return;
    system.run(() => {
      const state = engine.playerState(player);
      if (!state) {
        player.sendMessage("§c[RFL] You are not enrolled in the current match.");
        return;
      }
      if (engine.match.players.size !== 1 || engine.match.phase !== "live") {
        player.sendMessage("§c[RFL] This command only works in a live one-player test.");
        return;
      }
      player.sendMessage("§a[RFL] Solo test completed. Reporting your win...");
      engine.end(state.team, "Solo test completed");
    });
  });
});

const engine = new BedWarsEngine();
system.run(() => engine.initialize());
