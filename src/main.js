import boat from './boat.js';
import river from './river.js';

const config = {
    type: Phaser.AUTO,
    parent: 'app',
    width: 800,  // 960 before
    height: 600,
    backgroundColor: '#000000',
    pixelArt: true,
    physics: {
        default: 'matter',
        matter: {gravity: { y: 0}, debug: true }
    },
    // scene: [boat]
    scene: [river]
};

new Phaser.Game(config);