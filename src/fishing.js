const BITE_MIN_MS     = 2000;
const BITE_MAX_MS     = 7000;
const CATCH_WINDOW_MS = 800;

export default class FishingSystem {
    constructor(scene, boat) {
        this.scene      = scene;
        this.boat       = boat;
        this.fishing    = false;
        this.fishCaught = 0;  

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

        const F = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
        F.on('down', () => this._onF());
    }

    _onF() {
        if (!this.fishing) {
            this.fishing = true;
            this._hint.setText('[F] Reel in');

            const delay = Phaser.Math.Between(BITE_MIN_MS, BITE_MAX_MS);
            this._biteTimer = this.scene.time.delayedCall(delay, () => {
                this._biting = true;
                this._hint.setText('[F] Catch it!');
                this._catchTimeout = this.scene.time.delayedCall(CATCH_WINDOW_MS, () => {
                    this._end(false);
                });
            });

        } else if (this._biting) {
            this._catchTimeout.remove();
            this._end(true);

        } else {
            this._biteTimer.remove();
            this._end(null);  
        }
    }

    _end(caught) {
        this.fishing = false;
        this._biting = false;
        this._hint.setText('[F] Fish');

        if (caught === true) {
            this.fishCaught++;
            this._counter.setText(`Fish: ${this.fishCaught}`);
            this._showResult('✓ Fish caught!', '#55ff55');
        } else if (caught === false) {
            this._showResult('✗ Fish got away!', '#ff5555');
        }
    }

    _showResult(msg, color) {
        this._result.setText(msg).setStyle({ color }).setVisible(true);
        this.scene.time.delayedCall(2000, () => this._result.setVisible(false));
    }
}
