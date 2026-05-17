// shop.js — Shop UI Layer 
// Depends on: inventory.js

const SHOP_CATALOGUE = [
    {
        id: 'paddle_upgrade', name: 'Reinforced Paddles', icon: 'item_paddle',
        cost: 15, description: 'Increases stroke force +20%.',
        stackable: true, maxStack: 3,
        effect(scene) {
            // multiplier is read by new_boat.js completeStroke
            scene.boat._strokeForceMultiplier =
                (scene.boat._strokeForceMultiplier || 1) + 0.2;
        },
    },
    {
        id: 'hull_repair', name: 'Hull Repair Kit', icon: 'item_hull',
        //25 HP to boat
        cost: 10, description: 'Restores 25 HP to the boat.',
        stackable: true, maxStack: 99,
        effect(scene) { scene.inventory.heal(25); },
    },
    {
        id: 'sail', name: 'River Sail', icon: 'item_sail',
        cost: 30, description: 'Adds a passive current boost heading downstream.',
        stackable: false,
        effect(scene) { scene.boat._hasSail = true; },
    },
    {
        id: 'anchor', name: 'Quick Anchor', icon: 'item_anchor',
        cost: 20, description: 'Press [SPACE] to drop anchor instantly.',
        stackable: false,
        effect(scene) {
            scene.boat._hasAnchor = true;
            // used [Space] key for anchor
            // No usage of predefined Phaser.Input.Keyboard.KeyCodes since we want to avoid hardcoding
            const space = scene.input.keyboard.addKey(
                Phaser.Input.Keyboard.KeyCodes.SPACE
            );
            space.on('down', () => {
                if (!scene.boat._hasAnchor) return;
                scene.boat._anchored = !scene.boat._anchored;
                if (scene.boat._anchored) {
                    scene.boat.setVelocity(0, 0);
                    scene.boat.setAngularVelocity(0);
                    scene.boat.setStatic(true);
                } else {
                    scene.boat.setStatic(false);
                }
            });
        },
    },
    {
        id: 'lucky_bait', name: 'Lucky Bait', icon: 'item_bait',
        cost: 8, description: 'Awards 3 bonus bait charges (faster fish bites).',
        stackable: true, maxStack: 99,
        effect(scene) {
            scene.fishing._baitCharges =
                (scene.fishing._baitCharges || 0) + 3;
        },
    },
];

const PANEL_W = 420;
const PANEL_H = 500;
const SHOP_DEPTH = 50;
const HUD_DEPTH  = 30;
const SHOP_KEY = 'E';

function popTween(scene, obj) {
    scene.tweens.add({
        targets: obj, scaleX: 1.25, scaleY: 1.25,
        duration: 80, yoyo: true, ease: 'Sine.easeOut',
    });
}

function shakeText(scene, obj) {
    const ox = obj.x;
    scene.tweens.add({
        targets: obj, x: ox + 5,
        duration: 40, yoyo: true, repeat: 3,
        onComplete: () => { obj.x = ox; },
    });
}

export default class ShopSystem {
    constructor(scene, inventory) {
        this.scene = scene;
        this.inventory = inventory;
        this.isOpen = false;
        this.nearZone  = false;
        this._itemRows = [];

        this._loadAssets(() => {
            this._buildPanel();
            this._buildZone(); 
            this._bindKey();    
        });
    }

    // load Assets 
    _loadAssets(cb) {
        const scene   = this.scene;
        
        // NOTE: river.js already sets this.load.path = './assets/' in preload().
        // Passing 'assets/' again causes "./assets/assets/..." 404 errors.
        // We only pass the bare filename here.
        const needed  = SHOP_CATALOGUE.map(i => ({
            key: i.icon, url: `${i.icon}.png`,
        }));
        
        const missing = needed.filter(a => !scene.textures.exists(a.key));
        if (missing.length === 0) { cb(); return; }
        
        missing.forEach(a => scene.load.image(a.key, a.url));
        scene.load.once('complete', cb);
        scene.load.start();
    }

    // Shop UI Panel
    _buildPanel() {
        const scene = this.scene;
        const cam = scene.cameras.main;
        const cx = cam.width  / 2;
        const cy = cam.height / 2;

        this._container = scene.add.container(cx, cy)
            .setDepth(SHOP_DEPTH).setScrollFactor(0).setVisible(false);

        const bg = scene.add.graphics();
        bg.fillStyle(0x1a0e05, 0.96);
        bg.fillRoundedRect(-PANEL_W/2, -PANEL_H/2, PANEL_W, PANEL_H, 18);
        bg.lineStyle(3, 0xc8922a, 1);
        bg.strokeRoundedRect(-PANEL_W/2, -PANEL_H/2, PANEL_W, PANEL_H, 18);

        const inner = scene.add.graphics();
        inner.lineStyle(1, 0x7a5215, 0.6);
        inner.strokeRoundedRect(
            -PANEL_W/2 + 8, -PANEL_H/2 + 8, PANEL_W - 16, PANEL_H - 16, 12
        );

        const title = scene.add.text(0, -PANEL_H/2 + 28, 'RIVER MARKET', {
            fontFamily: 'monospace',
            fontSize: '20px',
            color:'#f7c948',
            stroke:'#000000',
            strokeThickness: 3,
        }).setOrigin(0.5);

        this._panelGoldText = scene.add.text(
            PANEL_W/2 - 10, -PANEL_H/2 + 28,
            // `${this.inventory.gold}`, {
            //     fontFamily: 'monospace', fontSize: '14px', color: '#f7c948',
            // }
        ).setOrigin(1, 0.5);

        const div = scene.add.graphics();
        div.lineStyle(1, 0xc8922a, 0.5);
        div.lineBetween(-PANEL_W/2 + 16, -PANEL_H/2 + 52,
                         PANEL_W/2 - 16, -PANEL_H/2 + 52);

        const closeBtn = scene.add.text(
            PANEL_W/2 - 12, -PANEL_H/2 + 10, 'X', {
                fontFamily: 'monospace', fontSize: '20px', color: '#ff6666',
            }
        ).setOrigin(1, 0).setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => this.close());
        closeBtn.on('pointerover',  () => closeBtn.setStyle({ color: '#ff9999' }));
        closeBtn.on('pointerout',   () => closeBtn.setStyle({ color: '#ff6666' }));

        this._infoText = scene.add.text(0, PANEL_H/2 - 14,
            'Hover an item to see details', {
                fontFamily: 'monospace', fontSize: '11px', color: '#888888',
            }
        ).setOrigin(0.5, 1);

        this._container.add([bg, inner, title, this._panelGoldText,
            div, closeBtn, this._infoText]);

        this._buildItemRows();
    }

    _buildItemRows() {
        const scene = this.scene;
        const startY = -PANEL_H/2 + 72;
        const rowH = 72;
        const iconSz = 36;
        const btnW = 76;
        const btnH = 26;

        SHOP_CATALOGUE.forEach((item, i) => {
            const y = startY + i * rowH;

            const rowBg = scene.add.graphics();
            this._paintRowBg(rowBg, y, rowH, false);

            const icon = scene.textures.exists(item.icon)
                ? scene.add.image(-PANEL_W/2 + 34, y, item.icon)
                    .setDisplaySize(iconSz, iconSz)
                : scene.add.rectangle(
                    -PANEL_W/2 + 34, y, iconSz, iconSz, 0x555555);

            const nameText = scene.add.text(-PANEL_W/2 + 60, y - 10, item.name, {
                fontFamily: 'monospace', fontSize: '13px', color: '#ffffff',
            });
            const descText = scene.add.text(-PANEL_W/2 + 60, y + 8,
                item.description, {
                    fontFamily: 'monospace', fontSize: '10px',
                    color: '#999999', wordWrap: { width: 215 },
                }
            );
            const ownedText = scene.add.text(PANEL_W/2 - 96, y - 10, '', {
                fontFamily: 'monospace', fontSize: '10px', color: '#55ff55',
            });

            const btnCx = PANEL_W/2 - 14 - btnW/2;
            const btnBg  = scene.add.graphics();
            this._paintBtn(btnBg, btnCx, y, btnW, btnH, false);
            const btnText = scene.add.text(btnCx, y, `💰 ${item.cost}`, {
                fontFamily: 'monospace', fontSize: '12px', color: '#f7c948',
            }).setOrigin(0.5);

            const rowHit = scene.add.rectangle(0, y, PANEL_W - 20, rowH - 6)
                .setInteractive();
            const btnHit = scene.add.rectangle(btnCx, y, btnW, btnH)
                .setInteractive({ useHandCursor: true });

            rowHit.on('pointerover', () => this._paintRowBg(rowBg, y, rowH, true));
            rowHit.on('pointerout',  () => this._paintRowBg(rowBg, y, rowH, false));

            btnHit.on('pointerover', () => {
                this._paintBtn(btnBg, btnCx, y, btnW, btnH, true);
                this._infoText.setText(`${item.name}: ${item.description}`);
            });
            btnHit.on('pointerout', () => {
                this._paintBtn(btnBg, btnCx, y, btnW, btnH, false);
                this._infoText.setText('Hover an item to see details');
            });
            btnHit.on('pointerdown', () =>
                this._tryBuy(item, btnBg, btnText, btnCx, y, btnW, btnH));

            this._container.add([rowBg, rowHit, icon, nameText, descText,
                ownedText, btnBg, btnText, btnHit]);

            this._itemRows.push({
                item, ownedText, btnBg, btnText,
                btnCx, y, btnW, btnH,
            });
        });
    }

    // Row and Button rendering
    _paintRowBg(gfx, y, rowH, hover) {
        gfx.clear();
        gfx.fillStyle(0x3a2010, hover ? 1 : 0);
        gfx.fillRoundedRect(
            -PANEL_W/2 + 10, y - rowH/2 + 3, PANEL_W - 20, rowH - 6, 6
        );
    }

    _paintBtn(gfx, cx, cy, w, h, hover) {
        gfx.clear();
        gfx.fillStyle(hover ? 0x6b430f : 0x3d2509, 1);
        gfx.fillRoundedRect(cx - w/2, cy - h/2, w, h, 5);
        gfx.lineStyle(1, hover ? 0xf7c948 : 0x8b5a1a, 1);
        gfx.strokeRoundedRect(cx - w/2, cy - h/2, w, h, 5);
    }

    // floating Shop Zone in world space, shows hint when boat is near
    _buildZone() {
        const scene = this.scene;

        const shopX = 330
        const shopY = 2050;

        // Floating sign in world space
        const sign = scene.add.text(shopX, shopY - 20, 'SHOP', {
            fontFamily: 'monospace',
            fontSize: '13px',
            color:'#f7c948',
            backgroundColor: 'rgba(0,0,0,0.65)',
            padding: { x: 6, y: 3 },
        }).setOrigin(0.5).setDepth(HUD_DEPTH);

        scene.tweens.add({
            targets: sign,
            y: shopY - 28,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });

        this._zoneSensor = scene.matter.add.circle(shopX, shopY, 100, {
            isSensor: true, isStatic: true, label: 'shopZone',
        });

        this._hint = scene.add.text(
            scene.cameras.main.width  / 2,
            scene.cameras.main.height - 52,
            `[${SHOP_KEY}]  Open Shop`, {
                fontFamily: 'monospace',
                fontSize: '14px',
                color: '#aaffaa',
                backgroundColor: 'rgba(0,0,0,0.55)',
                padding: { x: 10, y: 4 },
            }
        ).setOrigin(0.5, 1).setDepth(HUD_DEPTH).setScrollFactor(0).setVisible(false);

        scene.events.on('update', () => {
            const boat = this.inventory.boat;
            if (!boat) return;
            const dx  = boat.x - shopX;
            const dy  = boat.y - shopY;
            const inRange = (dx * dx + dy * dy) < (90 * 90);
            if (inRange !== this.nearZone) {
                this.nearZone = inRange;
                this._hint.setVisible(inRange);
                if (!inRange && this.isOpen) this.close();
            }
        });
    }

    // Key binding to open/close shop
    _bindKey() {
        const eKey = this.scene.input.keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes[SHOP_KEY]
        );
        eKey.on('down', () => {
            if (this.nearZone) this.isOpen ? this.close() : this.open();
        });
    }

    open() {
        this.isOpen = true;
        this._container.setVisible(true).setAlpha(0).setScale(0.85);
        this._refreshRows();
        this.scene.tweens.add({
            targets:  this._container,
            alpha:    1, scaleX: 1, scaleY: 1,
            duration: 220, ease: 'Back.easeOut',
        });
    }

    close() {
        this.isOpen = false;
        this.scene.tweens.add({
            targets: this._container,
            alpha:0, scaleX: 0.85, scaleY: 0.85,
            duration: 180, ease: 'Quad.easeIn',
            onComplete: () => this._container.setVisible(false),
        });
    }

    // Buying logic with checks and feedback
    _tryBuy(item, btnBg, btnText, btnCx, y, btnW, btnH) {
        const qty   = this.inventory.owned[item.id] || 0;
        const maxed = item.stackable ? qty >= (item.maxStack || 1) : qty >= 1;

        if (maxed) {
            this.inventory.notify('Already maxed out!', '#ff9955');
            shakeText(this.scene, btnText);
            return;
        }
        if (this.inventory.gold < item.cost) {
            this.inventory.notify('Not enough coins!!!', '#ff5555');
            shakeText(this.scene, btnText);
            return;
        }

        this.inventory.spendGold(item.cost);
        this.inventory.owned[item.id] = qty + 1;
        item.effect(this.scene);

        this._refreshRows();
        this.inventory.notify(`Bought: ${item.name}!`, '#aaffaa');
        popTween(this.scene, btnBg);
        popTween(this.scene, btnText);
    }

    // Updates on item quantity changes to refresh owned counts
    _refreshRows() {
        this._itemRows.forEach(({ item, ownedText, btnText }) => {
            const qty    = this.inventory.owned[item.id] || 0;
            const maxed  = item.stackable ? qty >= (item.maxStack || 1) : qty >= 1;
            const afford = this.inventory.gold >= item.cost;
            ownedText.setText(qty > 0 ? `Owned: ${qty}` : '');
            btnText.setStyle({ color: (!afford || maxed) ? '#555522' : '#f7c948' });
        });
    }

    onGoldChanged(gold) {
        if (this._panelGoldText) this._panelGoldText.setText(`${gold}`);
        if (this.isOpen) this._refreshRows();
    }
}