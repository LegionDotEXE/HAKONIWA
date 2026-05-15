// inventory.js  –  Data / State Layer

const HP_MAX = 100;
const HUD_DEPTH = 30;
const COIN_HUD_SIZE = 20;

<<<<<<< Updated upstream
const COIN_SPAWN_INTERVAL = 20000;   // ms between batches
const COIN_BATCH_SIZE     = 2;       // coins per batch
const COIN_MAX_LIVE       = 5;       // max coins in the world at once
const COIN_SEARCH_TRIES   = 60;      // attempts to find a valid water tile
const COIN_SPAWN_RADIUS   = 350;     // max px from boat
const COIN_MIN_RADIUS     = 120;     // min px from boat
const PICKUP_RADIUS       = 40;      // px — collection distance

const COIN_WORLD_SIZE = 20;
const COIN_BURST_SIZE = 10;
const COIN_GHOST_SIZE = 14;
const COIN_HUD_SIZE   = 20;


=======
const PADDLE_WEAR_PER_STROKE  = 0.5;
const COLLISION_COOLDOWN_MS  = 800;
const COLLISION_SPEED_LIGHT = 1.5;
const COLLISION_SPEED_HARD = 3.5;
const COLLISION_DMG_LIGHT = 4;
const COLLISION_DMG_HARD_BASE = 8;
const COLLISION_DMG_HARD_MULT = 3;
const COLLISION_DMG_MAX = 20;
>>>>>>> Stashed changes

function makeCoin(scene, x, y, size, depth) {
    if (scene.textures.exists('coin') &&
        scene.textures.get('coin').key !== '__MISSING') {
        return scene.add.image(x, y, 'coin')
            .setDisplaySize(size, size)
            .setDepth(depth);
    }
    // fallback — scene.add.circle is a real game object with correct .x/.y
    return scene.add.circle(x, y, size / 2, 0xf7c948)
        .setStrokeStyle(2, 0xc8922a)
        .setDepth(depth);
}

export default class InventorySystem {

    constructor(scene, boat, fishing, map, collisionLayer) {
        this.scene = scene;
        this.boat = boat;
        this.fishing = fishing;
        this._map = map;
        this._collisionLayer = collisionLayer;

        this.gold  = 0;
        this.hp    = HP_MAX;
        this.owned = {};

        this._pickups    = [];
        this._notifQueue = [];
        this._notifBusy  = false;
        this._fishMenuOpen      = false;
        this._lastCollisionTime = -Infinity;

        this._buildHUD();
        this._hookFishing();
        this._hookFishCounter();
        this._hookCollisions();
    }

    // ─── HUD ──────────────────────────────────────────────────
    _buildHUD() {
        const scene = this.scene;
        const cam = scene.cameras.main;

        // Layout right-to-left: [right edge 8px] [icon 20px] [6px gap] [number, right-aligned]
        // Number uses origin(1, 0.5) so it expands leftward — never overlaps the icon.
        const iconCx = cam.width - 8 - COIN_HUD_SIZE / 2;
        const textX = iconCx - COIN_HUD_SIZE / 2 - 6;
        const rowY = 18;

        if (scene.textures.exists('coin') &&
            scene.textures.get('coin').key !== '__MISSING') {
            this._goldIcon = scene.add.image(iconCx, rowY, 'coin')
                .setDisplaySize(COIN_HUD_SIZE, COIN_HUD_SIZE)
                .setOrigin(0.5)
                .setDepth(HUD_DEPTH)
                .setScrollFactor(0);
        } else {
            // fallback circle — must use scene.add.circle, NOT Graphics
            this._goldIcon = scene.add.circle(iconCx, rowY, COIN_HUD_SIZE / 2, 0xf7c948)
                .setStrokeStyle(2, 0xc8922a)
                .setDepth(HUD_DEPTH)
                .setScrollFactor(0);
        }

<<<<<<< Updated upstream
        // Gold number — right-aligned, grows left
=======
>>>>>>> Stashed changes
        this._goldText = scene.add.text(textX, rowY, '0', {
            fontFamily: 'monospace',
            fontSize: '15px',
            color: '#f7c948',
            stroke: '#000000',
            strokeThickness: 3,
        }).setOrigin(1, 0.5).setDepth(HUD_DEPTH).setScrollFactor(0);

        this._hpBarBg = scene.add.rectangle(12, 45, 120, 12, 0x550000)
            .setOrigin(0, 0.5).setDepth(HUD_DEPTH).setScrollFactor(0);

        this._hpBar = scene.add.rectangle(12, 45, 120, 12, 0xff3333)
            .setOrigin(0, 0.5).setDepth(HUD_DEPTH).setScrollFactor(0);

        this._hpText = scene.add.text(138, 45, `HP ${HP_MAX}`, {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#ffffff',
        }).setOrigin(0, 0.5).setDepth(HUD_DEPTH).setScrollFactor(0);

<<<<<<< Updated upstream
        // Full-screen red flash — alpha 0 until damage()
=======
>>>>>>> Stashed changes
        this._damageFlash = scene.add.rectangle(
            cam.width / 2, cam.height / 2,
            cam.width, cam.height,
            0xff0000, 0
        ).setDepth(HUD_DEPTH - 1).setScrollFactor(0);

<<<<<<< Updated upstream
        // Toast notification — top-centre
=======
>>>>>>> Stashed changes
        this._notifText = scene.add.text(cam.width / 2, 46, '', {
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3,
            backgroundColor: 'rgba(0,0,0,0.55)',
            padding: { x: 10, y: 4 },
        }).setOrigin(0.5, 0).setDepth(HUD_DEPTH).setScrollFactor(0).setAlpha(0);
    }

    // ─── Gold ─────────────────────────────────────────────────
    addGold(amount) {
        this.gold += amount;
        this._goldText.setText(String(this.gold));
        this.scene.tweens.add({
            targets: this._goldText,
            scaleX: 1.3, scaleY: 1.3,
            duration: 80, yoyo: true, ease: 'Sine.easeOut',
        });
        if (this.scene.shop) this.scene.shop.onGoldChanged(this.gold);
    }

    spendGold(amount) {
        this.gold -= amount;
        this._goldText.setText(String(this.gold));
        if (this.scene.shop) this.scene.shop.onGoldChanged(this.gold);
    }

<<<<<<< Updated upstream
    // ─── HP ───────────────────────────────────────────────────
=======
    // HP Management
>>>>>>> Stashed changes
    damage(amount) {
        this.hp = Math.max(0, this.hp - amount);
        this._refreshHP();
        this.scene.tweens.add({
            targets:  this._damageFlash,
<<<<<<< Updated upstream
            alpha:    0.35,
            duration: 60,
            yoyo:     true,
=======
            alpha: 0.35,
            duration: 60,
            yoyo: true,
>>>>>>> Stashed changes
            onComplete: () => this._damageFlash.setAlpha(0),
        });
        if (this.hp <= 0) this._onBoatDestroyed();
    }

    heal(amount) {
        this.hp = Math.min(HP_MAX, this.hp + amount);
        this._refreshHP();
        this.notify(`+${amount} HP`, '#55ff55');
    }

    _refreshHP() {
        const pct = this.hp / HP_MAX;
        this._hpBar.setDisplaySize(120 * pct, 12);
        const col = pct > 0.6 ? 0x44ff44 : pct > 0.3 ? 0xffaa00 : 0xff2222;
        this._hpBar.setFillStyle(col);
        this._hpText.setText(`HP ${Math.ceil(this.hp)}`);
    }

    _onBoatDestroyed() {
        this.notify('BOAT DESTROYED!', '#ff3333');
        // this.scene.time.delayedCall(1500, () => this.scene.scene.start('GameOver'));
    }

<<<<<<< Updated upstream
    // ─── Stroke hook ──────────────────────────────────────────
    // Intentionally empty — gold only comes from coins and fishing.
    onStroke() {}
=======
    // Stroke callback
    onStroke() {
        this.hp = Math.max(0, this.hp - PADDLE_WEAR_PER_STROKE);
        this._refreshHP();
        if (this.hp <= 0) this._onBoatDestroyed();
    }

    // Collision damage 
    _hookCollisions() {
        this.scene.matter.world.on('collisionstart', (event) => {
            const now = this.scene.time.now;
            if (now - this._lastCollisionTime < COLLISION_COOLDOWN_MS) return;

            const boatBody = this.boat ? this.boat.body : null;
            if (!boatBody) return;

            for (const pair of event.pairs) {
                const { bodyA, bodyB } = pair;
                const isBoat = bodyA === boatBody || bodyB === boatBody;
                if (!isBoat) continue;

                const other = bodyA === boatBody ? bodyB : bodyA;
                if (other.label === 'shopZone') continue;

                const vx    = boatBody.velocity.x;
                const vy    = boatBody.velocity.y;
                const speed = Math.sqrt(vx * vx + vy * vy);

                if (speed < COLLISION_SPEED_LIGHT) break;

                let dmg;
                if (speed < COLLISION_SPEED_HARD) {
                    dmg = COLLISION_DMG_LIGHT;
                } else {
                    dmg = Math.min(
                        COLLISION_DMG_HARD_BASE + (speed - COLLISION_SPEED_HARD) * COLLISION_DMG_HARD_MULT,
                        COLLISION_DMG_MAX
                    );
                }

                this._lastCollisionTime = now;
                this.damage(dmg);

                const label = speed >= COLLISION_SPEED_HARD ? 'Hard hit!' : 'Scraped wall';
                this.notify(label, speed >= COLLISION_SPEED_HARD ? '#ff5555' : '#ffaa55');
                break;
            }
        });
    }
>>>>>>> Stashed changes

    // ─── Fishing hook ─────────────────────────────────────────
    _hookFishing() {
        const fs = this.fishing;
        if (!fs) return;
        const _originalEnd = fs._end.bind(fs);
        fs._end = (caught) => {
<<<<<<< Updated upstream
            _originalEnd(caught);       // original logic runs first, unchanged
            if (caught === true) {
                this.addGold(3);
                this.notify('+3  🪙  Nice catch!', '#55ccff');
            }
=======
            _originalEnd(caught);      
>>>>>>> Stashed changes
            if ((fs._baitCharges || 0) > 0) {
                fs._baitCharges--;
                if (fs._baitCharges === 0)
                    this.notify('Lucky Bait used up!', '#ffaa55');
            }
        };
    }

<<<<<<< Updated upstream
    // ─── Water tile check ─────────────────────────────────────
_isWater(wx, wy) {
    if (!this._collisionLayer || !this._map) return true;
    
    // 1. Reject positions outside the map boundaries
    if (wx < 0 || wx > this._map.widthInPixels || wy < 0 || wy > this._map.heightInPixels) {
        return false;
    }
=======
    // Fish counter interactivity
    _hookFishCounter() {
        const fs = this.fishing;
        if (!fs || !fs._counter) return;
>>>>>>> Stashed changes

        const counter = fs._counter;

<<<<<<< Updated upstream
    // 2. Strictly check for the collides property
    // setCollisionByProperty({ collides: true }) sets this to exactly true on land tiles
    return tile.collides !== true;
}

    // ─── Coin spawner ─────────────────────────────────────────
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

        // coin is always a real game object — .x and .y are always correct
        const obj = makeCoin(scene, x, y, COIN_WORLD_SIZE, 5);

        // bob: tweens obj.y directly — works because obj has a real .y property
        const bobTween = scene.tweens.add({
            targets:  obj,
            y:        y - 5,
            duration: 900 + Math.random() * 400,
            yoyo:     true, repeat: -1,
            ease:     'Sine.easeInOut',
=======
        counter.setInteractive({ useHandCursor: true });

        counter.on('pointerover', () => {
            if (this._fishMenuOpen) return;
            this.scene.tweens.add({
                targets: counter, scaleX: 1.12, scaleY: 1.12,
                duration: 120, ease: 'Sine.easeOut',
            });
            counter.setStyle({ color: '#aaffaa' });
>>>>>>> Stashed changes
        });

        counter.on('pointerout', () => {
            if (this._fishMenuOpen) return;
            this.scene.tweens.add({
                targets: counter, scaleX: 1, scaleY: 1,
                duration: 120, ease: 'Sine.easeOut',
            });
            counter.setStyle({ color: '#ffffff' });
        });

<<<<<<< Updated upstream
        // "+1" label fades in when nearby
        const label = scene.add.text(x, y - 18, '+1', {
            fontFamily: 'monospace', fontSize: '11px',
            color: '#f7c948', stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5, 1).setDepth(6).setAlpha(0);

        // spawnX/spawnY store the original position for label placement
        this._pickups.push({ obj, label, bobTween, spinTween, collected: false });
    }

    // ─── Per-frame collection check ────────────────────────────
    _checkPickups() {
        if (!this.boat) return;
        const bx = this.boat.x;
        const by = this.boat.y;

        this._pickups.forEach(p => {
            if (p.collected) return;

            // obj.x and obj.y are always correct for both image and circle
            const dx = p.obj.x - bx;
            const dy = p.obj.y - by;
            const d  = Math.sqrt(dx * dx + dy * dy);

            // fade in "+1" when close
            p.label.setAlpha(d < 80 ? 1 : 0);

            if (d < PICKUP_RADIUS) {
                p.collected = true;       // mark first — prevents double-collect
                this._collectCoin(p);
            }
        });

        // purge collected entries
        this._pickups = this._pickups.filter(p => !p.collected);
=======
        counter.on('pointerdown', () => {
            if (this._fishMenuOpen) {
                this._closeFishMenu();
            } else {
                this._openFishMenu();
            }
        });
>>>>>>> Stashed changes
    }

    // Fish menu UI
    _openFishMenu() {
        const scene = this.scene;
        const cam = scene.cameras.main;
        const fs = this.fishing;
        const fish = fs ? fs.fishCaught : 0;

<<<<<<< Updated upstream
        // capture world position before destroying anything
        const x = p.obj.x;
        const y = p.obj.y;

        // stop idle tweens
        p.bobTween.stop();
        p.spinTween.stop();

        // destroy coin and label immediately — no lingering
        p.obj.destroy();
        p.label.destroy();

        // burst at the captured position
        this._burstCoins(x, y);

        // ghost flies toward the HUD coin icon
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

        // credit gold after the ghost has nearly arrived
        scene.time.delayedCall(250, () => this.addGold(1));
=======
        if (fish <= 0) {
            this.notify('No fish to use!', '#ff9955');
            return;
        }

        this._fishMenuOpen = true;
        this._fishMenuGroup = [];
        this._outsideClickHandler = () => {
            if (this._fishMenuOpen) this._closeFishMenu();
        };
        this.scene.time.delayedCall(50, () => {
            this.scene.input.once('pointerdown', this._outsideClickHandler);
        });

        const panelX = 12;
        const panelY = 36;
        const panelW = 260;
        const panelH = 180;
        const depth  = HUD_DEPTH + 10;

        const backdrop = scene.add.graphics()
            .setDepth(depth).setScrollFactor(0);
        backdrop.fillStyle(0x0a1a10, 0.92);
        backdrop.fillRoundedRect(panelX, panelY, panelW, panelH, 12);
        backdrop.lineStyle(2, 0x33ff88, 0.6);
        backdrop.strokeRoundedRect(panelX, panelY, panelW, panelH, 12);
        this._fishMenuGroup.push(backdrop);

        const title = scene.add.text(panelX + panelW / 2, panelY + 18,
            `🐟  ${fish} fish in hold`, {
                fontFamily: 'monospace', fontSize: '13px',
                color: '#aaffcc', stroke: '#000', strokeThickness: 2,
            }
        ).setOrigin(0.5, 0).setDepth(depth + 1).setScrollFactor(0);
        this._fishMenuGroup.push(title);

        const div = scene.add.graphics().setDepth(depth + 1).setScrollFactor(0);
        div.lineStyle(1, 0x33ff88, 0.3);
        div.lineBetween(panelX + 16, panelY + 38, panelX + panelW - 16, panelY + 38);
        this._fishMenuGroup.push(div);

        const btnY1 = panelY + 62;
        const btnY2 = panelY + 130;
        const btnCx = panelX + panelW / 2;

        this._makeFishOption({
            cx: btnCx, cy: btnY1, depth,
            circleColor:  0xff6b35,
            circleStroke: 0xff9966,
            label:  'EAT',
            sublabel: `+${Math.floor(fish * 8)} HP | All fish consumed`,
            labelColor: '#ffcc88',
            onSelect: () => this._eatFish(fish),
        });

        this._makeFishOption({
            cx: btnCx, cy: btnY2, depth,
            circleColor:  0x35c8ff,
            circleStroke: 0x88eeff,
            label:  'SELL',
            sublabel: `+${fish * 3} ·  all fish sold`,
            labelColor: '#88eeff',
            onSelect: () => this._sellFish(fish),
        });

        // const hint = scene.add.text(btnCx, panelY + panelH - 10,
        //     'click fish counter to close', {
        //         fontFamily: 'monospace', fontSize: '9px', color: '#446644',
        //     }
        // ).setOrigin(0.5, 1).setDepth(depth + 1).setScrollFactor(0);
        // this._fishMenuGroup.push(hint);

        const all = this._fishMenuGroup;
        all.forEach(obj => { obj.setAlpha(0); });
        scene.tweens.add({
            targets:  all,
            alpha:    1,
            duration: 180,
            ease:     'Sine.easeOut',
        });
>>>>>>> Stashed changes
    }

    // helper for building each option in the fish menu
    // got some help with Copilot on this one 
    _makeFishOption({ cx, cy, depth, circleColor, circleStroke, label, sublabel, labelColor, onSelect }) {
        const scene   = this.scene;
        const radius  = 22;

        const circle = scene.add.circle(cx - 70, cy, radius, circleColor)
            .setStrokeStyle(2, circleStroke)
            .setDepth(depth + 2).setScrollFactor(0);

        const ring = scene.add.circle(cx - 70, cy, radius - 6, circleColor)
            .setStrokeStyle(1, circleStroke, 0.4)
            .setFillStyle(circleColor, 0)
            .setDepth(depth + 3).setScrollFactor(0);

        const lbl = scene.add.text(cx - 70 + radius + 10, cy - 8, label, {
            fontFamily: 'monospace', fontSize: '14px',
            color: labelColor, stroke: '#000', strokeThickness: 2,
        }).setOrigin(0, 0.5).setDepth(depth + 2).setScrollFactor(0);

        const sub = scene.add.text(cx - 70 + radius + 10, cy + 10, sublabel, {
            fontFamily: 'monospace', fontSize: '10px', color: '#aaaaaa',
        }).setOrigin(0, 0.5).setDepth(depth + 2).setScrollFactor(0);

        const hit = scene.add.rectangle(cx, cy, 240, 44)
            .setDepth(depth + 4).setScrollFactor(0)
            .setInteractive({ useHandCursor: true });

        hit.on('pointerover', () => {
            scene.tweens.add({
                targets: circle, scaleX: 1.15, scaleY: 1.15,
                duration: 100, ease: 'Sine.easeOut',
            });
            lbl.setStyle({ color: '#ffffff' });
        });
        hit.on('pointerout', () => {
            scene.tweens.add({
                targets: circle, scaleX: 1, scaleY: 1,
                duration: 100, ease: 'Sine.easeOut',
            });
            lbl.setStyle({ color: labelColor });
        });
        hit.on('pointerdown', () => {
            this._closeFishMenu();
            onSelect();
        });

        this._fishMenuGroup.push(circle, ring, lbl, sub, hit);
    }

    _closeFishMenu() {
        if (!this._fishMenuOpen) return;
        this._fishMenuOpen = false;
        this.scene.input.off('pointerdown', this._outsideClickHandler);

        const fs = this.fishing;
        const counter = fs ? fs._counter : null;

        if (counter) {
            counter.setStyle({ color: '#ffffff' });
            this.scene.tweens.add({
                targets: counter, scaleX: 1, scaleY: 1, duration: 80,
            });
        }

        this.scene.tweens.add({
            targets: this._fishMenuGroup,
            alpha: 0,
            duration: 140,
            ease: 'Sine.easeIn',
            onComplete: () => {
                this._fishMenuGroup.forEach(obj => {
                    if (obj && obj.destroy) obj.destroy();
                });
                this._fishMenuGroup = [];
            },
        });
    }

    // Fish menu actions
    _eatFish(count) {
        const fs = this.fishing;
        const hp = Math.floor(count * 8);

        if (fs) {
            fs.fishCaught = 0;
            fs._counter.setText('Fish: 0');
        }

        this.heal(hp);
        this.notify(`🍖  Ate ${count} fish  ·  +${hp} HP`, '#ffcc88');
    }

    _sellFish(count) {
        const fs = this.fishing;
        const gold = count * 3;

        if (fs) {
            fs.fishCaught = 0;
            fs._counter.setText('Fish: 0');
        }

        this.addGold(gold);
        this.notify(`Sold ${count} fish  ·  +${gold} coins`, '#88eeff');

        this._fishSellBurst(gold);
    }

    // Animates a burst of ghost coins flying toward the gold HUD icon
    _fishSellBurst(goldAmount) {
        const scene = this.scene;
        const cam = scene.cameras.main;
        const hudX = cam.scrollX + cam.width - 8 - COIN_HUD_SIZE / 2;
        const hudY = cam.scrollY + 18;
        const startX = cam.scrollX + 60;
        const startY = cam.scrollY + 20;

        const count = Math.min(goldAmount, 8);

        for (let i = 0; i < count; i++) {
            const delay = i * 55;
            scene.time.delayedCall(delay, () => {
                const ghost = makeCoin(scene, startX, startY, 14, HUD_DEPTH + 5);
                scene.tweens.add({
                    targets:  ghost,
                    x: hudX,
                    y: hudY,
                    scaleX: 0.2, scaleY: 0.2,
                    alpha: 0,
                    duration: 480,
                    ease: 'Quad.easeIn',
                    onComplete: () => ghost.destroy(),
                });
            });
        }
    }

    //  water tile check
    _isWater(wx, wy) {
        if (!this._collisionLayer || !this._map) return true;
        
        if (wx < 0 || wx > this._map.widthInPixels || wy < 0 || wy > this._map.heightInPixels) {
            return false;
        }

        const tile = this._collisionLayer.getTileAtWorldXY(wx, wy);
        if (!tile) return true;

        return tile.collides !== true;
    }

    // ─── Notification toast ───────────────────────────────────
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
            y: 34, alpha: 0,
            duration: 1600, delay: 600,
            ease: 'Quad.easeIn',
            onComplete: () => this._flushNotif(),
        });
    }

    // ─── Per-frame update — call from river.js update() ───────
    update() {
    }
}