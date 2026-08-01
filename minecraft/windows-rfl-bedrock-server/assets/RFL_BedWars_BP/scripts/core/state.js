import { clone } from "./util.js";

export const Phase = Object.freeze({
  WAITING: "waiting", COUNTDOWN: "countdown", STARTING: "starting", LIVE: "live",
  VICTORY: "victory", ENDING: "ending", RESET: "reset"
});

export class MatchState {
  constructor(arena) { this.arena = arena; this.reset(); }
  reset() {
    this.phase = Phase.WAITING;
    this.phaseTicks = 0;
    this.elapsedTicks = 0;
    this.players = new Map();
    this.teams = new Map(Object.keys(this.arena.teams).map(id => [id, {
      id, bedAlive: true, upgrades: { protection: 0, sharpness: 0, knockback: 0, generator: 0 }
    }]));
    this.placedBlocks = new Set();
    this.generatorTicks = new Map();
    this.winner = undefined;
    this.startedAt = undefined;
  }
  addPlayer(player, team) {
    this.players.set(player.id, {
      id: player.id, name: player.name, team, alive: true, spectator: false,
      disconnected: false, armor: undefined,
      stats: { kills: 0, finalKills: 0, deaths: 0, bedsDestroyed: 0 }
    });
  }
  snapshot() {
    return clone({
      arenaId: this.arena.id, phase: this.phase, elapsedTicks: this.elapsedTicks,
      winner: this.winner, players: [...this.players.values()], teams: [...this.teams.values()]
    });
  }
}
