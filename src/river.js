import Boat from './new_boat.js';
import FishingSystem from './fishing.js';
import InventorySystem from './inventory.js';
import ShopSystem from './shop.js';
import WoodNodeSystem from './wood_nodes.js';
//Current variables (TWEAK FORCE this is a testing value)
const CURRENT_FORCE    = 0.1;  
const CURRENT_TURN     = 0.004;  
 
const CURRENT_DIRS = {
    'up':         {  x:  0, y: -1 },
    'down':       {  x:  0, y:  1 },
    'left':       {  x: -1, y:  0 },
    'right':      {  x:  1, y:  0 },
    'left-up':    {  x: -0.707, y: -0.707 },
    'left-down':  {  x: -0.707, y:  0.707 },
    'right-up':   {  x:  0.707, y: -0.707 },
    'right-down': {  x:  0.707, y:  0.707 },
};



export default class River extends Phaser.Scene
{
    constructor()
    {
        super('River');
    }

    preload()
    {
        this.load.path = 'assets/';

        this.load.audio('bgm', 'game_bgm.mp3');

        this.load.image('boat', 'boat.png');
        this.load.spritesheet('leftPaddle', 'left_paddle.png', {
            frameWidth: 32,
            frameHeight: 40
        });
        this.load.spritesheet('rightPaddle', 'right_paddle.png', {
            frameWidth: 32,
            frameHeight: 40
        });

        // river tilemap
        this.load.spritesheet('tilesetImage', 'riverTileset.png', { frameWidth: 32, frameHeight: 32});
        this.load.tilemapTiledJSON('tilemapJSON', 'river_tilemap.json');

        this.load.image('coin', 'coin.png')
        this.load.image('wood', 'wood.png');
    }

    create()
    {
        if (!this.sound.get('bgm')) {
            this.sound.add('bgm').play({ loop: true, volume: 0.1 });
        }
        const map = this.add.tilemap('tilemapJSON');
        const tileset = map.addTilesetImage('tileset', 'tilesetImage');
        const backgroundLayer = map.createLayer('Base Layer', tileset, 0, 0);
        const collisionLayer = map.createLayer('Collision Layer', tileset, 0, 0);
        const decorationLayer = map.createLayer('Decoration Layer', tileset, 0, 0);

        collisionLayer.setCollisionByProperty({ collides: true });
        this.matter.world.convertTilemapLayer(collisionLayer);
        this.matter.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

        this.riverGrasses = [
            ...map.createFromObjects('River Grasses', { name: 'river_grass1', frame: 82 }),
            ...map.createFromObjects('River Grasses', { name: 'river_grass2', frame: 83 })
        ]

        this.riverCurrents = [
            ...map.createFromObjects('Currents', { name: 'up', frame: 5 }),
            ...map.createFromObjects('Currents', { name: 'down', frame: 37 }),
            ...map.createFromObjects('Currents', { name: 'left', frame: 20 }),
            ...map.createFromObjects('Currents', { name: 'right', frame: 22 }),
            ...map.createFromObjects('Currents', { name: 'left-up', frame: 4 }),
            ...map.createFromObjects('Currents', { name: 'left-down', frame: 36 }),
            ...map.createFromObjects('Currents', { name: 'right-up', frame: 6 }),
            ...map.createFromObjects('Currents', { name: 'right-down', frame: 38 })
        ]

        this._currentZones = this.riverCurrents.map(obj => {
            const dir = CURRENT_DIRS[obj.name] ?? { x: 0, y: 0 };
            return {
                x:           obj.x + (obj.width  ?? 32) / 2,
                y:           obj.y + (obj.height ?? 32) / 2,
                hw:          (obj.width  ?? 32) / 2,
                hh:          (obj.height ?? 32) / 2,
                dir,
                targetAngle: Math.atan2(dir.y, dir.x) + Math.PI / 2,
            };
        });

        // fish tile with two type of fish
        this.anims.create({
            key: 'redFishJump',
            frameRate: 6,
            repeat: -1,
            frames: this.anims.generateFrameNumbers('tilesetImage', {
                start: 96,
                end: 113
            })
        });
        this.anims.create({
            key: 'greenFishJump',
            frameRate: 6,
            repeat: -1,
            frames: this.anims.generateFrameNumbers('tilesetImage', {
                start: 114,
                end: 131
            })
        });

        this.fishes = [
            ...map.createFromObjects('Fishes', {
                name: 'red_fish',
                key: 'tilesetImage',
                frame: 96
            }),
            ...map.createFromObjects('Fishes', {
                name: 'green_fish',
                key: 'tilesetImage',
                frame: 114
            })
        ];

        this.fishes.forEach(fish => {
            this.matter.add.gameObject(fish, {
                isStatic: true,
                isSensor: true,
                label: 'fish',
                shape: { type: 'rectangle', width: 64, height: 64 }
            });

            if (fish.name === 'red_fish') {
                fish.play('redFishJump');
                fish.catchTime = 2500;
                fish.delayTime = 25000;
            }
            if (fish.name === 'green_fish') {
                fish.play('greenFishJump');
                fish.catchTime = 700;
                fish.delayTime = 10000;
            }
        });

        // fish-boat overlap detection
        this.canFish = false;
        this.currentFish = null;

        this.matter.world.on('collisionstart', (event) => {
            event.pairs.forEach((pair) => {
                const { bodyA, bodyB } = pair;
                const objA = bodyA.gameObject;
                const objB = bodyB.gameObject;

                if (objA === this.boat && bodyB.label === 'fish' && !objB.isCoolingDown) {
                    this.canFish = true;
                    this.currentFish = objB;
                } else if (objB === this.boat && bodyA.label === 'fish' && !objA.isCoolingDown) {
                    this.canFish = true;
                    this.currentFish = objA;
                }
            });
        });
        this.matter.world.on('collisionend', (event) => {
            event.pairs.forEach((pair) => {
                const { bodyA, bodyB } = pair;
                const objA = bodyA.gameObject;
                const objB = bodyB.gameObject;

                if ((objA === this.boat && bodyB.label === 'fish') ||
                    (objB === this.boat && bodyA.label === 'fish')) {
                    this.canFish = false;
                    this.currentFish = null;

                    if (this.fishing.fishing) {
                        this.fishing.cancelFishing(); 
                    }
                }
            });
        });

        const boatSpawn = map.findObject('Spawns', (obj) => obj.name === 'boatSpawn');
        this.boat = new Boat(this.matter.world, boatSpawn.x, boatSpawn.y, 'boat', 'leftPaddle', 'rightPaddle');
        this.fishing = new FishingSystem(this, this.boat);

        // Inventory and Shop
        //this.inventory = new InventorySystem(this, this.boat, this.fishing);
        this.inventory = new InventorySystem(this, this.boat, this.fishing, map, collisionLayer);
        this.shop = new ShopSystem(this, this.inventory);
        this.woodNodes = new WoodNodeSystem(this, this.boat, this.inventory, map, collisionLayer);

        this.cameras.main.startFollow(this.boat, true, 0.1, 0.1);
        this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    }

        _applyCurrents()
    {
        const bx = this.boat.x;
        const by = this.boat.y;
 
        for (const zone of this._currentZones) {
            if (Math.abs(bx - zone.x) > zone.hw) continue;
            if (Math.abs(by - zone.y) > zone.hh) continue;
 
            this.boat.applyForce({ x: zone.dir.x * CURRENT_FORCE, y: zone.dir.y * CURRENT_FORCE });
 
            let angleDiff = zone.targetAngle - this.boat.rotation;
            while (angleDiff >  Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            this.boat.setAngularVelocity(
                this.boat.body.angularVelocity + angleDiff * CURRENT_TURN
            );
 
            break; 
        }
    }

    update()
    {
        if (this.boat)
        {
            this.boat.update();
            this._applyCurrents();
        }

        if (this.fishing) {
            const actualCanFish = this.canFish && !(this.currentFish?.isCoolingDown);
            this.fishing.updateUI(actualCanFish);
        }
        // coins proximity check and colleciton
        if (this.inventory)
        {
            this.inventory.update();
        }

        if (this.woodNodes)
        {
            this.woodNodes.update();
        }
    }
}
