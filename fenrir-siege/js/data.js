/* Fenrir Siege — data tables and tunables.
   Every cost, timer, HP, DPS and unlock rule lives here. Timers are in seconds
   and are multiplied by TIME_SCALE; production is per hour and divided by it. */
(function (FS) {
  'use strict';
  const D = FS.D = {};

  // ---------- global tunables ----------
  D.TIME_SCALE = 1;          // 1 = demo pacing (L1 builds ~10s). Raise to slow everything down.
  D.PROD_SCALE = 1;          // multiplies resource production
  D.GRID = 44;               // village is GRID x GRID tiles
  D.MAX_HALL = 8;
  D.SAVE_KEY = 'fenrir-siege-save';
  D.AUTOSAVE_SEC = 5;
  D.BATTLE_TIME = 180;       // 3:00 raid timer
  D.MAX_UNITS = 180;
  D.STEP = 1 / 30;           // fixed battle simulation step (deterministic replays)
  D.RAID_AWAY_MIN = 10;      // minutes away before AI raids may hit the village
  D.SHIELD_MIN = { 40: 60, 90: 120 }; // destruction % -> shield minutes
  D.OBSTACLE_EVERY = 240;    // seconds between natural obstacle spawns
  D.OBSTACLE_MAX = 24;
  D.LOOT_STORAGE = [0.2, 0.2, 0.18, 0.16, 0.14, 0.12, 0.1, 0.1]; // share of stored loot that can be stolen, by hall
  D.LOOT_COLLECTOR = 0.5;
  D.LOOT_HALL_SHARE = 0.25;  // hall holds this share of stolen storage loot (and protects the rest)
  D.FIND_COST = [50, 100, 180, 280, 400, 550, 720, 900];
  D.BUILDER_GEMS = [0, 0, 100, 200, 400]; // price of the Nth builder hut (index = huts already owned)
  D.MAX_BUILDERS = 5;
  D.START = { gold: 1000, mead: 1000, rs: 0, gems: 50 };
  D.LEVEL_GEMS = 5;          // gems per player level
  D.xpNeed = (lv) => 20 + lv * 18;
  D.xpFor = (sec) => Math.max(1, Math.floor(Math.sqrt(sec)));
  // gem price to finish `sec` seconds of work now
  D.speedGems = (sec) => (sec <= 0 ? 0 : Math.max(1, Math.ceil(Math.pow(sec / 60, 0.82) * 2)));

  D.RES = {
    gold: { name: 'Gold', col: '#ffcf8a' },
    mead: { name: 'Mead', col: '#e7a93b' },
    rs: { name: 'Runestone', col: '#8a5cff' },
    gems: { name: 'Gems', col: '#9af0ff' },
  };

  // Standard level timer curve (seconds before TIME_SCALE)
  const T = [10, 20, 40, 75, 120, 180, 270, 400];
  const HP = (base, k) => [1, 1.16, 1.34, 1.55, 1.8, 2.08, 2.4, 2.76].map((m) => Math.round(base * m * (k || 1)));
  const DPS = (base) => [1, 1.16, 1.34, 1.54, 1.77, 2.02, 2.3, 2.6].map((m) => Math.round(base * m * 10) / 10);

  // ---------- buildings ----------
  // cat: hall | res | army | def | trap | wall | other
  // max[] and count[] are indexed by Great Hall level - 1.
  D.B = {
    hall: {
      name: 'Great Hall', size: 4, cat: 'hall', res: 'gold',
      cost: [0, 1200, 4000, 10000, 24000, 48000, 90000, 150000],
      time: [0, 30, 60, 120, 200, 300, 420, 600],
      hp: [1500, 1800, 2200, 2700, 3300, 4000, 4800, 5700],
      store: { gold: [2000, 4000, 8000, 15000, 30000, 50000, 80000, 120000], mead: [2000, 4000, 8000, 15000, 30000, 50000, 80000, 120000], rs: [0, 0, 0, 300, 700, 1200, 2000, 3000] },
      desc: 'Heart of the wolf clan. Its level decides what you can build and how far everything can grow.',
    },
    builder: {
      name: 'Builder Hut', size: 2, cat: 'other', res: 'gems', cost: [0], time: [0], hp: [250],
      desc: 'Each hut houses one builder. Every construction or upgrade needs a free builder.',
    },
    goldmint: {
      name: 'Gold Mint', size: 3, cat: 'res', res: 'mead',
      cost: [150, 500, 1500, 3500, 7000, 14000, 26000, 45000], time: T, hp: HP(400),
      prod: 'gold', rate: [2400, 3200, 4200, 5400, 6800, 8400, 10200, 12000], cap: [800, 1400, 2200, 3200, 4500, 6000, 8000, 10000],
      desc: 'Strikes gold coins over time. Tap it to collect.',
    },
    meadbrew: {
      name: 'Mead Brewery', size: 3, cat: 'res', res: 'gold',
      cost: [150, 500, 1500, 3500, 7000, 14000, 26000, 45000], time: T, hp: HP(400),
      prod: 'mead', rate: [2400, 3200, 4200, 5400, 6800, 8400, 10200, 12000], cap: [800, 1400, 2200, 3200, 4500, 6000, 8000, 10000],
      desc: 'Brews honey mead, the fuel of every army. Tap it to collect.',
    },
    rsdrill: {
      name: 'Runestone Drill', size: 3, cat: 'res', res: 'mead',
      cost: [5000, 9000, 15000, 25000, 40000, 60000, 85000, 120000], time: T.map((t) => t * 1.5), hp: HP(500),
      prod: 'rs', rate: [120, 160, 210, 270, 340, 420, 510, 600], cap: [60, 100, 150, 210, 280, 360, 450, 550],
      desc: 'Bores into the bedrock for glowing runestone.',
    },
    goldvault: {
      name: 'Gold Vault', size: 3, cat: 'res', res: 'mead',
      cost: [300, 1000, 2500, 6000, 12000, 25000, 45000, 75000], time: T, hp: HP(600),
      store: { gold: [1500, 3000, 6000, 12000, 25000, 45000, 70000, 100000] },
      desc: 'Holds gold. More vaults, bigger hoard.',
    },
    meadcellar: {
      name: 'Mead Cellar', size: 3, cat: 'res', res: 'gold',
      cost: [300, 1000, 2500, 6000, 12000, 25000, 45000, 75000], time: T, hp: HP(600),
      store: { mead: [1500, 3000, 6000, 12000, 25000, 45000, 70000, 100000] },
      desc: 'Barrels and barrels of mead.',
    },
    rsvault: {
      name: 'Runestone Vault', size: 2, cat: 'res', res: 'gold',
      cost: [8000, 14000, 22000, 34000, 50000, 70000, 95000, 125000], time: T.map((t) => t * 1.5), hp: HP(700),
      store: { rs: [400, 800, 1300, 2000, 3000, 4200, 5600, 7200] },
      desc: 'A sealed stone chest for runestone.',
    },
    barracks: {
      name: 'Barracks', size: 3, cat: 'army', res: 'mead',
      cost: [200, 600, 1500, 3500, 7000, 14000, 26000, 45000], time: T, hp: HP(500),
      desc: 'Trains troops. Higher levels unlock new troop types. Several barracks train in parallel.',
    },
    camp: {
      name: 'Army Camp', size: 4, cat: 'army', res: 'mead',
      cost: [250, 1000, 3000, 7000, 14000, 26000, 45000, 70000], time: T, hp: HP(400),
      housing: [20, 30, 40, 50, 60, 70, 80, 90],
      desc: 'Where your trained army waits. Each level adds housing space.',
    },
    forge: {
      name: 'Rune Forge', size: 3, cat: 'army', res: 'mead',
      cost: [1500, 4000, 9000, 18000, 32000, 55000, 85000, 120000], time: T, hp: HP(500),
      desc: 'Research stronger troops and spells. One research at a time.',
    },
    seidr: {
      name: 'Seidr Hut', size: 3, cat: 'army', res: 'mead',
      cost: [3000, 8000, 16000, 30000, 50000], time: T.slice(1, 6), hp: HP(450).slice(0, 5),
      spellCap: [2, 3, 4, 5, 6],
      desc: 'The seeress brews spells. Each level adds spell space and a new spell.',
    },
    wolfden: {
      name: 'Wolf Den', size: 3, cat: 'army', res: 'mead',
      cost: [8000], time: [60], hp: [900],
      desc: 'Fenrir himself rests here. Upgrade him with runestone.',
    },
    arrow: {
      name: 'Arrow Tower', size: 3, cat: 'def', res: 'gold',
      cost: [300, 1000, 2500, 5500, 11000, 21000, 38000, 65000], time: T, hp: HP(380),
      dps: DPS(11), rate: 0.7, range: 10, air: true, ground: true,
      desc: 'Rapid single-target volleys. Hits ground and air.',
    },
    ballista: {
      name: 'Ballista', size: 3, cat: 'def', res: 'gold',
      cost: [250, 900, 2200, 5000, 10000, 19000, 35000, 60000], time: T, hp: HP(420),
      dps: DPS(15), rate: 1.2, range: 9, air: false, ground: true,
      desc: 'Heavy bolts that punch through a single ground target.',
    },
    catapult: {
      name: 'Catapult', size: 3, cat: 'def', res: 'gold',
      cost: [2500, 5000, 9000, 16000, 28000, 45000, 70000, 100000], time: T, hp: HP(400),
      dps: DPS(5.5), rate: 4, range: 11, min: 4, splash: 1.5, air: false, ground: true,
      desc: 'Lobs boulders at groups on the ground. Cannot hit anything too close.',
    },
    frost: {
      name: 'Frost Spire', size: 2, cat: 'def', res: 'gold',
      cost: [6000, 11000, 18000, 30000, 48000, 72000, 100000, 140000], time: T, hp: HP(350),
      dps: DPS(6), rate: 1, range: 7.5, slow: 0.5, slowT: 2.2, air: true, ground: true,
      desc: 'Freezing shards slow whatever they hit.',
    },
    storm: {
      name: 'Storm Totem', size: 2, cat: 'def', res: 'gold',
      cost: [12000, 20000, 32000, 50000, 75000, 105000, 140000, 180000], time: T, hp: HP(450),
      dps: DPS(11), rate: 1.3, range: 7, chain: 3, chainR: 2.4, air: true, ground: true,
      desc: 'Calls chain lightning that jumps between attackers.',
    },
    harpoon: {
      name: 'Sky Harpoon', size: 3, cat: 'def', res: 'gold',
      cost: [5000, 9000, 15000, 25000, 40000, 60000, 85000, 115000], time: T, hp: HP(500),
      dps: DPS(60), rate: 1, range: 10, air: true, ground: false,
      desc: 'Massive harpoons for anything with wings. Air only.',
    },
    runemine: {
      name: 'Rune Mine', size: 1, cat: 'trap', res: 'gold',
      cost: [400, 1200, 3000, 7000], time: [5, 10, 20, 40], hp: [1, 1, 1, 1],
      dmg: [30, 42, 56, 72], trigger: 1.2, splash: 1.6, air: false, ground: true,
      desc: 'Hidden rune that bursts when ground troops step near.',
    },
    pitfall: {
      name: 'Pitfall', size: 1, cat: 'trap', res: 'gold',
      cost: [2000, 4000, 8000, 15000], time: [5, 10, 20, 40], hp: [1, 1, 1, 1],
      dmg: [140, 190, 250, 320], trigger: 0.7, splash: 1.0, air: false, ground: true,
      desc: 'Concealed spike pit. Ground only.',
    },
    skysnare: {
      name: 'Sky Snare', size: 1, cat: 'trap', res: 'gold',
      cost: [4000, 8000, 14000, 22000], time: [5, 10, 20, 40], hp: [1, 1, 1, 1],
      dmg: [300, 400, 520, 660], trigger: 2.5, air: true, ground: false,
      desc: 'Hidden net-launcher that snares a flyer. Air only.',
    },
    wall: {
      name: 'Wall', size: 1, cat: 'wall', res: 'gold',
      cost: [50, 200, 800, 2500, 6000, 12000, 25000, 45000], time: [0, 0, 0, 0, 0, 0, 0, 0],
      hp: [300, 500, 800, 1200, 1800, 2600, 3600, 4800],
      desc: 'Blocks ground troops. Wood, then stone, iron and rune-etched.',
    },
  };

  // How many of each building a Great Hall level allows (index = hall level - 1)
  D.COUNT = {
    hall: [1, 1, 1, 1, 1, 1, 1, 1],
    builder: [5, 5, 5, 5, 5, 5, 5, 5],
    goldmint: [1, 2, 3, 4, 5, 6, 6, 7],
    meadbrew: [1, 2, 3, 4, 5, 6, 6, 7],
    rsdrill: [0, 0, 0, 1, 1, 2, 2, 3],
    goldvault: [1, 1, 2, 2, 3, 3, 4, 4],
    meadcellar: [1, 1, 2, 2, 3, 3, 4, 4],
    rsvault: [0, 0, 0, 1, 1, 1, 1, 1],
    barracks: [1, 2, 2, 3, 3, 3, 4, 4],
    camp: [1, 1, 2, 2, 3, 3, 4, 4],
    forge: [0, 1, 1, 1, 1, 1, 1, 1],
    seidr: [0, 0, 1, 1, 1, 1, 1, 1],
    wolfden: [0, 0, 0, 1, 1, 1, 1, 1],
    arrow: [1, 1, 2, 3, 4, 5, 5, 6],
    ballista: [2, 2, 2, 3, 3, 4, 5, 5],
    catapult: [0, 0, 1, 1, 2, 3, 3, 4],
    frost: [0, 0, 0, 1, 1, 2, 2, 3],
    storm: [0, 0, 0, 0, 1, 2, 2, 3],
    harpoon: [0, 0, 1, 1, 2, 2, 3, 3],
    runemine: [0, 2, 2, 4, 4, 6, 6, 6],
    pitfall: [0, 0, 1, 1, 2, 2, 3, 4],
    skysnare: [0, 0, 0, 1, 1, 2, 2, 3],
    wall: [0, 25, 50, 75, 100, 125, 175, 225],
  };
  // Max level of each building per Great Hall level
  D.MAXLV = {
    hall: [8, 8, 8, 8, 8, 8, 8, 8],
    builder: [1, 1, 1, 1, 1, 1, 1, 1],
    goldmint: [2, 4, 5, 6, 7, 8, 8, 8],
    meadbrew: [2, 4, 5, 6, 7, 8, 8, 8],
    rsdrill: [0, 0, 0, 3, 4, 6, 7, 8],
    goldvault: [2, 3, 4, 5, 6, 7, 8, 8],
    meadcellar: [2, 3, 4, 5, 6, 7, 8, 8],
    rsvault: [0, 0, 0, 2, 4, 5, 6, 8],
    barracks: [2, 4, 5, 6, 7, 8, 8, 8],
    camp: [2, 2, 3, 4, 5, 6, 7, 8],
    forge: [0, 2, 3, 4, 5, 6, 7, 8],
    seidr: [0, 0, 2, 3, 4, 5, 5, 5],
    wolfden: [0, 0, 0, 1, 1, 1, 1, 1],
    arrow: [2, 3, 4, 5, 6, 7, 8, 8],
    ballista: [2, 3, 4, 5, 6, 7, 8, 8],
    catapult: [0, 0, 2, 3, 4, 5, 6, 8],
    frost: [0, 0, 0, 2, 3, 4, 6, 8],
    storm: [0, 0, 0, 0, 2, 4, 6, 8],
    harpoon: [0, 0, 2, 3, 4, 5, 6, 8],
    runemine: [0, 2, 2, 3, 3, 4, 4, 4],
    pitfall: [0, 0, 2, 2, 3, 3, 4, 4],
    skysnare: [0, 0, 0, 2, 2, 3, 3, 4],
    wall: [0, 2, 3, 4, 5, 6, 7, 8],
  };
  D.SHOP = [
    { id: 'res', name: 'Economy', types: ['goldmint', 'meadbrew', 'rsdrill', 'goldvault', 'meadcellar', 'rsvault', 'builder'] },
    { id: 'army', name: 'Army', types: ['barracks', 'camp', 'forge', 'seidr', 'wolfden'] },
    { id: 'def', name: 'Defense', types: ['arrow', 'ballista', 'catapult', 'frost', 'storm', 'harpoon', 'wall'] },
    { id: 'trap', name: 'Traps', types: ['runemine', 'pitfall', 'skysnare'] },
  ];
  D.WALL_MATERIAL = ['Wood', 'Wood', 'Stone', 'Stone', 'Iron', 'Iron', 'Rune-etched', 'Rune-etched'];

  // ---------- obstacles ----------
  D.OBST = {
    pine: { name: 'Pine', size: 2, res: 'gold', cost: 120, time: 6, gems: [0, 4] },
    fir: { name: 'Snow Fir', size: 2, res: 'gold', cost: 160, time: 8, gems: [1, 5] },
    rock: { name: 'Boulder', size: 2, res: 'mead', cost: 200, time: 8, gems: [0, 4] },
    stone: { name: 'Mossy Stone', size: 1, res: 'mead', cost: 60, time: 4, gems: [0, 2] },
    bush: { name: 'Frost Bush', size: 1, res: 'gold', cost: 40, time: 3, gems: [0, 2] },
  };
  D.OBST_TYPES = ['pine', 'pine', 'fir', 'rock', 'stone', 'bush', 'bush'];

  // ---------- troops ----------
  // speed tiles/s, range tiles, hs = housing space. Stats arrays per troop level (1-5).
  D.TROOPS = {
    wolf: { name: 'Wolf', hs: 1, res: 'mead', cost: [25, 40, 60, 80, 100], time: 5, hp: [45, 54, 65, 78, 94], dps: [12, 14, 17, 20, 24], speed: 2.2, range: 0.6, pref: 'any', barracks: 1, desc: 'Cheap, quick melee. Attacks whatever is closest.' },
    huntress: { name: 'Huntress', hs: 1, res: 'mead', cost: [50, 80, 120, 160, 200], time: 6, hp: [22, 26, 31, 37, 44], dps: [10, 12, 15, 18, 22], speed: 2.4, range: 3.5, ranged: true, pref: 'any', barracks: 2, desc: 'Shoots over walls from range. Fragile.' },
    jotunn: { name: 'Jötunn', hs: 5, res: 'mead', cost: [250, 375, 500, 650, 800], time: 30, hp: [320, 380, 460, 550, 660], dps: [12, 15, 19, 23, 28], speed: 1.3, range: 1.0, pref: 'def', barracks: 3, desc: 'Frost giant tank. Only goes for defenses.' },
    sapper: { name: 'Sapper', hs: 2, res: 'mead', cost: [100, 150, 200, 250, 300], time: 15, hp: [22, 26, 31, 37, 44], dps: [240, 300, 360, 440, 520], speed: 3.0, range: 0.6, pref: 'wall', blast: 1.4, barracks: 4, desc: 'Runs at walls with a powder keg. Huge wall damage.' },
    raven: { name: 'Raven', hs: 2, res: 'mead', cost: [120, 170, 220, 280, 340], time: 12, hp: [70, 84, 100, 120, 145], dps: [14, 17, 20, 24, 29], speed: 2.6, range: 1.6, fly: true, pref: 'any', barracks: 5, desc: 'Cheap flyer. Ignores walls.' },
    berserker: { name: 'Berserker', hs: 4, res: 'mead', cost: [300, 400, 520, 650, 800], time: 25, hp: [180, 215, 260, 310, 370], dps: [34, 40, 48, 57, 68], speed: 2.8, range: 0.7, pref: 'any', barracks: 6, desc: 'Fast, furious, heavy melee damage.' },
    draugr: { name: 'Draugr', hs: 6, res: 'rs', cost: [40, 50, 60, 70, 80], time: 40, hp: [600, 700, 820, 950, 1100], dps: [20, 24, 28, 33, 38], speed: 1.2, range: 1.0, pref: 'any', barracks: 5, hall: 4, split: 2, desc: 'Runestone-bound undead. Splits into two lesser draugr when it falls.' },
    volva: { name: 'Völva', hs: 10, res: 'mead', cost: [800, 950, 1100, 1300, 1500], time: 60, hp: [450, 520, 600, 690, 790], dps: [35, 42, 50, 60, 70], speed: 2.0, range: 3.0, fly: true, healer: true, healR: 2.2, pref: 'heal', barracks: 7, desc: 'Flying seeress who heals ground troops. Never attacks.' },
    stormrider: { name: 'Storm Rider', hs: 6, res: 'mead', cost: [600, 720, 850, 1000, 1150], time: 45, hp: [240, 280, 330, 390, 460], dps: [36, 43, 51, 60, 70], speed: 1.8, range: 2.8, fly: true, splash: 1.2, pref: 'any', barracks: 8, desc: 'Rides the thunder. Air unit with splash damage.' },
    draugrling: { name: 'Lesser Draugr', hs: 0, hidden: true, hp: [180, 210, 246, 285, 330], dps: [9, 11, 13, 15, 17], speed: 1.5, range: 0.8, pref: 'any' },
  };
  D.TROOP_ORDER = ['wolf', 'huntress', 'jotunn', 'sapper', 'raven', 'berserker', 'draugr', 'volva', 'stormrider'];
  D.TROOP_MAXLV = 5;
  // Max troop/spell level allowed by Rune Forge level (index = forge level; 0 = no forge)
  D.FORGE_MAX = [1, 2, 3, 3, 4, 4, 5, 5, 5];
  // Research cost multipliers per target level (2..5) — base is troop cost[0] * factor
  D.RESEARCH = { costMul: [0, 0, 40, 110, 260, 520], time: [0, 0, 30, 90, 180, 320] };

  // ---------- spells ----------
  D.SPELLS = {
    lightning: { name: 'Lightning Strike', space: 1, res: 'mead', cost: 300, time: 20, seidr: 1, dmg: [150, 180, 215, 250, 290], radius: 1.6, bolts: 3, desc: 'Three bolts hammer buildings in a small area.' },
    heal: { name: 'Healing Spring', space: 1, res: 'mead', cost: 350, time: 25, seidr: 2, hps: [30, 40, 50, 60, 72], radius: 3, dur: 10, desc: 'A ring of spring water that heals troops standing in it.' },
    rage: { name: 'Rage Howl', space: 1, res: 'mead', cost: 400, time: 30, seidr: 3, boost: [1.3, 1.36, 1.42, 1.48, 1.55], radius: 3, dur: 10, desc: 'Troops inside move faster and hit harder.' },
    frostveil: { name: 'Frost Veil', space: 1, res: 'mead', cost: 450, time: 35, seidr: 4, dur: [4, 4.5, 5, 5.5, 6], radius: 3, desc: 'Freezes enemy defenses in the area.' },
  };
  D.SPELL_ORDER = ['lightning', 'heal', 'rage', 'frostveil'];

  // ---------- hero ----------
  D.HERO = {
    name: 'Fenrir',
    maxByHall: [0, 0, 0, 5, 8, 12, 16, 20],
    hp: (lv) => 1100 + 80 * (lv - 1),
    dps: (lv) => 55 + 6 * (lv - 1),
    cost: (lv) => Math.round(40 * Math.pow(lv, 1.55) / 5) * 5, // runestone to reach lv
    time: (lv) => Math.round(30 + 25 * (lv - 1) * Math.sqrt(lv)),
    regen: (lv) => 45 + 6 * lv,   // seconds for a full heal after battle
    speed: 2.2, range: 0.9,
    ability: { name: 'Unchained', heal: 0.4, dur: 6, boost: 1.6 },
    desc: 'The great wolf himself. Melee titan; trigger Unchained to heal and rage.',
  };

  // ---------- leagues ----------
  D.LEAGUES = [
    { name: 'Unranked', min: 0, col: '#7d8899' },
    { name: 'Bronze Wolf', min: 200, col: '#c98b5a' },
    { name: 'Silver Wolf', min: 500, col: '#c3ccd8' },
    { name: 'Gold Wolf', min: 900, col: '#ffcf8a' },
    { name: 'Rune Wolf', min: 1400, col: '#8a5cff' },
    { name: 'Frost Jarl', min: 2000, col: '#9af0ff' },
    { name: 'Ragnarök', min: 2800, col: '#ff3d71' },
  ];

  // ---------- achievements ----------
  D.ACH = [
    { id: 'hall', name: 'Hall of the Wolf', desc: 'Raise the Great Hall to level {n}', stat: 'hallLv', tiers: [3, 5, 8], gems: [10, 25, 60] },
    { id: 'wins', name: 'Pack Hunter', desc: 'Win {n} raids', stat: 'wins', tiers: [3, 20, 100], gems: [10, 25, 60] },
    { id: 'stars', name: 'Star Reader', desc: 'Earn {n} raid stars', stat: 'stars', tiers: [10, 60, 250], gems: [10, 20, 50] },
    { id: 'gold', name: 'Dragon Hoard', desc: 'Loot {n} gold', stat: 'lootGold', tiers: [5000, 100000, 1000000], gems: [5, 20, 50] },
    { id: 'mead', name: 'Mead of Poets', desc: 'Loot {n} mead', stat: 'lootMead', tiers: [5000, 100000, 1000000], gems: [5, 20, 50] },
    { id: 'clear', name: 'Woodcutter', desc: 'Clear {n} obstacles', stat: 'cleared', tiers: [3, 25, 80], gems: [5, 15, 40] },
    { id: 'walls', name: 'Shield Wall', desc: 'Place {n} wall segments', stat: 'walls', tiers: [20, 100, 225], gems: [5, 15, 40] },
    { id: 'defend', name: 'Unbroken', desc: 'Win {n} defenses', stat: 'defWins', tiers: [1, 10, 50], gems: [5, 20, 50] },
    { id: 'train', name: 'War Horn', desc: 'Train {n} housing of troops', stat: 'trained', tiers: [50, 600, 4000], gems: [5, 15, 40] },
    { id: 'hero', name: 'Unchained', desc: 'Raise Fenrir to level {n}', stat: 'heroLv', tiers: [1, 5, 10], gems: [10, 20, 40] },
  ];

  // ---------- names (original, Norse flavoured) ----------
  D.NAME_A = ['Hrafn', 'Ulf', 'Skog', 'Frost', 'Isen', 'Myrk', 'Stein', 'Bjorn', 'Eld', 'Grim', 'Vind', 'Svart', 'Kald', 'Jarn', 'Mani', 'Sol'];
  D.NAME_B = ['holt', 'heim', 'vik', 'garth', 'fell', 'stad', 'mark', 'by', 'ness', 'dal', 'haug', 'borg'];
  D.CHIEF = ['Jarl Ulfar', 'Sigrun', 'Hakon the Grey', 'Astrid', 'Eirik Coldhand', 'Thyra', 'Ragna', 'Orm', 'Gunnhild', 'Leif Ashbeard', 'Solveig', 'Brand', 'Halla', 'Vigdis', 'Ketil', 'Ylva'];

  // ---------- helpers ----------
  D.hallIdx = (h) => Math.max(0, Math.min(D.MAX_HALL, h) - 1);
  D.maxCount = (type, hall) => (D.COUNT[type] ? D.COUNT[type][D.hallIdx(hall)] : 0);
  D.maxLevel = (type, hall) => (D.MAXLV[type] ? D.MAXLV[type][D.hallIdx(hall)] : 1);
  D.levels = (type) => D.B[type].cost.length;
  // stat of building `type` at level `lv` (1-based)
  D.bv = (type, key, lv) => { const a = D.B[type][key]; if (!Array.isArray(a)) return a; return a[Math.max(0, Math.min(a.length - 1, lv - 1))]; };
  D.btime = (type, lv) => D.bv(type, 'time', lv) * D.TIME_SCALE;
  D.tv = (k, key, lv) => { const a = D.TROOPS[k][key]; if (!Array.isArray(a)) return a; return a[Math.max(0, Math.min(a.length - 1, lv - 1))]; };
  D.sv = (k, key, lv) => { const a = D.SPELLS[k][key]; if (!Array.isArray(a)) return a; return a[Math.max(0, Math.min(a.length - 1, lv - 1))]; };
  D.league = (tr) => { let L = D.LEAGUES[0]; for (const l of D.LEAGUES) if (tr >= l.min) L = l; return L; };
  D.researchCost = (k, lv) => {
    const t = D.TROOPS[k] || D.SPELLS[k];
    const base = D.TROOPS[k] ? t.cost[0] : t.cost / 5;
    const res = t.res === 'rs' ? 'rs' : 'mead';
    const mul = res === 'rs' ? D.RESEARCH.costMul[lv] / 8 : D.RESEARCH.costMul[lv];
    return { res, amt: Math.round(base * mul / 10) * 10 };
  };
  D.researchTime = (k, lv) => D.RESEARCH.time[lv] * D.TIME_SCALE * (D.SPELLS[k] ? 1.2 : 1);
})(window.FS = window.FS || {});
