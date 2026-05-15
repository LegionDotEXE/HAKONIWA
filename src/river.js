import Boat from './new_boat.js';
import FishingSystem from './fishing.js';
import InventorySystem from './inventory.js';
import ShopSystem from './shop.js';
import WoodNodeSystem from './wood_nodes.js';


export default class River extends Phaser.Scene
{
    constructor()
    {
        super('River');
    }

    preload()
    {
        this.load.path = 'assets/';

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
                fish.failChance = 0.4;
            }
            if (fish.name === 'green_fish') {
                fish.play('greenFishJump');
                fish.catchTime = 700;
                fish.failChance = 0.15;
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

                if (objA === this.boat && bodyB.label === 'fish') {
                    this.canFish = true;
                    this.currentFish = objB;
                } else if (objB === this.boat && bodyA.label === 'fish') {
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
        this.woodNodes = new WoodNodeSystem(this, this.boat, map, collisionLayer);

        this.cameras.main.startFollow(this.boat, true, 0.1, 0.1);
        this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    }

    update()
    {
        if (this.boat)
        {
            this.boat.update();
        }

        if (this.fishing) {
            this.fishing.updateUI(this.canFish);
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
