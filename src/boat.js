const STROKE_WINDOW_MS = 350;
const STORKE_IMPULSE = 110;
const STNC_WINDOW_MS = 180;
const SYNC_BONUS = 70;
const TURN_IMPULSE = 0.06;
const WATER_DRAG = 0.98;
const TRUN_DRAG = 0.9;

const LEFT_CATCH = -Math.PI/4;
const RIGHT_CATCH = Math.PI/4;
const LEFT_DRIVE = -3*Math.PI/4;
const RIGHT_DRIVE = 3*Math.PI/4;
const INPUT_DISPLAY_MS = 1000;

export default class Boat extends Phaser.Scene {
    constructor() {
        super('Boat');
    }

    create() {
        this.drawWater();

        this.boat = this.add.container(this.scale.width/2, this.scale.height/2);
        const hull = this.add.ellipse(0, 0, 70, 28, 0x8b5a2b).setStrokeStyle(2, 0x3e2410);
        const deck = this.add.ellipse(0, 0, 56, 16, 0xc89060);

        this.leftOar = this.add.rectangle(0, -10, 44, 4, 0xddc28a).setOrigin(0.15, 0.5);
        this.rightOar = this.add.rectangle(0, 10, 44, 4, 0xddc28a).setOrigin(0.15, 0.5);
        this.leftOar.rotation = LEFT_DRIVE;
        this.rightOar.rotation = RIGHT_DRIVE;
        this.boat.add([hull, deck, this.leftOar, this.rightOar]);

        this.velocity = new Phaser.Math.Vector2(0, 0);
        this.angularVelocity = 0;

        this.leftStroke = { firstRole: null, firstTime: 0 };
        this.rightStroke = { firstRole: null, firstTime: 0 };
        this.lastLeft = { time: -9999, dir: 0 };
        this.lastRight = { time: -9999, dir: 0 };
        this.inputSequence = '';
        this.lastInputAt = -9999;
        this.inputText = this.add.text(this.scale.width / 2, this.scale.height - 24, '', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '22px',
            color: '#ffffff',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            padding: { x: 10, y: 4 },
        }).setOrigin(0.5, 1).setDepth(10);

        this.keys = this.input.keyboard.addKeys({
            Q: Phaser.Input.Keyboard.KeyCodes.Q,
            W: Phaser.Input.Keyboard.KeyCodes.W,
            O: Phaser.Input.Keyboard.KeyCodes.O,
            P: Phaser.Input.Keyboard.KeyCodes.P,
        });

        this.keys.Q.on('down', () => {
            this.showInput('Q');
            this.onOarKey('left', 'catch');
        });
        this.keys.W.on('down', () => {
            this.showInput('W');
            this.onOarKey('left', 'drive');
        });
        this.keys.P.on('down', () => {
            this.showInput('P');
            this.onOarKey('right', 'catch');
        });
        this.keys.O.on('down', () => {
            this.showInput('O');
            this.onOarKey('right', 'drive');
        });
    }

    drawWater() {
        const g = this.add.graphics();
        g.fillStyle(0x001144, 1);
        g.fillRect(0, 0, this.scale.width, this.scale.height);
    }

    setOarPose(side, role) {
        if(side === 'left') {
            this.leftOar.rotation = role === 'catch' ? LEFT_CATCH : LEFT_DRIVE;
        } else {
            this.rightOar.rotation = role === 'catch' ? RIGHT_CATCH : RIGHT_DRIVE;
        }
    }

    showInput(keyName) {
        const now = this.time.now;
        if (now - this.lastInputAt > INPUT_DISPLAY_MS) {
            this.inputSequence = keyName;
        } else {
            this.inputSequence += `+${keyName}`;
        }
        this.lastInputAt = now;
        this.inputText.setText(this.inputSequence);
    }

    onOarKey(side, role) {
        this.setOarPose(side, role);
        const now = this.time.now;
        const stroke = side === 'left' ? this.leftStroke : this.rightStroke;

        if(stroke.firstRole === null || now - stroke.firstTime > STROKE_WINDOW_MS) {
            stroke.firstRole = role;
            stroke.firstTime = now;
            return;
        }
        const dir = stroke.firstRole === 'catch' ? 1 : -1;
        stroke.firstRole = null;
        this.completeStroke(side, now, dir);
    }

    completeStroke(side, now, dir) {
        const angle = this.boat.rotation;
        const forwardX = Math.cos(angle);
        const forwardY = Math.sin(angle);

        if (side === 'left') {
            this.angularVelocity += dir * TURN_IMPULSE;
            this.lastLeft = { time: now, dir };
        } else {
            this.angularVelocity -= dir * TURN_IMPULSE;
            this.lastRight = { time: now, dir };
        }

        const other = side === 'left' ? this.lastRight : this.lastLeft;
        const synced = now - other.time < STNC_WINDOW_MS && other.dir === dir;
        if (synced) {
            const totalImpulse = STORKE_IMPULSE + SYNC_BONUS;
            this.velocity.x += forwardX * totalImpulse * 0.016 * dir;
            this.velocity.y += forwardY * totalImpulse * 0.016 * dir;
            this.angularVelocity *= 0.3;
        }
    }

    update() {
        if (this.inputSequence && this.time.now - this.lastInputAt > INPUT_DISPLAY_MS) {
            this.inputSequence = '';
            this.inputText.setText('');
        }

        this.boat.x += this.velocity.x;
        this.boat.y += this.velocity.y;
        this.boat.rotation += this.angularVelocity;

        this.velocity.x *= WATER_DRAG;
        this.velocity.y *= WATER_DRAG;
        this.angularVelocity *= TRUN_DRAG;

        const w = this.scale.width;
        const h = this.scale.height;
        if (this.boat.x < 0) this.boat.x = w;
        if (this.boat.x > w) this.boat.x = 0;
        if (this.boat.y < 0) this.boat.y = h;
        if (this.boat.y > h) this.boat.y = 0;
    }
}