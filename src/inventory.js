// inventory.js  –  Data / State Layer

const HP_MAX = 100;
const HUD_DEPTH = 30;
const COIN_HUD_SIZE = 20;

const PADDLE_WEAR_PER_STROKE = 0.5;
const COLLISION_COOLDOWN_MS = 800;
const COLLISION_SPEED_LIGHT = 1.5;
const COLLISION_SPEED_HARD = 3.5;
const COLLISION_DMG_LIGHT = 4;
const COLLISION_DMG_HARD_BASE = 8;
const COLLISION_DMG_HARD_MULT = 3;
const COLLISION_DMG_MAX = 20;

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
        this.scene = scene;
        this.boat = boat;
        this.fishing = fishing;
        this._map = map;
        this._collisionLayer = collisionLayer;

        this.gold  = 0;
        this.hp = HP_MAX;
        this.owned = {};

        this._pickups    = [];
        this._notifQueue = [];
        this._notifBusy  = false;
        this._fishMenuOpen  = false;
        this._lastCollisionTime = -Infinity;

        this._buildHUD();
        this._hookFishing();
        this._hookFishCounter();
        this._hookCollisions();
    }

    _buildHUD() {
        const scene = this.scene;
        const cam   = scene.cameras.main;

        const iconCx = cam.width - 8 - COIN_HUD_SIZE / 2;
        const textX  = iconCx - COIN_HUD_SIZE / 2 - 6;
        const rowY   = 18;

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

        this._goldText = scene.add.text(textX, rowY, '0', {
            fontFamily: 'monospace',
            fontSize:   '15px',
            color:      '#f7c948',
            stroke:     '#000000',
            strokeThickness: 3,
        }).setOrigin(1, 0.5).setDepth(HUD_DEPTH).setScrollFactor(0);

        this._hpBarBg = scene.add.rectangle(12, 68, 120, 12, 0x550000)
            .setOrigin(0, 0.5).setDepth(HUD_DEPTH).setScrollFactor(0);

        this._hpBar = scene.add.rectangle(12, 68, 120, 12, 0xff3333)
            .setOrigin(0, 0.5).setDepth(HUD_DEPTH).setScrollFactor(0);

        this._hpText = scene.add.text(138, 68, `HP ${HP_MAX}`, {
            fontFamily: 'monospace',
            fontSize:   '11px',
            color:      '#ffffff',
        }).setOrigin(0, 0.5).setDepth(HUD_DEPTH).setScrollFactor(0);

        this._damageFlash = scene.add.rectangle(
            cam.width / 2, cam.height / 2,
            cam.width, cam.height,
            0xff0000, 0
        ).setDepth(HUD_DEPTH - 1).setScrollFactor(0);

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

    // Gold Management
    addGold(amount) {
        this.gold += amount;
        this._goldText.setText(String(this.gold));
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

    // HP Management
    damage(amount) {
        this.hp = Math.max(0, this.hp - amount);
        this._refreshHP();
        this.scene.tweens.add({
            targets: this._damageFlash,
            alpha:0.35,
            duration: 60,
            yoyo:true,
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

                if (bodyA !== boatBody && bodyB !== boatBody) continue;

                const other = bodyA === boatBody ? bodyB : bodyA;

                if (other.isSensor) continue;

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

    // Fishing callback hook 
    _hookFishing() {
        const fs = this.fishing;
        if (!fs) return;
        const _originalEnd = fs._end.bind(fs);
        fs._end = (caught) => {
            _originalEnd(caught);      
            if ((fs._baitCharges || 0) > 0) {
                fs._baitCharges--;
                if (fs._baitCharges === 0)
                    this.notify('Lucky Bait used up!', '#ffaa55');
            }
        };
    }

    // Fish counter interactivity
    _hookFishCounter() {
        const fs = this.fishing;
        if (!fs || !fs._counter) return;

        const counter = fs._counter;

        counter.setInteractive({ useHandCursor: true });

        counter.on('pointerover', () => {
            if (this._fishMenuOpen) return;
            this.scene.tweens.add({
                targets: counter, scaleX: 1.12, scaleY: 1.12,
                duration: 120, ease: 'Sine.easeOut',
            });
            counter.setStyle({ color: '#aaffaa' });
        });

        counter.on('pointerout', () => {
            if (this._fishMenuOpen) return;
            this.scene.tweens.add({
                targets: counter, scaleX: 1, scaleY: 1,
                duration: 120, ease: 'Sine.easeOut',
            });
            counter.setStyle({ color: '#ffffff' });
        });

        counter.on('pointerdown', () => {
            if (this._fishMenuOpen) {
                this._closeFishMenu();
            } else {
                this._openFishMenu();
            }
        });
    }

    // Fish Menu 
    _openFishMenu() {
        const scene  = this.scene;
        const cam    = scene.cameras.main;
        const fs     = this.fishing;
        const fish   = fs ? fs.fishCaught : 0;

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

        const panelW = 260;
        const panelH = 180;
        const panelX = cam.width  / 2 - panelW / 2;
        const panelY = cam.height / 2 - panelH / 2;
        const depth  = HUD_DEPTH + 10;

        const backdrop = scene.add.graphics()
            .setDepth(depth).setScrollFactor(0);
        backdrop.fillStyle(0x0a1a10, 0.92);
        backdrop.fillRoundedRect(panelX, panelY, panelW, panelH, 12);
        backdrop.lineStyle(2, 0x33ff88, 0.6);
        backdrop.strokeRoundedRect(panelX, panelY, panelW, panelH, 12);
        this._fishMenuGroup.push(backdrop);

        const title = scene.add.text(panelX + panelW / 2, panelY + 18,
            `${fish} fish in hold`, {
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
            sublabel: `+${fish * 3} | All fish sold`,
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
            alpha:  1,
            duration: 180,
            ease: 'Sine.easeOut',
        });
    }

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

    // Fish actions
    _eatFish(count) {
        const fs = this.fishing;
        const hp = Math.floor(count * 8);

        if (fs) {
            fs.fishCaught = 0;
            fs._counter.setText('Fish: 0');
        }

        this.heal(hp);
        this.notify(`Ate ${count} fish  ·  +${hp} HP`, '#ffcc88');
    }

    _sellFish(count) {
        const fs   = this.fishing;
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
        const scene  = this.scene;
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
            targets: t,
            y: 34, alpha: 0,
            duration: 1600, delay: 600,
            ease: 'Quad.easeIn',
            onComplete: () => this._flushNotif(),
        });
    }

    update() {
    }
}
