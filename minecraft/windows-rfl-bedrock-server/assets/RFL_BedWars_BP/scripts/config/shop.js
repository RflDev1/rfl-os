export const SHOP = Object.freeze({
  Blocks: [
    { id: "wool", name: "16 Wool", item: "$TEAM_WOOL", amount: 16, currency: "iron", price: 4 },
    { id: "wood", name: "16 Wood", item: "minecraft:oak_planks", amount: 16, currency: "gold", price: 4 },
    { id: "concrete", name: "16 Concrete", item: "$TEAM_CONCRETE", amount: 16, currency: "iron", price: 12 },
    { id: "end_stone", name: "12 End Stone", item: "minecraft:end_stone", amount: 12, currency: "iron", price: 24 },
    { id: "obsidian", name: "4 Obsidian", item: "minecraft:obsidian", amount: 4, currency: "emerald", price: 6 }
  ],
  Weapons: [
    { id: "stone_sword", name: "Stone Sword", item: "minecraft:stone_sword", amount: 1, currency: "iron", price: 10 },
    { id: "iron_sword", name: "Iron Sword", item: "minecraft:iron_sword", amount: 1, currency: "gold", price: 7 },
    { id: "diamond_sword", name: "Diamond Sword", item: "minecraft:diamond_sword", amount: 1, currency: "emerald", price: 4 }
  ],
  "Armor (Permanent)": [
    { id: "chain", name: "Chain Armor", bundle: [["minecraft:chainmail_leggings", 1], ["minecraft:chainmail_boots", 1]], currency: "iron", price: 40 },
    { id: "iron", name: "Iron Armor", bundle: [["minecraft:iron_leggings", 1], ["minecraft:iron_boots", 1]], currency: "gold", price: 12 },
    { id: "diamond", name: "Diamond Armor", bundle: [["minecraft:diamond_leggings", 1], ["minecraft:diamond_boots", 1]], currency: "emerald", price: 8 }
  ],
  "Tools (Lost on Death)": [
    { id: "iron_pickaxe", name: "Iron Pickaxe", item: "minecraft:iron_pickaxe", amount: 1, currency: "iron", price: 10 },
    { id: "diamond_pickaxe", name: "Diamond Pickaxe", item: "minecraft:diamond_pickaxe", amount: 1, currency: "gold", price: 6 },
    { id: "iron_axe", name: "Iron Axe", item: "minecraft:iron_axe", amount: 1, currency: "iron", price: 10 },
    { id: "diamond_axe", name: "Diamond Axe", item: "minecraft:diamond_axe", amount: 1, currency: "gold", price: 6 },
    { id: "shears", name: "Shears", item: "minecraft:shears", amount: 1, currency: "iron", price: 20 }
  ],
  Ranged: [
    { id: "bow", name: "Bow", item: "minecraft:bow", amount: 1, currency: "gold", price: 12 },
    { id: "arrows", name: "8 Arrows", item: "minecraft:arrow", amount: 8, currency: "gold", price: 2 },
    { id: "eggs", name: "16 Eggs", item: "minecraft:egg", amount: 16, currency: "iron", price: 48 }
  ],
  Utility: [
    { id: "tnt", name: "TNT", item: "minecraft:tnt", amount: 1, currency: "gold", price: 5 },
    { id: "fireball", name: "Fireball", item: "minecraft:fire_charge", amount: 1, currency: "iron", price: 40 },
    { id: "flint_and_steel", name: "Flint & Steel (8 Uses)", item: "minecraft:flint_and_steel", amount: 1, durabilityUses: 8, currency: "gold", price: 4 },
    { id: "golden_apple", name: "Golden Apple", item: "minecraft:golden_apple", amount: 1, currency: "gold", price: 4 },
    { id: "ender_pearl", name: "Ender Pearl", item: "minecraft:ender_pearl", amount: 1, currency: "emerald", price: 5 }
  ]
});

export const UPGRADES = Object.freeze([
  { id: "protection", name: "Protection I", currency: "diamond", prices: [4], maxLevel: 1 },
  { id: "sharpness", name: "Sharpness I", currency: "diamond", prices: [6], maxLevel: 1 },
  { id: "knockback", name: "Knockback I", currency: "diamond", prices: [8], maxLevel: 1 },
  { id: "generator", name: "Generator", levelNames: ["Generator II", "Generator III"], currency: "diamond", prices: [4, 8], maxLevel: 2 }
]);
