import { EquipmentSlot, ItemStack, world } from "@minecraft/server";

export const clone = (value) => JSON.parse(JSON.stringify(value));
export const key = (player) => player.id;
export const distanceSquared = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
export const sameBlock = (a, b) => Math.floor(a.x) === Math.floor(b.x) && Math.floor(a.y) === Math.floor(b.y) && Math.floor(a.z) === Math.floor(b.z);
export const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
export const safe = (action, context = "operation") => {
  try { return action(); } catch (error) { console.warn(`[RFL] ${context}: ${error}`); return undefined; }
};
export const tell = (player, text) => safe(() => player.sendMessage(`§8[§6RFL§8]§r ${text}`), "message");
export const broadcast = (text) => world.sendMessage(`§8[§6RFL§8]§r ${text}`);
export const inventory = (player) => player.getComponent("minecraft:inventory")?.container;
export function countItem(player, typeId) {
  const container = inventory(player);
  let total = 0;
  if (!container) return total;
  for (let i = 0; i < container.size; i++) if (container.getItem(i)?.typeId === typeId) total += container.getItem(i).amount;
  return total;
}
export function removeItem(player, typeId, amount) {
  const container = inventory(player);
  if (!container || countItem(player, typeId) < amount) return false;
  let remaining = amount;
  for (let i = 0; i < container.size && remaining; i++) {
    const stack = container.getItem(i);
    if (stack?.typeId !== typeId) continue;
    const take = Math.min(stack.amount, remaining);
    remaining -= take;
    if (take === stack.amount) container.setItem(i);
    else { stack.amount -= take; container.setItem(i, stack); }
  }
  return true;
}
export function giveItem(player, typeId, amount = 1) {
  const container = inventory(player);
  if (!container) return false;
  let remaining = amount;
  while (remaining > 0) {
    const count = Math.min(remaining, 64);
    const leftover = container.addItem(new ItemStack(typeId, count));
    if (leftover) player.dimension.spawnItem(leftover, player.location);
    remaining -= count;
  }
  return true;
}
export function giveItemWithUses(player, typeId, uses) {
  const container = inventory(player);
  if (!container) return false;
  const stack = new ItemStack(typeId, 1);
  const durability = stack.getComponent("minecraft:durability");
  if (durability) durability.damage = Math.max(0, durability.maxDurability - uses);
  const leftover = container.addItem(stack);
  if (leftover) player.dimension.spawnItem(leftover, player.location);
  return true;
}
export function clearPlayer(player) {
  safe(() => inventory(player)?.clearAll(), "clear inventory");
  const equipment = safe(() => player.getComponent("minecraft:equippable"), "get equipment");
  if (equipment) for (const slot of [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet, EquipmentSlot.Offhand])
    safe(() => equipment.setEquipment(slot), "clear equipment");
  safe(() => player.runCommand("effect @s clear"), "clear effects");
}
