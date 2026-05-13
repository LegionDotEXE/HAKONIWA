// inventory.js — Data/State Layer
// Companion file: shop.js

const HUD_DEPTH             = 30;
const HP_MAX                = 100;
const PICKUP_RADIUS         = 48;      // px — auto-collect range
const PICKUP_SPAWN_INTERVAL = 8000;    // ms between batches

// resource types that appear as world pickups
const RESOURCE_DEFS = [
    { id: 'coin', label: 'Coin', color: 0xf7c948, value: 1, shape: 'circle' },
    { id: 'gem',  label: 'Gem',  color: 0x48c8f7, value: 5, shape: 'circle' },
    { id: 'log',  label: 'Log',  color: 0x8b5a2b, value: 3, shape: 'rect'   },
];

function popTween(scene, obj) {
    scene.tweens.add({
        targets: obj, scaleX: 1.25, scaleY: 1.25,
        duration: 80, yoyo: true, ease: 'Sine.easeOut',
    });
}

export default class InventorySystem {
    constructor(scene, boat, fishing) {
        this.scene   = scene;
        this.boat    = boat;
        this.fishing = fishing;

        this.gold  = 0;
        this.hp    = HP_MAX;
        this.owned = {};

        this._pickups    = [];
        this._notifQueue = [];
        this._notifBusy  = false;

        this._buildHUD();
        this._hookFishing();
        this._startPickupSpawner();
    }

    // ── HUD ──────────────────────────────────────────────────
    _buildHUD() {
        const scene = this.scene;
        const cam   = scene.cameras.main;

        this._goldText = scene.add.text(cam.width - 16, 16, '💰 0', {
            fontFamily: 'monospace',
            fontSize:   '16px',
            color:      '#f7c948',
            stroke:     '#000000',
            strokeThickness: 3,
            backgroundColor: 'rgba(0,0,0,0.45)',
            padding: { x: 8, y: 3 },
        }).setOrigin(1, 0).setDepth(HUD_DEPTH).setScrollFactor(0);

        this._hpBarBg = scene.add.rectangle(12, 38, 120, 10, 0x550000)
            .setOrigin(0, 0.5).setDepth(HUD_DEPTH).setScrollFactor(0);

        this._hpBar = scene.add.rectangle(12, 38, 120, 10, 0xff3333)
            .setOrigin(0, 0.5).setDepth(HUD_DEPTH).setScrollFactor(0);

        this._hpText = scene.add.text(140, 38, `HP ${HP_MAX}`, {
            fontFamily: 'monospace',
            fontSize:   '11px',
            color:      '#ffffff',
        }).setOrigin(0, 0.5).setDepth(HUD_DEPTH).setScrollFactor(0);

        this._damageFlash = scene.add.rectangle(
            cam.width / 2, cam.height / 2,
            cam.width, cam.height,
            0xff0000, 0
        ).setDepth(HUD_DEPTH - 1).setScrollFactor(0);

        this._notifText = scene.add.text(cam.width / 2, 48, '', {
            fontFamily: 'monospace',
            fontSize:   '14px',
            color:      '#ffffff',
            stroke:     '#000000',
            strokeThickness: 3,
            backgroundColor: 'rgba(0,0,0,0.55)',
            padding:    { x: 10, y: 4 },
        }).setOrigin(0.5, 0).setDepth(HUD_DEPTH).setScrollFactor(0).setAlpha(0);
    }

    // ── Gold ─────────────────────────────────────────────────
    addGold(amount) {
        this.gold += amount;
        this._goldText.setText(`💰 ${this.gold}`);
        popTween(this.scene, this._goldText);
        if (this.scene.shop) this.scene.shop.onGoldChanged(this.gold);
        this.notify(`+${amount} 💰`, '#f7c948');
    }

    spendGold(amount) {
        this.gold -= amount;
        this._goldText.setText(`💰 ${this.gold}`);
        if (this.scene.shop) this.scene.shop.onGoldChanged(this.gold);
    }

    // ── HP ───────────────────────────────────────────────────
    damage(amount) {
        this.hp = Math.max(0, this.hp - amount);
        this._refreshHP();
        this.scene.tweens.add({
            targets:  this._damageFlash,
            alpha:    0.35,
            duration: 60,
            yoyo:     true,
            onComplete: () => this._damageFlash.setAlpha(0),
        });
        if (this.hp <= 0) this._onBoatDestroyed();
    }

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

    // ── Stroke hook ───────────────────────────────────────────
    onStroke() {
        if (Math.random() < 0.2) this.addGold(1);
    }

    // ── Fishing hook ──────────────────────────────────────────
    _hookFishing() {
        const fs = this.fishing;
        if (!fs) return;
        const _originalEnd = fs._end.bind(fs);
        fs._end = (caught) => {
            _originalEnd(caught);
            if (caught === true) {
                this.addGold(3);
                this.notify('+3 💰  Fish caught!', '#55ccff');
            }
            if ((fs._baitCharges || 0) > 0) {
                fs._baitCharges--;
                if (fs._baitCharges === 0)
                    this.notify('Lucky Bait used up!', '#ffaa55');
            }
        };
    }

    // ── World Pickups ─────────────────────────────────────────
    _startPickupSpawner() {
        this.scene.time.addEvent({
            delay:         PICKUP_SPAWN_INTERVAL,
            loop:          true,
            callback:      this._spawnBatch,
            callbackScope: this,
        });
        this._spawnBatch(); // spawn an initial batch immediately
    }

    _spawnBatch() {
        const count = Phaser.Math.Between(3, 6);
        for (let i = 0; i < count; i++) {
            const angle  = Math.random() * Math.PI * 2;
            const radius = Phaser.Math.Between(160, 320);
            // spawn relative to the boat's current world position
            const bx  = this.boat ? this.boat.x : 400;
            const by  = this.boat ? this.boat.y : 300;
            const def = Phaser.Utils.Array.GetRandom(RESOURCE_DEFS);
            this._createPickup(
                bx + Math.cos(angle) * radius,
                by + Math.sin(angle) * radius,
                def
            );
        }
    }

    _createPickup(x, y, def) {
        const scene = this.scene;
        // shape matches resource type
        const obj = def.shape === 'circle'
            ? scene.add.circle(x, y, 7, def.color).setDepth(5)
            : scene.add.rectangle(x, y, 11, 7, def.color).setDepth(5);

        // gentle bob so pickups are visible and feel alive
        scene.tweens.add({
            targets:  obj,
            y:        y - 5,
            duration: 700 + Math.random() * 400,
            yoyo:     true,
            repeat:   -1,
            ease:     'Sine.easeInOut',
        });

        // label fades in when the boat is within 100 px
        const label = scene.add.text(x, y - 16, `${def.label} +${def.value}`, {
            fontFamily: 'monospace',
            fontSize:   '10px',
            color:      '#ffffff',
            stroke:     '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5, 1).setDepth(6).setAlpha(0);

        this._pickups.push({ obj, label, def, collected: false });
    }

    _checkPickups() {
        if (!this.boat) return;
        const bx = this.boat.x;
        const by = this.boat.y;

        this._pickups.forEach(p => {
            if (p.collected) return;
            const dx = p.obj.x - bx;
            const dy = p.obj.y - by;
            const d  = Math.sqrt(dx * dx + dy * dy);

            // fade label in when close
            p.label.setAlpha(d < 100 ? 1 : 0);

            if (d < PICKUP_RADIUS) {
                p.collected = true;
                this._collectPickup(p);
            }
        });

        // purge collected entries every frame
        this._pickups = this._pickups.filter(p => !p.collected);
    }

    _collectPickup(p) {
        const scene = this.scene;
        const cam   = scene.cameras.main;
        const x = p.obj.x;
        const y = p.obj.y;

        // ghost copy flies toward the gold HUD counter
        const ghost = scene.add.circle(x, y, 7, p.def.color).setDepth(20);
        scene.tweens.add({
            targets:  ghost,
            x:        cam.scrollX + cam.width - 20,
            y:        cam.scrollY + 20,
            scaleX:   0.2,
            scaleY:   0.2,
            alpha:    0,
            duration: 450,
            ease:     'Quad.easeIn',
            onComplete: () => ghost.destroy(),
        });

        this._burst(x, y, p.def.color);
        this.addGold(p.def.value);
        p.obj.destroy();
        p.label.destroy();
    }

    // 8-dot radial sparkle burst
    _burst(x, y, color) {
        for (let i = 0; i < 8; i++) {
            const a   = (i / 8) * Math.PI * 2;
            const dot = this.scene.add.circle(x, y, 3, color).setDepth(20);
            this.scene.tweens.add({
                targets:  dot,
                x:        x + Math.cos(a) * 28,
                y:        y + Math.sin(a) * 28,
                alpha:    0,
                duration: 380,
                ease:     'Quad.easeOut',
                onComplete: () => dot.destroy(),
            });
        }
    }

    // ── Notification toast ────────────────────────────────────
    notify(msg, color = '#ffffff') {
        this._notifQueue.push({ msg, color });
        if (!this._notifBusy) this._flushNotif();
    }

    _flushNotif() {
        if (this._notifQueue.length === 0) { this._notifBusy = false; return; }
        this._notifBusy = true;
        const { msg, color } = this._notifQueue.shift();
        const t = this._notifText;
        t.setText(msg).setStyle({ color }).setAlpha(1).setY(48);
        this.scene.tweens.add({
            targets:  t,
            y:        36,
            alpha:    0,
            duration: 1600,
            delay:    600,
            ease:     'Quad.easeIn',
            onComplete: () => this._flushNotif(),
        });
    }

    // ── Per-frame update — called from river.js update() ─────
    update() {
        this._checkPickups();
    }
}