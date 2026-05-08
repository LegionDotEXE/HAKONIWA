import boat from './boat.js';

const config = {
    type: Phaser.AUTO,
    parent: 'app',
    width: 960,
    height: 600,
    backgroundColor: '#000000',
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false },
    },
    scene: [boat]
};

new Phaser.Game(config);