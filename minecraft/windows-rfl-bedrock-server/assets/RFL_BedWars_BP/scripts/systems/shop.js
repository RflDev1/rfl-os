import { ActionFormData } from "@minecraft/server-ui";
import { SHOP, UPGRADES } from "../config/shop.js";
import { GAME, TEAMS } from "../config/game.js";
import { countItem, distanceSquared, giveItem, giveItemWithUses, removeItem, tell } from "../core/util.js";

const CURRENCY = { iron: "minecraft:iron_ingot", gold: "minecraft:gold_ingot", emerald: "minecraft:emerald", diamond: "minecraft:diamond" };

export class ShopSystem {
  constructor(engine) { this.engine = engine; }
  isAtTeamShop(player) {
    const state = this.engine.playerState(player);
    if (!state) return false;
    return distanceSquared(player.location, this.engine.match.arena.teams[state.team].shop) <= GAME.shopRadius ** 2;
  }
  isAtTeamUpgrades(player) {
    const state = this.engine.playerState(player);
    if (!state) return false;
    return distanceSquared(player.location, this.engine.match.arena.teams[state.team].upgrades) <= GAME.shopRadius ** 2;
  }
  async open(player) {
    if (!this.engine.canShop(player)) return tell(player, "The shop is only available during a live match.");
    if (!this.isAtTeamShop(player)) return tell(player, "§cYou must be at your team's base shop.");
    const categories = Object.keys(SHOP);
    const form = new ActionFormData().title("§lSHOP").body("Choose a currency");
    categories.forEach(category => form.button(category));
    const result = await form.show(player);
    if (!result.canceled && result.selection !== undefined) this.openCategory(player, categories[result.selection]);
  }
  async openCategory(player, category) {
    const entries = SHOP[category];
    const form = new ActionFormData().title(`§l${category}`).body("Select an item to purchase");
    entries.forEach(item => form.button(`${item.name}\n§7${item.price} ${item.currency}`));
    form.button("§8Back");
    const result = await form.show(player);
    if (result.canceled) return;
    if (result.selection === entries.length) return this.open(player);
    if (result.selection !== undefined) {
      this.purchase(player, entries[result.selection]);
      this.openCategory(player, category);
    }
  }
  purchase(player, offer) {
    if (!this.isAtTeamShop(player)) return tell(player, "§cYou must stay at your team's base shop.");
    const matchPlayer = this.engine.playerState(player);
    const currency = CURRENCY[offer.currency];
    if (!currency || countItem(player, currency) < offer.price) return tell(player, `§cYou need ${offer.price} ${offer.currency}.`);
    if (!removeItem(player, currency, offer.price)) return tell(player, "§cPurchase failed.");
    if (offer.bundle) {
      matchPlayer.armor = offer.bundle;
      this.engine.equipArmor(player, offer.bundle);
    }
    else {
      const item = offer.item === "$TEAM_WOOL" ? TEAMS[matchPlayer.team].wool
        : offer.item === "$TEAM_CONCRETE" ? TEAMS[matchPlayer.team].concrete
        : offer.item;
      if (offer.durabilityUses) giveItemWithUses(player, item, offer.durabilityUses);
      else giveItem(player, item, offer.amount);
    }
    this.engine.applyTeamUpgrades(matchPlayer.team);
    tell(player, `§aPurchased ${offer.name}.`);
  }
  async openUpgrades(player) {
    const state = this.engine.playerState(player);
    if (!state || !this.engine.canShop(player)) return tell(player, "Team upgrades are only available during a live match.");
    if (!this.isAtTeamUpgrades(player)) return tell(player, "§cYou must be at your team's upgrade shop.");
    const team = this.engine.match.teams.get(state.team);
    const form = new ActionFormData().title("§lTEAM UPGRADES").body(`§7Diamonds: ${countItem(player, CURRENCY.diamond)}`);
    UPGRADES.forEach(upgrade => {
      const level = team.upgrades[upgrade.id] ?? 0;
      const maxed = level >= upgrade.maxLevel;
      const price = upgrade.prices[Math.min(level, upgrade.prices.length - 1)];
      const name = upgrade.levelNames?.[level] ?? upgrade.name;
      form.button(`${name}\n${maxed ? "§aMAX" : `§b${price} diamond`}`);
    });
    const result = await form.show(player);
    if (!result.canceled && result.selection !== undefined) {
      this.purchaseUpgrade(player, UPGRADES[result.selection]);
      this.openUpgrades(player);
    }
  }
  purchaseUpgrade(player, upgrade) {
    if (!this.isAtTeamUpgrades(player)) return tell(player, "§cYou must stay at your team's upgrade shop.");
    const state = this.engine.playerState(player);
    const team = this.engine.match.teams.get(state.team);
    const level = team.upgrades[upgrade.id] ?? 0;
    if (level >= upgrade.maxLevel) return tell(player, "§eThat upgrade is already maxed.");
    const price = upgrade.prices[Math.min(level, upgrade.prices.length - 1)];
    if (!removeItem(player, CURRENCY[upgrade.currency], price)) return tell(player, `§cYou need ${price} ${upgrade.currency}.`);
    team.upgrades[upgrade.id] = level + 1;
    const purchasedName = upgrade.levelNames?.[level] ?? upgrade.name;
    this.engine.broadcastTeam(state.team, `§a${player.name} purchased ${purchasedName}.`);
    this.engine.applyTeamUpgrades(state.team);
  }
}
