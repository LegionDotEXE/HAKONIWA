const BITE_MIN_MS     = 2000;
const BITE_MAX_MS     = 7000;
// Minigame consts
const PANEL_X         = 630;
const PANEL_Y         = 100;
const TRACK_W         = 34;
const TRACK_H         = 260;
const BAR_H           = 72;
const FISH_SIZE       = 14;
const BAR_RISE        = 3.2;
const BAR_FALL        = 1.8;
const FISH_SPEED_MIN  = 1.2;
const FISH_SPEED_MAX  = 2.8;
const FISH_CHANGE_MIN = 400;
const FISH_CHANGE_MAX = 1200;
const PROGRESS_FILL   = 1.2;
const PROGRESS_DRAIN  = 0.8;

export default class FishingSystem {
    constructor(scene, boat) {
        this.scene      = scene;
        this.boat       = boat;
        this.fishing    = false;
        this.fishCaught = 0;  
        this.minigame   = false;
        this._biting    = false;


        this._hint = scene.add.text(scene.scale.width / 2, scene.scale.height - 24, '[F] Fish', {
            fontFamily: 'monospace', fontSize: '13px', color: '#88ccff',
            backgroundColor: 'rgba(0,0,0,0.45)', padding: { x: 8, y: 3 },
        }).setOrigin(0.5, 1).setDepth(20).setScrollFactor(0);

        this._result = scene.add.text(scene.scale.width / 2, scene.scale.height / 2 - 30, '', {
            fontFamily: 'monospace', fontSize: '18px', color: '#ffffff',
            stroke: '#000000', strokeThickness: 3,
            backgroundColor: 'rgba(0,0,0,0.55)', padding: { x: 14, y: 7 },
        }).setOrigin(0.5).setDepth(25).setScrollFactor(0).setVisible(false);

        this._counter = scene.add.text(12, 12, 'Fish: 0', {
            fontFamily: 'monospace', fontSize: '14px', color: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.45)', padding: { x: 8, y: 4 },
        }).setDepth(20).setScrollFactor(0);

        this._buildPanel();
        this._fKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
        this._fKey.on('down', () => this._onFDown());
        scene.events.on('update', () => this._update());
    }

    _onFDown() {
        if (!this.fishing && !this.minigame) {
            this.fishing = true;
            this._hint.setText('[F] Reel in');
            const delay = Phaser.Math.Between(BITE_MIN_MS, BITE_MAX_MS);
            this._biteTimer = this.scene.time.delayedCall(delay, () => this._startMinigame());
        } else if (this.fishing && !this.minigame) {
            this._biteTimer.remove();
            this._end(null);
        }
    }

    _end(caught) {
        this.fishing = false;
        this._biting = false;
        this.minigame = false;
        this._panel.setVisible(false);

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
 
        const progBg = s.add.graphics();
        progBg.fillStyle(0x332222, 1);
        progBg.fillRect(-10, 8, 6, TRACK_H);
 
        this._progGfx  = s.add.graphics();
        this._catchBar = s.add.graphics();
        this._fishIcon = s.add.graphics();
 
        this._panel.add([bg, track, progBg, this._progGfx, this._catchBar, this._fishIcon]);
    }
 
    _startMinigame() {
        this.fishing  = false;
        this.minigame = true;
        this._hint.setText('Catch!');
 
        this._barY       = 8 + TRACK_H / 2 - BAR_H / 2;
        this._fishY      = 8 + TRACK_H / 2;
        this._fishVel    = Phaser.Math.FloatBetween(FISH_SPEED_MIN, FISH_SPEED_MAX) * (Math.random() < 0.5 ? 1 : -1);
        this._progress   = 50;
        this._nextChange = this.scene.time.now + Phaser.Math.Between(FISH_CHANGE_MIN, FISH_CHANGE_MAX);
 
        this._panel.setVisible(true);
    }
 
    _update() {
        if (!this.minigame) return;
 
        const now      = this.scene.time.now;
        const trackTop = 8;
        const trackBot = 8 + TRACK_H;
 
        this._barY += this._fKey.isDown ? -BAR_RISE : BAR_FALL;
        this._barY = Phaser.Math.Clamp(this._barY, trackTop, trackBot - BAR_H);
 
        if (now >= this._nextChange) {
            this._fishVel = Phaser.Math.FloatBetween(FISH_SPEED_MIN, FISH_SPEED_MAX) * (Math.random() < 0.5 ? 1 : -1);
            if (Math.random() < 0.25) this._fishVel *= 1.8;
            this._nextChange = now + Phaser.Math.Between(FISH_CHANGE_MIN, FISH_CHANGE_MAX);
        }
        this._fishY = Phaser.Math.Clamp(this._fishY + this._fishVel, trackTop + FISH_SIZE / 2, trackBot - FISH_SIZE / 2);
        if (this._fishY <= trackTop + FISH_SIZE / 2 || this._fishY >= trackBot - FISH_SIZE / 2) this._fishVel *= -1;
 
        const catching = this._fishY >= this._barY && this._fishY <= this._barY + BAR_H;
        this._progress = Phaser.Math.Clamp(this._progress + (catching ? PROGRESS_FILL : -PROGRESS_DRAIN), 0, 100);
 
        if (this._progress >= 100) { this._end(true);  return; }
        if (this._progress <= 0)   { this._end(false); return; }
 
        this._drawPanel(catching);
    }
 
    _drawPanel(catching) {
        const trackTop = 8;
 
        this._progGfx.clear();
        const fillH   = (this._progress / 100) * TRACK_H;
        const fillCol = this._progress > 60 ? 0x44ff66 : this._progress > 30 ? 0xffcc22 : 0xff4422;
        this._progGfx.fillStyle(fillCol, 1);
        this._progGfx.fillRect(-10, trackTop + TRACK_H - fillH, 6, fillH);
 
        this._catchBar.clear();
        this._catchBar.fillStyle(catching ? 0x44ee66 : 0x2288cc, 0.75);
        this._catchBar.fillRect(8, this._barY, TRACK_W, BAR_H);
        this._catchBar.lineStyle(1.5, catching ? 0x88ffaa : 0x66aaff, 1);
        this._catchBar.strokeRect(8, this._barY, TRACK_W, BAR_H);
 
        this._fishIcon.clear();
        this._fishIcon.fillStyle(0xffcc44, 1);
        this._fishIcon.fillCircle(8 + TRACK_W / 2, this._fishY, FISH_SIZE / 2);
        this._fishIcon.fillStyle(0xff8800, 1);
        this._fishIcon.fillTriangle(
            8 + TRACK_W / 2 - 7, this._fishY,
            8 + TRACK_W / 2 - 12, this._fishY - 5,
            8 + TRACK_W / 2 - 12, this._fishY + 5
        );
    }

}
