/**
 * Arena coordinates are the only map-specific data. Coordinates represent block
 * centers unless noted. Replace the example values or use rfl:setpos commands.
 */
export const ARENAS = [
  {
    id: "duel_01",
    displayName: "BedWars 2019 Duel Arena",
    dimension: "overworld",
    enabled: true,
    bounds: { min: { x: -24, y: 0, z: -56 }, max: { x: 42, y: 90, z: 65 } },
    lobby: { x: 6.5, y: 77, z: 10.5 },
    spectator: { x: 9.5, y: 25, z: 4.5 },
    teams: {
      red: {
        spawn: { x: 9, y: 5, z: -43 },
        bed: { x: 9, y: 5, z: -34 },
        generator: { x: 9.5, y: 5, z: -46.5 },
        shop: { x: 14, y: 5, z: -43 },
        upgrades: { x: 5, y: 5, z: -42 }
      },
      blue: {
        spawn: { x: 9, y: 5, z: 52 },
        bed: { x: 9, y: 5, z: 42 },
        generator: { x: 9.5, y: 5, z: 55.5 },
        shop: { x: 3, y: 5, z: 52 },
        upgrades: { x: 15, y: 5, z: 51 }
      }
    },
    generators: [
      { id: "diamond_west", type: "diamond", location: { x: -9.5, y: 2, z: 4.5 } },
      { id: "diamond_east", type: "diamond", location: { x: 28.5, y: 2, z: 4.5 } },
      { id: "emerald_west", type: "emerald", location: { x: -9.5, y: 19, z: 4.5 } },
      { id: "emerald_east", type: "emerald", location: { x: 27.5, y: 19, z: 4.5 } }
    ]
  }
];
