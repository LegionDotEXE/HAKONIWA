// shop.js 
// Shop UI Layer


const SHOP_CATALOGUE = [
    {
        id: 'paddle_upgrade', name: 'Reinforced Paddles', icon: 'item_paddle',
        cost: 15, description: 'Increases stroke force +20%.',
        stackable: true, maxStack: 3,
        effect(scene) {
            scene.boat._strokeForceMultiplier =
                (scene.boat._strokeForceMultiplier || 1) + 0.2;
        },
    },
    {
        id: 'hull_repair', name: 'Hull Repair Kit', icon: 'item_hull',
        cost: 10, description: 'Restores 25 HP to the boat.',
        stackable: true, maxStack: 99,
        effect(scene) { scene.inventory.heal(25); },
    },
    {
        id: 'sail', name: 'River Sail', icon: 'item_sail',
        cost: 30, description: 'Adds passive current boost heading downstream.',
        stackable: false,
        effect(scene) { scene.boat._hasSail = true; },
    },
    {
        id: 'anchor', name: 'Quick Anchor', icon: 'item_anchor',
        cost: 20, description: 'Press [SPACE] to drop anchor and stop instantly.',
        stackable: false,
        effect(scene) {
            scene.boat._hasAnchor = true;
            const space = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
            space.on('down', () => {
                if (!scene.boat._hasAnchor) return;
                scene.boat._anchored = !scene.boat._anchored;
                if (scene.boat._anchored) {
                    scene.boat.setVelocity(0, 0);
                    scene.boat.setAngularVelocity(0);
                    scene.boat.setStatic(true);
                } else {
                    scene.boat.setStatic(false);
                }
            });
        },
    },
    {
        id: 'lucky_bait', name: 'Lucky Bait', icon: 'item_bait',
        cost: 8, description: 'Halves bite wait time for 3 casts.',
        stackable: true, maxStack: 99,
        effect(scene) {
            scene.fishing._baitCharges = (scene.fishing._baitCharges || 0) + 3;
        },
    },
];

export default class ShopSystem {
    constructor(scene, inventory) {
        this.scene     = scene;
        this.inventory = inventory;
        this.isOpen    = false;
        this.nearZone  = false;
        this._itemRows = [];
    }

    open()                {}
    close()               {}
    onGoldChanged(_gold)  {}
}