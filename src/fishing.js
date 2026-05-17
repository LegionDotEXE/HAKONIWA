const BITE_MIN_MS         = 2000;
const BITE_MAX_MS         = 7000;
const PREP_DELAY_MS       = 1000;
// Minigame consts
const PANEL_X             = 630;
const PANEL_Y             = 100;
const TRACK_W             = 34;
const TRACK_H             = 260;
const SUCCESS_ZONE_H      = 60;
const INDICATOR_H         = 12;
const INDICATOR_SPEED     = 2.5;
const MAX_OSCILLATIONS    = 5;
const BITE_ICON_OFFSET_Y  = -40;

export default class FishingSystem {
    constructor(scene, boat) {
        this.scene      = scene;
        this.boat       = boat;
        this.fishing    = false;
        this.fishCaught = 0;
        this.minigame   = false;
        this._biting    = false;
        this.baseSpeed = 3.2; 
        this.currentSpeed = this.baseSpeed;


        this._hint = scene.add.text(0, 0, '[F] Fish', {
            fontFamily: 'monospace', fontSize: '13px', color: '#88ccff',
            backgroundColor: 'rgba(0,0,0,0.45)', padding: { x: 8, y: 3 },
        }).setOrigin(0.5, 1).setDepth(20).setVisible(false);

        this._result = scene.add.text(scene.scale.width / 2, scene.scale.height / 2 - 30, '', {
            fontFamily: 'monospace', fontSize: '18px', color: '#ffffff',
            stroke: '#000000', strokeThickness: 3,
            backgroundColor: 'rgba(0,0,0,0.55)', padding: { x: 14, y: 7 },
        }).setOrigin(0.5).setDepth(25).setScrollFactor(0).setVisible(false);

        this._counter = scene.add.text(12, 12, 'Fish: 0', {
            fontFamily: 'monospace', fontSize: '14px', color: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.45)', padding: { x: 8, y: 4 },
        }).setDepth(20).setScrollFactor(0);

        this._biteIcon = scene.add.text(0, 0, '!', {
            fontFamily: 'monospace', fontSize: '20px', color: '#ffcc44',
            stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5, 0.5).setDepth(26).setVisible(false);

        this._buildPanel();
        this._fKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
        this._fKey.on('down', () => this._onFDown());
        scene.events.on('update', () => this._update());
    }

    _onFDown() {
        // if you are not on the fish tile, you can't fish
        if (!this.scene.canFish && !this.fishing && !this.minigame) return;

        if (!this.fishing && !this.minigame) {
            this.fishing = true;
            this._hint.setText('[F] Reel in');
            const delay = Phaser.Math.Between(BITE_MIN_MS, BITE_MAX_MS);
            this._biteTimer = this.scene.time.delayedCall(delay, () => this._onBite());
        } else if (this.fishing && !this.minigame && !this._biting) {
            this._biteTimer.remove();
            this._end(null);
        } else if (this.minigame) {
            this._attemptCatch();
        }
    }

    _onBite() {
        this._biting = true;
        this._hint.setText('Bite!');

        this._biteIcon.setVisible(true);
        this._biteIcon.setPosition(this.boat.x, this.boat.y + BITE_ICON_OFFSET_Y);
        this.scene.tweens.add({
            targets: this._biteIcon,
            scaleX: 1.4, scaleY: 1.4,
            duration: 200, yoyo: true, repeat: 2,
            ease: 'Sine.easeOut',
        });

        this._prepTimer = this.scene.time.delayedCall(PREP_DELAY_MS, () => this._startMinigame());
    }

    _attemptCatch() {
        const indicatorCenter = this._indicatorY + INDICATOR_H / 2;
        const zoneTop = this._zoneY;
        const zoneBot = this._zoneY + SUCCESS_ZONE_H;
        if (indicatorCenter >= zoneTop && indicatorCenter <= zoneBot) {
            this._end(true);
        } else {
            this._end(false);
        }
    }

    _end(caught) {
        // if (this._biteTimer) { this._biteTimer.remove(); this._biteTimer = null; }
        // if (this._prepTimer) { this._prepTimer.remove(); this._prepTimer = null; }
        const fish = this.scene.currentFish;

        if (fish) {
            fish.isCoolingDown = true;

            // set anims frame to idle
            fish.anims.stop();
            const idleFrame = (fish.name === 'red_fish') ? 96 : 114;
            fish.setFrame(idleFrame);

            if (fish.body) {
                this.scene.matter.world.remove(fish.body);
            }
            
            // cooldown for fishing
            this.scene.time.delayedCall(fish.delayTime, () => {
                if (fish.active) {
                    fish.isCoolingDown = false;

                    this.scene.matter.add.gameObject(fish, {
                        isStatic: true,
                        isSensor: true,
                        label: 'fish',
                        shape: { type: 'rectangle', width: 64, height: 64 }
                    });

                    const anim = (fish.name === 'red_fish') ? 'redFishJump' : 'greenFishJump';
                    fish.play(anim);
                }
            });
        }

        this.fishing  = false;
        this._biting  = false;
        this.minigame = false;
        this._panel.setVisible(false);
        this._biteIcon.setVisible(false);

        this._hint.setText('[F] Fish');

        if (caught === true) {
            this.fishCaught++;
            this._counter.setText(`Fish: ${this.fishCaught}`);
            this._showResult('Fish caught!', '#55ff55');
        } else if (caught === false) {
            this._showResult('Fish got away!', '#ff5555');
        }
    }

    _showResult(msg, color) {
        this._result.setText(msg).setStyle({ color }).setVisible(true);
        this.scene.time.delayedCall(2000, () => this._result.setVisible(false));
    }

        _buildPanel() {
        const s  = this.scene;
        const pw = TRACK_W + 16;
        const ph = TRACK_H + 16;

        this._panel = s.add.container(PANEL_X, PANEL_Y)
            .setDepth(25).setScrollFactor(0).setVisible(false);

        const bg = s.add.graphics();
        bg.fillStyle(0x111122, 0.88);
        bg.fillRoundedRect(0, 0, pw, ph, 8);
        bg.lineStyle(2, 0x4488cc, 0.9);
        bg.strokeRoundedRect(0, 0, pw, ph, 8);

        const track = s.add.graphics();
        track.fillStyle(0x1a2a3a, 1);
        track.fillRect(8, 8, TRACK_W, TRACK_H);

        this._zoneGfx      = s.add.graphics();
        this._indicatorGfx = s.add.graphics();

        this._panel.add([bg, track, this._zoneGfx, this._indicatorGfx]);
    }

    _startMinigame() {
        this.fishing  = false;
        this._biting  = false;
        this.minigame = true;
        this._hint.setText('[F] Catch!');
        this._biteIcon.setVisible(false);

        const trackTop = 8;
        const trackBot = 8 + TRACK_H;
        this._zoneY        = Phaser.Math.Between(trackTop, trackBot - SUCCESS_ZONE_H);
        this._indicatorY   = trackTop;
        this._indicatorDir = 1;
        this._oscillations = 0;
        this._lastDir      = this._indicatorDir;

        if (this.scene.currentFish) {
            const fish = this.scene.currentFish;
            this.currentSpeed = this.baseSpeed + (fish.catchTime / 1000);
        } else {
            this.currentSpeed = this.baseSpeed;
        }

        this._panel.setVisible(true);
    }

    _update() {
        if (this._biteIcon.visible) {
            this._biteIcon.setPosition(this.boat.x, this.boat.y + BITE_ICON_OFFSET_Y);
        }

        if (!this.minigame) return;

        const trackTop = 8;
        const trackBot = 8 + TRACK_H;

        this._indicatorY += this._indicatorDir * this.currentSpeed;

        if (this._indicatorY <= trackTop) {
            this._indicatorY   = trackTop;
            this._indicatorDir = 1;
        } else if (this._indicatorY >= trackBot - INDICATOR_H) {
            this._indicatorY   = trackBot - INDICATOR_H;
            this._indicatorDir = -1;
        }

        if (this._indicatorDir !== this._lastDir) {
            this._oscillations++;
            this._lastDir = this._indicatorDir;
            if (this._oscillations >= MAX_OSCILLATIONS * 2) { this._end(false); return; }
        }

        this._drawPanel();
    }

    _drawPanel() {
        const indicatorCenter = this._indicatorY + INDICATOR_H / 2;
        const inZone = indicatorCenter >= this._zoneY && indicatorCenter <= this._zoneY + SUCCESS_ZONE_H;

        this._zoneGfx.clear();
        this._zoneGfx.fillStyle(0x44ee66, 0.75);
        this._zoneGfx.fillRect(8, this._zoneY, TRACK_W, SUCCESS_ZONE_H);
        this._zoneGfx.lineStyle(1.5, 0x88ffaa, 1);
        this._zoneGfx.strokeRect(8, this._zoneY, TRACK_W, SUCCESS_ZONE_H);

        this._indicatorGfx.clear();
        this._indicatorGfx.fillStyle(inZone ? 0xffffff : 0x66aaff, 1);
        this._indicatorGfx.fillRect(8, this._indicatorY, TRACK_W, INDICATOR_H);
        this._indicatorGfx.lineStyle(1.5, inZone ? 0xaaffcc : 0x2288cc, 1);
        this._indicatorGfx.strokeRect(8, this._indicatorY, TRACK_W, INDICATOR_H);
    }

    updateUI(canFish) {
        if (this.fishing || this.minigame) {
            this._hint.setVisible(true);
            this._hint.setPosition(this.boat.x, this.boat.y - 45);
        } else if (canFish && this.scene.currentFish) {
            this._hint.setVisible(true);
            const fish = this.scene.currentFish;
            this._hint.setPosition(fish.x, fish.y - 40);
            this._hint.setText('[F] Fish');
        } else {
            this._hint.setVisible(false);
        }
    }

    cancelFishing() {
        if (this.fishing || this.minigame) {
            this._end(null);
            this._showResult('Too far away!', '#ffaa00');
        }
    }

}
