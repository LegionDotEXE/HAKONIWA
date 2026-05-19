const WOOD_NODE_COUNT = 20;
const COLLECT_DISTANCE = 28;
const RESPAWN_MIN_MS = 2500;
const RESPAWN_MAX_MS = 5000;
const LIFETIME_MIN_MS = 20000;
const LIFETIME_MAX_MS = 30000;
const DRIFT_SPEED_MIN = 3;
const DRIFT_SPEED_MAX = 8;
const WOOD_IMAGE_SIZE = 30;
const WOOD_COLLECT_ICON_SIZE = 18;

export default class WoodNodeSystem {
    constructor(scene, boat, map, collisionLayer) {
        this.scene = scene;
        this.boat = boat;
        this.map = map;
        this.collisionLayer = collisionLayer;

        this.wood = 0;
        this.nodes = [];
        this.waterTiles = this._findReachableWaterTiles();
        this._woodPointerShown = false;
        this._woodPointerDismissed = false;
        this._woodPointer = null;

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
        const sourceX = node.sprite.x;
        const sourceY = node.sprite.y;
        const amount = Phaser.Math.Between(4, 8);

        this._despawnNode(node);
        this._playCollectBurst(sourceX, sourceY, amount);
    }

    _addWood(amount) {
        this.wood += amount;
        this._counter.setText(`Wood: ${this.wood}`);

        if (!this._woodPointerShown && !this._woodPointerDismissed) {
            this._showWoodPointer();
        }
    }

    _makeWoodSprite(x, y) {
        const sprite = this.scene.add.container(x, y);
        let visual;

        if (this.scene.textures.exists('wood')) {
            visual = this.scene.add.image(0, 0, 'wood');
            visual.setDisplaySize(WOOD_IMAGE_SIZE, WOOD_IMAGE_SIZE);
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

    _showWoodPointer() {
        this._woodPointerShown = true;

        const bounds = this._counter.getBounds();
        const pointer = this.scene.add.container(bounds.right + 18, bounds.centerY)
            .setDepth(21)
            .setScrollFactor(0);
        this._woodPointer = pointer;

        const triangle = this.scene.add.graphics();
        triangle.fillStyle(0xfff0a0, 1);
        triangle.lineStyle(2, 0x5a3b08, 1);
        triangle.fillTriangle(0, 0, 18, -10, 18, 10);
        triangle.strokeTriangle(0, 0, 18, -10, 18, 10);

        const hitbox = this.scene.add.rectangle(9, 0, 30, 28, 0xffffff, 0)
            .setInteractive({ useHandCursor: true });

        pointer.add([triangle, hitbox]);
        pointer.setSize(30, 28);

        hitbox.on('pointerdown', () => {
            this.dismissWoodPointer();
        });

        this.scene.tweens.add({
            targets: pointer,
            x: pointer.x + 8,
            duration: 650,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });
    }

    dismissWoodPointer() {
        if (!this._woodPointer) {
            return;
        }

        this._woodPointerDismissed = true;
        this.scene.tweens.killTweensOf(this._woodPointer);
        this._woodPointer.destroy();
        this._woodPointer = null;
    }

    _playCollectBurst(worldX, worldY, amount) {
        const camera = this.scene.cameras.main;
        const startX = worldX - camera.scrollX;
        const startY = worldY - camera.scrollY;
        const target = this._getCounterTarget();

        for (let i = 0; i < amount; i++) {
            this.scene.time.delayedCall(i * 55, () => {
                const icon = this._makeCollectIcon(
                    startX + Phaser.Math.Between(-5, 5),
                    startY + Phaser.Math.Between(-4, 4)
                );

                this.scene.tweens.add({
                    targets: icon,
                    y: icon.y - Phaser.Math.Between(12, 20),
                    scaleX: 1.25,
                    scaleY: 1.25,
                    duration: 130,
                    ease: 'Quad.easeOut',
                    onComplete: () => {
                        this.scene.tweens.add({
                            targets: icon,
                            x: target.x,
                            y: target.y,
                            scaleX: 0.3,
                            scaleY: 0.3,
                            alpha: 0,
                            duration: 430,
                            ease: 'Quad.easeIn',
                            onComplete: () => {
                                icon.destroy();
                                this._addWood(1);
                                this.scene.tweens.add({
                                    targets: this._counter,
                                    scaleX: 1.08,
                                    scaleY: 1.08,
                                    duration: 60,
                                    yoyo: true,
                                    ease: 'Sine.easeOut',
                                });
                            },
                        });
                    },
                });
            });
        }
    }

    _makeCollectIcon(x, y) {
        const icon = this.scene.add.container(x, y)
            .setDepth(50)
            .setScrollFactor(0);

        if (this.scene.textures.exists('wood')) {
            const image = this.scene.add.image(0, 0, 'wood');
            image.setDisplaySize(WOOD_COLLECT_ICON_SIZE, WOOD_COLLECT_ICON_SIZE);
            icon.add(image);
        } else {
            const shadow = this.scene.add.ellipse(0, 4, 14, 4, 0x000000, 0.18);
            const body = this.scene.add.ellipse(0, 0, 16, 7, 0x8b5a2b);
            const darkEnd = this.scene.add.ellipse(6, 0, 3, 6, 0x5e381a);
            const highlight = this.scene.add.rectangle(-2, -1, 8, 1, 0xc99459);
            icon.add([shadow, body, darkEnd, highlight]);
        }

        return icon;
    }

    _getCounterTarget() {
        const bounds = this._counter.getBounds();
        return {
            x: bounds.centerX,
            y: bounds.centerY,
        };
    }
}
