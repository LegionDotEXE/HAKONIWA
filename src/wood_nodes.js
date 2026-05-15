const WOOD_NODE_COUNT = 20;
const COLLECT_DISTANCE = 28;
const RESPAWN_MIN_MS = 2500;
const RESPAWN_MAX_MS = 5000;
const LIFETIME_MIN_MS = 20000;
const LIFETIME_MAX_MS = 30000;
const DRIFT_SPEED_MIN = 3;
const DRIFT_SPEED_MAX = 8;

export default class WoodNodeSystem {
    constructor(scene, boat, inventory, map, collisionLayer) {
        this.scene = scene;
        this.boat = boat;
        this.inventory = inventory;
        this.map = map;
        this.collisionLayer = collisionLayer;

        this.wood = 0;
        this.nodes = [];
        this.waterTiles = this._findReachableWaterTiles();

        this._counter = scene.add.text(12, 86, 'Wood: 0', {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.45)',
            padding: { x: 8, y: 4 },
        }).setDepth(20).setScrollFactor(0);

        for (let i = 0; i < WOOD_NODE_COUNT; i++) {
            this._spawnNode();
        }
    }

    update() {
        const deltaSeconds = this.scene.game.loop.delta / 1000;

        for (const node of this.nodes) {
            if (!node.active) {
                continue;
            }

            node.sprite.x += node.velocityX * deltaSeconds;
            node.sprite.y += node.velocityY * deltaSeconds;

            if (!this._canWoodFloatAt(node.sprite.x, node.sprite.y) ||
                this.scene.time.now >= node.expiresAt) {
                this._despawnNode(node);
                continue;
            }

            const distance = Phaser.Math.Distance.Between(
                this.boat.x,
                this.boat.y,
                node.sprite.x,
                node.sprite.y
            );

            if (distance <= COLLECT_DISTANCE) {
                this._collectNode(node);
            }
        }
    }

    _spawnNode() {
        const position = this._getRandomWaterPosition();
        if (!position) {
            return;
        }

        const sprite = this._makeWoodSprite(position.x, position.y);
        const node = { sprite, active: true };
        this.nodes.push(node);
        this._resetNode(node, position);
    }

    _collectNode(node) {
        this._despawnNode(node);

        const amount = Phaser.Math.Between(4, 8);
        this.wood += amount;
        this._counter.setText(`Wood: ${this.wood}`);

        if (this.inventory) {
            this.inventory.heal(amount);
        }
    }

    _makeWoodSprite(x, y) {
        const sprite = this.scene.add.container(x, y);
        let visual;

        if (this.scene.textures.exists('wood')) {
            visual = this.scene.add.image(0, 0, 'wood');
            sprite.add(visual);
        } else {
            const shadow = this.scene.add.ellipse(0, 5, 23, 7, 0x000000, 0.18);
            const body = this.scene.add.ellipse(0, 0, 24, 10, 0x8b5a2b);
            const darkEnd = this.scene.add.ellipse(9, 0, 5, 9, 0x5e381a);
            const highlight = this.scene.add.rectangle(-3, -2, 12, 2, 0xc99459);
            visual = this.scene.add.container(0, 0, [shadow, body, darkEnd, highlight]);
            sprite.add(visual);
        }

        sprite.woodVisual = visual;
        sprite.setDepth(5);
        this._startBobbing(sprite);
        return sprite;
    }

    _startBobbing(sprite) {
        this.scene.tweens.killTweensOf(sprite.woodVisual);
        sprite.woodVisual.y = 0;
        this.scene.tweens.add({
            targets: sprite.woodVisual,
            y: 3,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });
    }

    _getRandomWaterPosition() {
        if (this.waterTiles.length === 0) {
            return null;
        }

        const tile = Phaser.Utils.Array.GetRandom(this.waterTiles);
        const tileWidth = this.map.tileWidth;
        const tileHeight = this.map.tileHeight;

        return {
            x: tile.x * tileWidth + Phaser.Math.Between(8, tileWidth - 8),
            y: tile.y * tileHeight + Phaser.Math.Between(8, tileHeight - 8),
        };
    }

    _resetNode(node, position) {
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const speed = Phaser.Math.FloatBetween(DRIFT_SPEED_MIN, DRIFT_SPEED_MAX);

        node.active = true;
        node.velocityX = Math.cos(angle) * speed;
        node.velocityY = Math.sin(angle) * speed;
        node.expiresAt = this.scene.time.now + Phaser.Math.Between(LIFETIME_MIN_MS, LIFETIME_MAX_MS);

        node.sprite.setPosition(position.x, position.y);
        node.sprite.setAlpha(0);
        node.sprite.setVisible(true);
        this._startBobbing(node.sprite);
        this.scene.tweens.add({
            targets: node.sprite,
            alpha: 1,
            duration: 500,
        });
    }

    _despawnNode(node) {
        if (!node.active) {
            return;
        }

        node.active = false;
        this.scene.tweens.killTweensOf(node.sprite.woodVisual);
        this.scene.tweens.add({
            targets: node.sprite,
            alpha: 0,
            duration: 350,
            onComplete: () => {
                node.sprite.setVisible(false);

                const delay = Phaser.Math.Between(RESPAWN_MIN_MS, RESPAWN_MAX_MS);
                this.scene.time.delayedCall(delay, () => {
                    const position = this._getRandomWaterPosition();
                    if (position) {
                        this._resetNode(node, position);
                    }
                });
            },
        });
    }

    _findReachableWaterTiles() {
        const startX = this.map.worldToTileX(this.boat.x);
        const startY = this.map.worldToTileY(this.boat.y);
        const queue = [{ x: startX, y: startY }];
        const visited = new Set();
        const reachable = [];

        while (queue.length > 0) {
            const tile = queue.shift();
            const key = `${tile.x},${tile.y}`;

            if (visited.has(key) || !this._canBoatTravelThrough(tile.x, tile.y)) {
                continue;
            }

            visited.add(key);
            reachable.push(tile);

            queue.push(
                { x: tile.x + 1, y: tile.y },
                { x: tile.x - 1, y: tile.y },
                { x: tile.x, y: tile.y + 1 },
                { x: tile.x, y: tile.y - 1 }
            );
        }

        return reachable;
    }

    _canBoatTravelThrough(tileX, tileY) {
        if (tileX < 0 || tileX >= this.map.width || tileY < 0 || tileY >= this.map.height) {
            return false;
        }

        const tile = this.collisionLayer.getTileAt(tileX, tileY);
        return !tile || tile.collides !== true;
    }

    _canWoodFloatAt(x, y) {
        const tileX = this.map.worldToTileX(x);
        const tileY = this.map.worldToTileY(y);
        return this._canBoatTravelThrough(tileX, tileY);
    }
}
