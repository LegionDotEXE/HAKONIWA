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
        this.boat = this.matter.add.sprite(boatSpawn.x, boatSpawn.y, 'boat', 0);

        this.cameras.main.startFollow(this.boat, true, 0.1, 0.1);
        this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    }
}