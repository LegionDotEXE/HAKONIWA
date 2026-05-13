// inventory.js  -- Inital Commit


export const RESOURCE_DEFS = [
    { id: 'coin', label: 'Coin', color: 0xf7c948, value: 1, shape: 'circle' },
    { id: 'gem',  label: 'Gem',  color: 0x48c8f7, value: 5, shape: 'circle' },
    { id: 'log',  label: 'Log',  color: 0x8b5a2b, value: 3, shape: 'rect'   },
];

export default class InventorySystem {
    constructor(scene, boat, fishing) {
        this.scene   = scene;
        this.boat    = boat;
        this.fishing = fishing;

        this.gold  = 0;
        this.hp    = 100;
        this.owned = {};

        this._pickups    = [];
        this._notifQueue = [];
        this._notifBusy  = false;
    }

    addGold(amount)   { this.gold += amount; }
    spendGold(amount) { this.gold -= amount; }
    damage(amount)    { this.hp = Math.max(0, this.hp - amount); }
    heal(amount)      { this.hp = Math.min(100, this.hp + amount); }
    onStroke()        {}
    notify()          {}
    update()          {}
}