import Boat from './new_boat.js';
import FishingSystem from './fishing.js';

export default class River extends Phaser.Scene
{
    constructor()
    {
        super('River');
    }

    preload()
    {
        this.load.path = './assets/';

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
        this.load.image('tilesetImage', 'riverTileset.png');
        this.load.tilemapTiledJSON('tilemapJSON', 'river_tilemap.json');
    }

    create()
    {
        const map = this.add.tilemap('tilemapJSON');
        const tileset = map.addTilesetImage('tileset', 'tilesetImage');
        const backgroundLayer = map.createLayer('Base Layer', tileset, 0, 0);
        const collisionLayer = map.createLayer('Collision Layer', tileset, 0, 0)
        const decorationLayer = map.createLayer('Decoration Layer', tileset, 0, 0);

        collisionLayer.setCollisionByProperty({ collides: true });
        this.matter.world.convertTilemapLayer(collisionLayer);
        this.matter.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

        const boatSpawn = map.findObject('Spawns', (obj) => obj.name === 'boatSpawn');
        this.boat = new Boat(this.matter.world, boatSpawn.x, boatSpawn.y, 'boat', 'leftPaddle', 'rightPaddle');
        this.fishing = new FishingSystem(this, this.boat);

        this.cameras.main.startFollow(this.boat, true, 0.1, 0.1);
        this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    }

    update()
    {
        if (this.boat)
        {
            this.boat.update();
        }
    }
}