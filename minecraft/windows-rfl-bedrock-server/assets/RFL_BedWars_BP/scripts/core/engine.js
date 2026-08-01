import { EnchantmentTypes, EquipmentSlot, ItemStack, system, world } from "@minecraft/server";
import { ARENAS } from "../config/arenas.js";
import { GAME, TEAMS } from "../config/game.js";
import { MatchState, Phase } from "./state.js";
import { GeneratorSystem } from "../systems/generators.js";
import { ShopSystem } from "../systems/shop.js";
import { AdminSystem } from "../systems/admin.js";
import { LocalMatchReporter } from "../integration/matchReporter.js";
import {
  broadcast, clearPlayer, distanceSquared, formatTime, giveItem, safe, sameBlock, tell
} from "./util.js";

const isBedType = typeId => typeId === "minecraft:bed" || typeId.endsWith("_bed");
const FACE_OFFSET = {
  up: { x: 0, y: 1, z: 0 }, down: { x: 0, y: -1, z: 0 },
  north: { x: 0, y: 0, z: -1 }, south: { x: 0, y: 0, z: 1 },
  east: { x: 1, y: 0, z: 0 }, west: { x: -1, y: 0, z: 0 }
};

export class BedWarsEngine {
  constructor(arena = ARENAS.find(candidate => candidate.enabled), reporter = new LocalMatchReporter()) {
    if (!arena) throw new Error("No enabled RFL arena exists");
    this.match = new MatchState(arena);
    this.reporter = reporter;
    this.generators = new GeneratorSystem(this);
    this.shop = new ShopSystem(this);
    this.admin = new AdminSystem(this);
    this.respawnTasks = new Map();
    this.lastAttacker = new Map();
    this.bedSnapshots = new Map();
    this.stationSneakLatch = new Set();
    this.activeFire = new Map();
    this.burnTasks = new Map();
  }
  initialize() {
    this.admin.loadOverrides();
    this.setupShopStations();
    safe(() => this.dimension().runCommand("gamerule dofiretick false"), "disable fire spread");
    safe(() => this.dimension().runCommand("gamerule domobspawning false"), "disable mob spawning");
    world.afterEvents.playerSpawn.subscribe(event => this.onPlayerSpawn(event.player, event.initialSpawn));
    world.afterEvents.entityDie.subscribe(event => this.onEntityDie(event));
    world.afterEvents.playerPlaceBlock.subscribe(event => this.onBlockPlaced(event));
    world.beforeEvents.playerBreakBlock.subscribe(event => this.onBlockBreak(event));
    world.beforeEvents.playerInteractWithBlock.subscribe(event => this.onBlockInteract(event));
    world.beforeEvents.explosion.subscribe(event => this.onExplosion(event));
    world.afterEvents.itemUse.subscribe(event => this.onItemUse(event));
    world.afterEvents.entityHurt.subscribe(event => this.onEntityHurt(event));
    system.afterEvents.scriptEventReceive.subscribe(event => this.admin.handle(event));
    system.runInterval(() => this.tick(), GAME.tickInterval);
    console.warn(`[RFL] BedWars initialized for arena ${this.match.arena.id}`);
  }
  dimension() { return world.getDimension(this.match.arena.dimension); }
  playerState(player) { return this.match.players.get(player.id); }
  onlinePlayer(id) { return world.getAllPlayers().find(player => player.id === id); }
  canShop(player) {
    const state = this.playerState(player);
    return this.match.phase === Phase.LIVE && state && state.alive && !state.spectator;
  }
  join(player) {
    if (![Phase.WAITING, Phase.COUNTDOWN].includes(this.match.phase)) return tell(player, "A match is already in progress.");
    if (this.match.players.has(player.id)) return;
    if (this.match.players.size >= GAME.maximumPlayers) return tell(player, "This arena is full.");
    const counts = Object.keys(this.match.arena.teams).map(id => [id, [...this.match.players.values()].filter(p => p.team === id).length]);
    counts.sort((a, b) => a[1] - b[1]);
    this.match.addPlayer(player, counts[0][0]);
    clearPlayer(player);
    safe(() => player.runCommand("gamemode adventure @s"), "set lobby mode");
    safe(() => player.teleport(this.match.arena.lobby, { dimension: this.dimension() }), "lobby teleport");
    tell(player, `Joined ${TEAMS[counts[0][0]].color}${TEAMS[counts[0][0]].name} Team§r.`);
    broadcast(`${player.name} joined (§e${this.match.players.size}/${GAME.maximumPlayers}§r).`);
  }
  leave(player) {
    const state = this.playerState(player);
    if (!state) return;
    this.match.players.delete(player.id);
    clearPlayer(player);
    safe(() => player.runCommand("gamemode adventure @s"), "leave mode");
    safe(() => player.teleport(this.match.arena.lobby, { dimension: this.dimension() }), "leave teleport");
    if (this.match.phase === Phase.LIVE) this.checkVictory();
  }
  forceStart() {
    if ([Phase.WAITING, Phase.COUNTDOWN].includes(this.match.phase) && this.match.players.size >= 1) {
      this.match.phase = Phase.STARTING;
      this.match.phaseTicks = 0;
    }
  }
  tick() {
    this.match.phaseTicks += GAME.tickInterval;
    if (system.currentTick % 20 === 0) this.setupShopStations();
    this.tickStationInteraction();
    if (this.match.phase === Phase.WAITING) this.tickWaiting();
    else if (this.match.phase === Phase.COUNTDOWN) this.tickCountdown();
    else if (this.match.phase === Phase.STARTING) this.start();
    else if (this.match.phase === Phase.LIVE) this.tickLive();
    else if (this.match.phase === Phase.VICTORY) this.beginEnding();
    else if (this.match.phase === Phase.ENDING && this.match.phaseTicks >= GAME.endingSeconds * 20) this.reset();
    this.updateHud();
  }
  tickWaiting() {
    if (this.match.players.size >= GAME.minimumPlayers) {
      this.match.phase = Phase.COUNTDOWN;
      this.match.phaseTicks = 0;
      broadcast(`Match begins in §e${GAME.countdownSeconds} seconds§r.`);
    }
  }
  tickCountdown() {
    if (this.match.players.size < GAME.minimumPlayers) {
      this.match.phase = Phase.WAITING;
      this.match.phaseTicks = 0;
      return broadcast("Countdown canceled: not enough players.");
    }
    const remaining = GAME.countdownSeconds - Math.floor(this.match.phaseTicks / 20);
    if (remaining <= 0) { this.match.phase = Phase.STARTING; this.match.phaseTicks = 0; }
    else if (this.match.phaseTicks % 20 === 0 && remaining <= 5) broadcast(`§e${remaining}...`);
  }
  start() {
    this.captureBeds();
    this.match.startedAt = Date.now();
    this.match.elapsedTicks = 0;
    this.match.phase = Phase.LIVE;
    this.match.phaseTicks = 0;
    for (const state of this.match.players.values()) {
      const player = this.onlinePlayer(state.id);
      if (!player) { state.disconnected = true; continue; }
      state.alive = true; state.spectator = false;
      this.preparePlayer(player, state.team);
    }
    broadcast("§aThe match has begun! Protect your bed.");
    broadcast("§eInteract with your base's glowstone for items or bookshelf for team upgrades.");
  }
  preparePlayer(player, teamId) {
    clearPlayer(player);
    safe(() => player.runCommand("gamemode survival @s"), "survival mode");
    safe(() => player.teleport(this.match.arena.teams[teamId].spawn, { dimension: this.dimension() }), "team teleport");
    giveItem(player, "minecraft:wooden_sword", 1);
    if (this.playerState(player)?.armor) this.equipArmor(player, this.playerState(player).armor);
    if (GAME.spawnProtectionSeconds > 0)
      safe(() => player.addEffect("resistance", GAME.spawnProtectionSeconds * 20, { amplifier: 4, showParticles: false }), "spawn protection");
    this.applyTeamUpgrades(teamId);
  }
  tickLive() {
    this.match.elapsedTicks += GAME.tickInterval;
    this.generators.tick();
    for (const state of this.match.players.values()) {
      const player = this.onlinePlayer(state.id);
      if (!player || state.spectator || !state.alive) continue;
      if (player.location.y <= GAME.voidY) safe(() => player.runCommand("kill @s"), "void death");
    }
    if (this.match.elapsedTicks >= GAME.matchSeconds * 20) {
      for (const team of this.match.teams.values()) team.bedAlive = false;
      broadcast("§cTime limit reached. All beds have been destroyed.");
      this.checkVictory();
    }
  }
  onPlayerSpawn(player, initialSpawn) {
    const state = this.playerState(player);
    if (initialSpawn && !state && [Phase.WAITING, Phase.COUNTDOWN].includes(this.match.phase)) return system.run(() => this.join(player));
    if (!state || this.match.phase !== Phase.LIVE) return;
    if (!state.alive) system.run(() => this.beginRespawn(player, state));
  }
  onEntityDie(event) {
    if (event.deadEntity.typeId !== "minecraft:player" || this.match.phase !== Phase.LIVE) return;
    const victim = event.deadEntity;
    const state = this.playerState(victim);
    if (!state) return;
    state.alive = false;
    state.stats.deaths++;
    if (state.armor) {
      const deathLocation = { ...victim.location };
      system.run(() => this.removeDroppedPermanentArmor(deathLocation, state.armor));
    }
    const killer = event.damageSource.damagingEntity ?? this.onlinePlayer(this.lastAttacker.get(victim.id)?.id);
    const killerState = killer?.typeId === "minecraft:player" ? this.playerState(killer) : undefined;
    const final = !this.match.teams.get(state.team).bedAlive;
    if (killerState && killerState.team !== state.team) {
      killerState.stats.kills++;
      if (final) killerState.stats.finalKills++;
      broadcast(`${TEAMS[killerState.team].color}${killer.name}§r eliminated ${TEAMS[state.team].color}${victim.name}${final ? " §cFINAL KILL!" : ""}`);
    }
    if (final) {
      state.spectator = true;
      system.runTimeout(() => {
        safe(() => victim.runCommand("gamemode spectator @s"), "final spectator");
        safe(() => victim.teleport(this.match.arena.spectator, { dimension: this.dimension() }), "spectator teleport");
      }, 2);
      this.checkVictory();
    }
  }
  beginRespawn(player, state) {
    if (!this.match.teams.get(state.team).bedAlive) {
      state.spectator = true;
      safe(() => player.runCommand("gamemode spectator @s"), "spectator mode");
      return;
    }
    safe(() => player.runCommand("gamemode spectator @s"), "respawn waiting mode");
    let remaining = GAME.respawnSeconds;
    const task = system.runInterval(() => {
      if (this.match.phase !== Phase.LIVE || !player.isValid) return this.cancelRespawn(player.id);
      player.onScreenDisplay.setActionBar(`§eRespawning in ${remaining}...`);
      if (remaining-- <= 0) {
        this.cancelRespawn(player.id);
        state.alive = true; state.spectator = false;
        this.preparePlayer(player, state.team);
        tell(player, "§aRespawned.");
      }
    }, 20);
    this.respawnTasks.set(player.id, task);
  }
  cancelRespawn(id) {
    const task = this.respawnTasks.get(id);
    if (task !== undefined) system.clearRun(task);
    this.respawnTasks.delete(id);
  }
  onEntityHurt(event) {
    if (this.match.phase !== Phase.LIVE || event.hurtEntity.typeId !== "minecraft:player") return;
    if (["fire", "fireTick"].includes(event.damageSource.cause) && !this.burnTasks.has(event.hurtEntity.id)) {
      const player = event.hurtEntity;
      const task = system.runTimeout(() => {
        this.burnTasks.delete(player.id);
        if (player.isValid) safe(() => player.extinguishFire(), "limit player burn time");
      }, GAME.playerBurnSeconds * 20);
      this.burnTasks.set(player.id, task);
    }
    const attacker = event.damageSource.damagingEntity;
    if (attacker?.typeId === "minecraft:player") this.lastAttacker.set(event.hurtEntity.id, { id: attacker.id, tick: system.currentTick });
  }
  onBlockPlaced(event) {
    if (![Phase.LIVE, Phase.VICTORY, Phase.ENDING].includes(this.match.phase) || !this.playerState(event.player)) return;
    this.match.placedBlocks.add(`${event.block.location.x},${event.block.location.y},${event.block.location.z}`);
  }
  onBlockInteract(event) {
    if (!this.inBounds(event.block.location)) return;
    if (isBedType(event.block.typeId)) {
      event.cancel = true;
      return system.run(() => tell(event.player, "§cSleeping is disabled in BedWars."));
    }
    if (event.itemStack?.typeId === "minecraft:flint_and_steel") {
      event.cancel = true;
      if (event.isFirstEvent) {
        const blockLocation = { ...event.block.location };
        const blockFace = event.blockFace;
        system.run(() => this.ignitePlayerBlock(event.player, blockLocation, blockFace));
      }
      return;
    }
    if (!event.isFirstEvent) return;
    for (const config of Object.values(this.match.arena.teams)) {
      if (distanceSquared(event.block.location, config.shop) <= GAME.stationInteractionRadius ** 2) {
        event.cancel = true;
        return system.run(() => this.shop.open(event.player));
      }
      if (distanceSquared(event.block.location, config.upgrades) <= GAME.stationInteractionRadius ** 2) {
        event.cancel = true;
        return system.run(() => this.shop.openUpgrades(event.player));
      }
    }
  }
  onBlockBreak(event) {
    if (this.match.phase !== Phase.LIVE) return;
    if (this.isShopStation(event.block.location)) {
      event.cancel = true;
      return system.run(() => tell(event.player, "§cShop blocks cannot be broken."));
    }
    const attacker = this.playerState(event.player);
    if (!attacker) return;
    for (const [teamId, teamConfig] of Object.entries(this.match.arena.teams)) {
      const bedLocations = this.bedSnapshots.get(teamId)?.map(entry => entry.location) ?? [teamConfig.bed];
      if (!bedLocations.some(location => sameBlock(event.block.location, location))) continue;
      if (attacker.team === teamId) {
        event.cancel = true;
        return system.run(() => tell(event.player, "§cYou cannot destroy your own bed."));
      }
      const team = this.match.teams.get(teamId);
      if (!team.bedAlive) return;
      event.cancel = true;
      team.bedAlive = false;
      attacker.stats.bedsDestroyed++;
      system.run(() => {
        for (const location of bedLocations)
          safe(() => this.dimension().getBlock(location)?.setType("minecraft:air"), "remove destroyed bed");
        broadcast(`§l§cBED DESTROYED!§r ${TEAMS[teamId].color}${TEAMS[teamId].name} Team§r can no longer respawn.`);
      });
      return;
    }
    const encoded = `${event.block.location.x},${event.block.location.y},${event.block.location.z}`;
    if (!this.match.placedBlocks.has(encoded)) {
      event.cancel = true;
      return system.run(() => tell(event.player, "§cOriginal arena blocks cannot be broken."));
    }
    this.match.placedBlocks.delete(encoded);
  }
  onExplosion(event) {
    if (this.match.phase !== Phase.LIVE) return;
    event.setImpactedBlocks(event.getImpactedBlocks().filter(block =>
      !this.inBounds(block.location) || (
        this.match.placedBlocks.has(`${block.location.x},${block.location.y},${block.location.z}`) &&
        !isBedType(block.typeId) && !this.isShopStation(block.location)
      )
    ));
  }
  onItemUse(event) {
    const type = event.itemStack.typeId;
    if (type === "minecraft:fire_charge" && this.canShop(event.source)) {
      system.run(() => {
        const view = event.source.getViewDirection();
        safe(() => event.source.dimension.createExplosion({
          x: event.source.location.x + view.x * 4, y: event.source.location.y + 1 + view.y * 4, z: event.source.location.z + view.z * 4
        }, 2.5, { breaksBlocks: true, causesFire: false, source: event.source }), "fireball explosion");
      });
    }
  }
  applyTeamUpgrades(teamId) {
    const upgrades = this.match.teams.get(teamId).upgrades;
    for (const state of this.match.players.values()) {
      if (state.team !== teamId) continue;
      const player = this.onlinePlayer(state.id);
      if (!player) continue;
      const container = player.getComponent("minecraft:inventory")?.container;
      if (container) for (let index = 0; index < container.size; index++) {
        const stack = container.getItem(index);
        if (!stack) continue;
        let changed = false;
        if (upgrades.sharpness && this.enchant(stack, "minecraft:sharpness", upgrades.sharpness)) changed = true;
        if (upgrades.knockback && this.enchant(stack, "minecraft:knockback", upgrades.knockback)) changed = true;
        if (changed) container.setItem(index, stack);
      }
      if (upgrades.protection) {
        const equipment = player.getComponent("minecraft:equippable");
        for (const slot of [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet]) {
          const stack = equipment?.getEquipment(slot);
          if (stack && this.enchant(stack, "minecraft:protection", upgrades.protection)) equipment.setEquipment(slot, stack);
        }
      }
    }
  }
  enchant(stack, enchantmentId, level) {
    return safe(() => {
      const type = EnchantmentTypes.get(enchantmentId);
      const component = stack.getComponent("minecraft:enchantable");
      if (!type || !component) return false;
      const enchantment = { type, level };
      if (!component.canAddEnchantment(enchantment) && !component.hasEnchantment(type)) return false;
      if (component.hasEnchantment(type)) component.removeEnchantment(type);
      component.addEnchantment(enchantment);
      return true;
    }, `enchant ${enchantmentId}`) ?? false;
  }
  equipArmor(player, bundle) {
    const equipment = player.getComponent("minecraft:equippable");
    if (!equipment) return;
    for (const [typeId] of bundle) {
      const slot = typeId.endsWith("_leggings") ? EquipmentSlot.Legs : typeId.endsWith("_boots") ? EquipmentSlot.Feet : undefined;
      if (slot) safe(() => equipment.setEquipment(slot, new ItemStack(typeId, 1)), "equip armor");
    }
    const state = this.playerState(player);
    if (state) this.applyTeamUpgrades(state.team);
  }
  removeDroppedPermanentArmor(location, bundle) {
    const permanentTypes = new Set(bundle.map(([typeId]) => typeId));
    for (const entity of this.dimension().getEntities({ type: "minecraft:item", location, maxDistance: 3 })) {
      const typeId = safe(() => entity.getComponent("minecraft:item")?.itemStack?.typeId, "read dropped armor");
      if (typeId && permanentTypes.has(typeId)) safe(() => entity.remove(), "remove dropped permanent armor");
    }
  }
  checkVictory() {
    if (this.match.phase !== Phase.LIVE) return;
    const aliveTeams = new Set([...this.match.players.values()].filter(p => !p.disconnected && (p.alive || this.match.teams.get(p.team).bedAlive)).map(p => p.team));
    if (aliveTeams.size === 1) this.end([...aliveTeams][0], "Victory");
    else if (aliveTeams.size === 0) this.end(undefined, "Draw");
  }
  end(winner, reason) {
    if (![Phase.LIVE, Phase.COUNTDOWN, Phase.WAITING].includes(this.match.phase)) return;
    this.match.winner = winner;
    this.match.phase = Phase.VICTORY;
    this.match.phaseTicks = 0;
    broadcast(winner ? `§l${TEAMS[winner].color}${TEAMS[winner].name} TEAM WINS!§r` : `§eMatch ended: ${reason}.`);
  }
  beginEnding() {
    this.match.phase = Phase.ENDING;
    this.match.phaseTicks = 0;
    const snapshot = this.match.snapshot();
    const result = {
      schemaVersion: 1, arenaId: snapshot.arenaId, winnerTeam: snapshot.winner,
      durationSeconds: Math.floor(snapshot.elapsedTicks / 20),
      players: snapshot.players.map(player => ({
        playerId: player.id, playerName: player.name, team: player.team,
        won: player.team === snapshot.winner, ...player.stats,
        crownsEarned: player.team === snapshot.winner ? GAME.rewards.winCrowns : GAME.rewards.lossCrowns,
        experienceEarned: player.stats.kills * GAME.rewards.killXp + player.stats.finalKills * GAME.rewards.finalKillXp +
          player.stats.bedsDestroyed * GAME.rewards.bedXp + (player.team === snapshot.winner ? GAME.rewards.winXp : 0)
      }))
    };
    Promise.resolve(this.reporter.reportMatch(result)).catch(error => console.warn(`[RFL] Reporter failed: ${error}`));
  }
  reset() {
    for (const id of this.respawnTasks.keys()) this.cancelRespawn(id);
    this.stationSneakLatch.clear();
    for (const task of this.burnTasks.values()) system.clearRun(task);
    this.burnTasks.clear();
    for (const encoded of this.activeFire.keys()) {
      const [x, y, z] = encoded.split(",").map(Number);
      safe(() => {
        const block = this.dimension().getBlock({ x, y, z });
        if (block?.typeId === "minecraft:fire") block.setType("minecraft:air");
      }, "clear match fire");
    }
    this.activeFire.clear();
    const players = [...this.match.players.values()].map(state => this.onlinePlayer(state.id)).filter(Boolean);
    for (const encoded of this.match.placedBlocks) {
      const [x, y, z] = encoded.split(",").map(Number);
      safe(() => this.dimension().getBlock({ x, y, z })?.setType("minecraft:air"), "remove placed block");
    }
    for (const snapshots of this.bedSnapshots.values()) for (const snapshot of snapshots)
      safe(() => this.dimension().getBlock(snapshot.location)?.setPermutation(snapshot.permutation), "restore bed");
    this.dimension().getEntities({ type: "minecraft:item" }).forEach(entity => {
      if (this.inBounds(entity.location)) safe(() => entity.remove(), "remove dropped item");
    });
    this.match.reset();
    this.admin.loadOverrides();
    this.setupShopStations();
    for (const player of players) {
      clearPlayer(player);
      safe(() => player.runCommand("gamemode adventure @s"), "reset mode");
      safe(() => player.teleport(this.match.arena.lobby, { dimension: this.dimension() }), "reset teleport");
      this.join(player);
    }
    broadcast("§aArena reset complete.");
  }
  inBounds(location) {
    const { min, max } = this.match.arena.bounds;
    return location.x >= min.x && location.x <= max.x && location.y >= min.y && location.y <= max.y && location.z >= min.z && location.z <= max.z;
  }
  isShopStation(location) {
    return Object.values(this.match.arena.teams).some(config =>
      sameBlock(location, config.shop) || sameBlock(location, config.upgrades)
    );
  }
  setupShopStations() {
    for (const config of Object.values(this.match.arena.teams)) {
      this.setupShopStation(config.shop, "minecraft:glowstone", "shop");
      this.setupShopStation(config.upgrades, "minecraft:bookshelf", "upgrades");
    }
  }
  setupShopStation(location, typeId, role) {
    const dimension = this.dimension();
    let block;
    try { block = dimension.getBlock(location); } catch { return; }
    if (!block) return;
    if (block.typeId !== typeId) safe(() => block.setType(typeId), `place ${role} block`);
    try {
      for (const marker of dimension.getEntities({
        type: "minecraft:armor_stand", tags: ["rfl:shop_label"],
        location: { x: location.x + 0.5, y: location.y + 1, z: location.z + 0.5 },
        maxDistance: 2
      })) marker.remove();
    } catch { return; }
  }
  ignitePlayerBlock(player, blockLocation, blockFace) {
    const supportKey = `${blockLocation.x},${blockLocation.y},${blockLocation.z}`;
    if (!this.match.placedBlocks.has(supportKey))
      return tell(player, "§cFlint & Steel can only ignite player-placed blocks.");
    const offset = FACE_OFFSET[String(blockFace).toLowerCase()];
    if (!offset) return tell(player, "§cThat block face cannot be ignited.");
    const fireLocation = {
      x: blockLocation.x + offset.x, y: blockLocation.y + offset.y, z: blockLocation.z + offset.z
    };
    if (!this.inBounds(fireLocation)) return tell(player, "§cFire cannot be placed outside the arena.");
    const fireBlock = safe(() => this.dimension().getBlock(fireLocation), "read fire location");
    if (!fireBlock || fireBlock.typeId !== "minecraft:air") return tell(player, "§cFire needs an empty adjacent block.");
    if (!safe(() => { fireBlock.setType("minecraft:fire"); return true; }, "place temporary fire")) return;
    this.consumeFlintUse(player);
    const encoded = `${fireLocation.x},${fireLocation.y},${fireLocation.z}`;
    const token = system.currentTick;
    this.activeFire.set(encoded, token);
    system.runTimeout(() => {
      if (this.activeFire.get(encoded) !== token) return;
      this.activeFire.delete(encoded);
      safe(() => {
        const block = this.dimension().getBlock(fireLocation);
        if (block?.typeId === "minecraft:fire") block.setType("minecraft:air");
      }, "remove temporary fire");
    }, GAME.fireGroundSeconds * 20);
  }
  consumeFlintUse(player) {
    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container) return;
    const index = player.selectedSlotIndex;
    const stack = container.getItem(index);
    if (stack?.typeId !== "minecraft:flint_and_steel") return;
    const durability = stack.getComponent("minecraft:durability");
    if (!durability) return;
    durability.damage++;
    if (durability.damage >= durability.maxDurability) {
      container.setItem(index);
      safe(() => player.playSound("random.break"), "flint break sound");
    } else container.setItem(index, stack);
  }
  tickStationInteraction() {
    for (const state of this.match.players.values()) {
      const player = this.onlinePlayer(state.id);
      if (!player) continue;
      if (!player.isSneaking) {
        this.stationSneakLatch.delete(player.id);
        continue;
      }
      if (this.stationSneakLatch.has(player.id) || this.match.phase !== Phase.LIVE) continue;
      const config = this.match.arena.teams[state.team];
      if (distanceSquared(player.location, config.shop) <= GAME.shopRadius ** 2) {
        this.stationSneakLatch.add(player.id);
        system.run(() => this.shop.open(player));
      } else if (distanceSquared(player.location, config.upgrades) <= GAME.shopRadius ** 2) {
        this.stationSneakLatch.add(player.id);
        system.run(() => this.shop.openUpgrades(player));
      }
    }
  }
  captureBeds() {
    this.bedSnapshots.clear();
    const offsets = [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
    for (const [teamId, config] of Object.entries(this.match.arena.teams)) {
      const snapshots = [];
      for (const offset of offsets) {
        const location = { x: Math.floor(config.bed.x) + offset.x, y: Math.floor(config.bed.y), z: Math.floor(config.bed.z) + offset.z };
        const block = safe(() => this.dimension().getBlock(location), "read bed");
        if (block && isBedType(block.typeId))
          snapshots.push({ location, permutation: block.permutation });
      }
      if (!snapshots.length) console.warn(`[RFL] No bed block found at ${teamId} bed marker`);
      this.bedSnapshots.set(teamId, snapshots);
    }
  }
  broadcastTeam(teamId, message) {
    for (const state of this.match.players.values()) if (state.team === teamId) this.onlinePlayer(state.id)?.sendMessage(message);
  }
  updateHud() {
    const phase = this.match.phase.toUpperCase();
    const timer = this.match.phase === Phase.LIVE ? formatTime(Math.max(0, GAME.matchSeconds - Math.floor(this.match.elapsedTicks / 20))) : phase;
    for (const state of this.match.players.values()) {
      const player = this.onlinePlayer(state.id);
      if (!player) continue;
      const beds = [...this.match.teams.entries()].map(([id, team]) => `${TEAMS[id].color}${TEAMS[id].name}: ${team.bedAlive ? "§a✔" : "§c✘"}`).join(" §8| ");
      const generator = this.match.phase === Phase.LIVE ? this.generators.nearestMapCountdown(player.location) : undefined;
      const generatorHud = generator
        ? ` §8| ${generator.type === "emerald" ? "§aEmerald" : "§bDiamond"}: §f${generator.seconds}s`
        : "";
      const config = this.match.arena.teams[state.team];
      const stationHud = this.match.phase === Phase.LIVE && distanceSquared(player.location, config.shop) <= GAME.shopRadius ** 2
        ? " §8| §eSneak: Shop"
        : this.match.phase === Phase.LIVE && distanceSquared(player.location, config.upgrades) <= GAME.shopRadius ** 2
          ? " §8| §bSneak: Upgrades"
          : "";
      safe(() => player.onScreenDisplay.setActionBar(`§6RFL §8| §f${timer} §8| ${beds}${generatorHud}${stationHud}`), "HUD");
    }
  }
}
