// inventory.js  –  Data / State Layer

const HP_MAX    = 100;
const HUD_DEPTH = 30;

const COIN_SPAWN_INTERVAL = 20000;   
const COIN_BATCH_SIZE     = 2;     
const COIN_MAX_LIVE       = 5;       
const COIN_SEARCH_TRIES   = 60;      
const COIN_SPAWN_RADIUS   = 350;     
const COIN_MIN_RADIUS     = 120;     
const PICKUP_RADIUS       = 40;      

const COIN_WORLD_SIZE = 20;
const COIN_BURST_SIZE = 10;
const COIN_GHOST_SIZE = 14;
const COIN_HUD_SIZE   = 20;



function makeCoin(scene, x, y, size, depth) {
    if (scene.textures.exists('coin') &&
        scene.textures.get('coin').key !== '__MISSING') {
        return scene.add.image(x, y, 'coin')
            .setDisplaySize(size, size)
            .setDepth(depth);
    }
    return scene.add.circle(x, y, size / 2, 0xf7c948)
        .setStrokeStyle(2, 0xc8922a)
        .setDepth(depth);
}

export default class InventorySystem {

    constructor(scene, boat, fishing, map, collisionLayer) {
        this.scene           = scene;
        this.boat            = boat;
        this.fishing         = fishing;
        this._map            = map;
        this._collisionLayer = collisionLayer;

        this.gold  = 0;
        this.hp    = HP_MAX;
        this.owned = {};

        this._pickups    = [];
        this._notifQueue = [];
        this._notifBusy  = false;

        this._buildHUD();
        this._startCoinSpawner();
        this._hookFishing();
    }

    _buildHUD() {
        const scene = this.scene;
        const cam   = scene.cameras.main;

        const iconCx = cam.width - 8 - COIN_HUD_SIZE / 2;
        const textX  = iconCx - COIN_HUD_SIZE / 2 - 6;
        const rowY   = 18;

        // HUD coin icon
        if (scene.textures.exists('coin') &&
            scene.textures.get('coin').key !== '__MISSING') {
            this._goldIcon = scene.add.image(iconCx, rowY, 'coin')
                .setDisplaySize(COIN_HUD_SIZE, COIN_HUD_SIZE)
                .setOrigin(0.5)
                .setDepth(HUD_DEPTH)
                .setScrollFactor(0);
        } else {
            this._goldIcon = scene.add.circle(iconCx, rowY, COIN_HUD_SIZE / 2, 0xf7c948)
                .setStrokeStyle(2, 0xc8922a)
                .setDepth(HUD_DEPTH)
                .setScrollFactor(0);
        }

        // Gold number 
        this._goldText = scene.add.text(textX, rowY, '0', {
            fontFamily: 'monospace',
            fontSize:   '15px',
            color:      '#f7c948',
            stroke:     '#000000',
            strokeThickness: 3,
        }).setOrigin(1, 0.5).setDepth(HUD_DEPTH).setScrollFactor(0);

        // HP bar 
        this._hpBarBg = scene.add.rectangle(12, 45, 120, 12, 0x550000)
            .setOrigin(0, 0.5).setDepth(HUD_DEPTH).setScrollFactor(0);

        this._hpBar = scene.add.rectangle(12, 45, 120, 12, 0xff3333)
            .setOrigin(0, 0.5).setDepth(HUD_DEPTH).setScrollFactor(0);

        this._hpText = scene.add.text(138, 45, `HP ${HP_MAX}`, {
            fontFamily: 'monospace',
            fontSize:   '11px',
            color:      '#ffffff',
        }).setOrigin(0, 0.5).setDepth(HUD_DEPTH).setScrollFactor(0);

        // Full-screen red flash
        this._damageFlash = scene.add.rectangle(
            cam.width / 2, cam.height / 2,
            cam.width, cam.height,
            0xff0000, 0
        ).setDepth(HUD_DEPTH - 1).setScrollFactor(0);

        // Toast notification
        this._notifText = scene.add.text(cam.width / 2, 46, '', {
            fontFamily: 'monospace',
            fontSize:   '13px',
            color:      '#ffffff',
            stroke:     '#000000',
            strokeThickness: 3,
            backgroundColor: 'rgba(0,0,0,0.55)',
            padding:    { x: 10, y: 4 },
        }).setOrigin(0.5, 0).setDepth(HUD_DEPTH).setScrollFactor(0).setAlpha(0);
    }

    // Gold Management
    addGold(amount) {
        this.gold += amount;
        this._goldText.setText(String(this.gold));
        // pop tween on the number only
        this.scene.tweens.add({
            targets:  this._goldText,
            scaleX:   1.3, scaleY: 1.3,
            duration: 80, yoyo: true, ease: 'Sine.easeOut',
        });
        if (this.scene.shop) this.scene.shop.onGoldChanged(this.gold);
    }

    spendGold(amount) {
        this.gold -= amount;
        this._goldText.setText(String(this.gold));
        if (this.scene.shop) this.scene.shop.onGoldChanged(this.gold);
    }

    // // HP Management
    // damage(amount) {
    //     this.hp = Math.max(0, this.hp - amount);
    //     this._refreshHP();
    //     this.scene.tweens.add({
    //         targets:  this._damageFlash,
    //         alpha:    0.35,
    //         duration: 60,
    //         yoyo:     true,
    //         onComplete: () => this._damageFlash.setAlpha(0),
    //     });
    //     if (this.hp <= 0) this._onBoatDestroyed();
    // }

    heal(amount) {
        this.hp = Math.min(HP_MAX, this.hp + amount);
        this._refreshHP();
        this.notify(`+${amount} HP ❤️`, '#55ff55');
    }

    _refreshHP() {
        const pct = this.hp / HP_MAX;
        this._hpBar.setDisplaySize(120 * pct, 10);
        const col = pct > 0.6 ? 0x44ff44 : pct > 0.3 ? 0xffaa00 : 0xff2222;
        this._hpBar.setFillStyle(col);
        this._hpText.setText(`HP ${this.hp}`);
    }

    _onBoatDestroyed() {
        this.notify('💀 BOAT DESTROYED!', '#ff3333');
        // this.scene.time.delayedCall(1500, () => this.scene.scene.start('GameOver'));
    }

    // Stroke callback
    onStroke() {}

    // Fishing callback hook 
    _hookFishing() {
        const fs = this.fishing;
        if (!fs) return;
        const _originalEnd = fs._end.bind(fs);
        fs._end = (caught) => {
            _originalEnd(caught);      
            if (caught === true) {
                this.addGold(3);
                this.notify('+3  🪙  Nice catch!', '#55ccff');
            }
            if ((fs._baitCharges || 0) > 0) {
                fs._baitCharges--;
                if (fs._baitCharges === 0)
                    this.notify('Lucky Bait used up!', '#ffaa55');
            }
        };
    }

    //  water tile check
_isWater(wx, wy) {
    if (!this._collisionLayer || !this._map) return true;
    
    // only check within map boundaries
    if (wx < 0 || wx > this._map.widthInPixels || wy < 0 || wy > this._map.heightInPixels) {
        return false;
    }

    const tile = this._collisionLayer.getTileAtWorldXY(wx, wy);
    if (!tile) return true; // No tile data = open water

    return tile.collides !== true;
}

    // Coin spawning logic
    _startCoinSpawner() {
        this.scene.time.addEvent({
            delay:         COIN_SPAWN_INTERVAL,
            loop:          true,
            callback:      this._spawnBatch,
            callbackScope: this,
        });
    }

    _spawnBatch() {
        const slots = COIN_MAX_LIVE - this._pickups.length;
        if (slots <= 0) return;
        const n = Math.min(COIN_BATCH_SIZE, slots);
        for (let i = 0; i < n; i++) {
            const pos = this._findWaterPosition();
            if (pos) this._createCoin(pos.x, pos.y);
        }
    }

    _findWaterPosition() {
        const bx = this.boat ? this.boat.x : 400;
        const by = this.boat ? this.boat.y : 300;
        for (let t = 0; t < COIN_SEARCH_TRIES; t++) {
            const angle  = Math.random() * Math.PI * 2;
            const radius = COIN_MIN_RADIUS +
                           Math.random() * (COIN_SPAWN_RADIUS - COIN_MIN_RADIUS);
            const cx = bx + Math.cos(angle) * radius;
            const cy = by + Math.sin(angle) * radius;
            if (this._isWater(cx, cy)) return { x: cx, y: cy };
        }
        return null;
    }

    _createCoin(x, y) {
        const scene = this.scene;

        const obj = makeCoin(scene, x, y, COIN_WORLD_SIZE, 5);

        const bobTween = scene.tweens.add({
            targets:  obj,
            y:        y - 5,
            duration: 900 + Math.random() * 400,
            yoyo:     true, repeat: -1,
            ease:     'Sine.easeInOut',
        });

        // spin
        const spinTween = scene.tweens.add({
            targets:  obj,
            angle:    360,
            duration: 2400 + Math.random() * 800,
            repeat:   -1,
            ease:     'Linear',
        });

        // "+1" label fades in when nearby
        const label = scene.add.text(x, y - 18, '+1', {
            fontFamily: 'monospace', fontSize: '11px',
            color: '#f7c948', stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5, 1).setDepth(6).setAlpha(0);

        this._pickups.push({ obj, label, bobTween, spinTween, collected: false });
    }

    // proximity check for boat and coins
    // called from river.js update() every frame
    _checkPickups() {
        if (!this.boat) return;
        const bx = this.boat.x;
        const by = this.boat.y;

        this._pickups.forEach(p => {
            if (p.collected) return;

            const dx = p.obj.x - bx;
            const dy = p.obj.y - by;
            const d  = Math.sqrt(dx * dx + dy * dy);

            // fade in "+1" when close
            p.label.setAlpha(d < 80 ? 1 : 0);

            if (d < PICKUP_RADIUS) {
                p.collected = true;     
                this._collectCoin(p);
            }
        });
        this._pickups = this._pickups.filter(p => !p.collected);
    }

    _collectCoin(p) {
        const scene = this.scene;
        const cam   = scene.cameras.main;

        const x = p.obj.x;
        const y = p.obj.y;

        p.bobTween.stop();
        p.spinTween.stop();

        p.obj.destroy();
        p.label.destroy();

        this._burstCoins(x, y);

        const ghost = makeCoin(scene, x, y, COIN_GHOST_SIZE, 21);
        const hudX  = cam.scrollX + cam.width - 8 - COIN_HUD_SIZE / 2;
        const hudY  = cam.scrollY + 18;

        scene.tweens.add({
            targets:  ghost,
            x:        hudX,
            y:        hudY,
            scaleX:   0.2, scaleY: 0.2,
            alpha:    0,
            duration: 450,
            ease:     'Quad.easeIn',
            onComplete: () => ghost.destroy(),
        });

        scene.time.delayedCall(250, () => this.addGold(1));
    }

    _burstCoins(x, y) {
        const scene = this.scene;
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const dist  = 18 + Math.random() * 12;
            const dot   = makeCoin(scene, x, y, COIN_BURST_SIZE, 20);
            scene.tweens.add({
                targets:  dot,
                x:        x + Math.cos(angle) * dist,
                y:        y + Math.sin(angle) * dist,
                angle:    120 + Math.random() * 120,
                alpha:    0,
                scaleX:   0.1, scaleY: 0.1,
                duration: 280 + Math.random() * 80,
                ease:     'Quad.easeOut',
                onComplete: () => dot.destroy(),
            });
        }
    }

    // Notification for certian events
    notify(msg, color = '#ffffff') {
        this._notifQueue.push({ msg, color });
        if (!this._notifBusy) this._flushNotif();
    }

    _flushNotif() {
        if (this._notifQueue.length === 0) { this._notifBusy = false; return; }
        this._notifBusy = true;
        const { msg, color } = this._notifQueue.shift();
        const t = this._notifText;
        t.setText(msg);
        t.setColor(color);
        t.setAlpha(1).setY(46);
        this.scene.tweens.add({
            targets:  t,
            y:        34, alpha: 0,
            duration: 1600, delay: 600,
            ease:     'Quad.easeIn',
            onComplete: () => this._flushNotif(),
        });
    }

    update() {
        this._checkPickups();
    }
}