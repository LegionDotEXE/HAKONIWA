const STROKE_WINDOW_MS = 350;
const STROKE_FORCE = 0.3;
const SYNC_WINDOW_MS = 180;
const SYNC_BONUS_FORCE = 0.1;
const TURN_IMPULSE = 0.05;
const PADDLE_METER_Y_OFFSET = 34;
const PADDLE_METER_GAP = 100;
const PADDLE_METER_SLOT_SIZE = 18;
const PADDLE_METER_SLOT_GAP = 8;
const PADDLE_METER_KEYS = {
    left: ['W', 'Q'],
    right: ['O', 'P'],
};

export default class Boat extends Phaser.Physics.Matter.Sprite
{
    constructor(world, x, y, texture, left, right)
    {
        super(world, x, y, texture);
        world.scene.add.existing(this);

        this.setBody({
            type: 'rectangle',
            width: 15,
            height: 25
        });

        this.leftPaddle = world.scene.add.sprite(0, 0, left);
        this.rightPaddle = world.scene.add.sprite(0, 0, right); 

        this.setFrictionAir(0.05);
        this.setMass(15);

        // tracking which direction of the paddle is set before stroking
        this.leftStroke = { firstRole: null, firstTime: 0 };
        this.rightStroke = { firstRole: null, firstTime: 0 };
        // recording the time difference between the end of paddling on both sides 
        this.lastLeft = { time: -9999, dir: 0 };
        this.lastRight = { time: -9999, dir: 0 };

        // paddle cooldown
        this.leftPaddleCooldown = false;
        this.rigthPaddleCooldown = false;

        // create inputs
        this.createInputs();

        // create paddle animations
        this.createAnims(left, right);

        // create stroke timing meters
        this.createPaddleMeters();
    }

    createPaddleMeters()
    {
        const centerX = this.scene.scale.width / 2;
        const y = this.scene.scale.height - PADDLE_METER_Y_OFFSET;

        this.paddleMeters = {
            left: this.createPaddleMeter(centerX - PADDLE_METER_GAP, y, 0x66aaff, PADDLE_METER_KEYS.left),
            right: this.createPaddleMeter(centerX + PADDLE_METER_GAP, y, 0xffcc66, PADDLE_METER_KEYS.right),
        };
    }

    createPaddleMeter(x, y, color, labels)
    {
        const container = this.scene.add.container(x, y)
            .setDepth(30)
            .setScrollFactor(0)
            .setVisible(false);
        const fills = [];

        for (let i = 0; i < 2; i++) {
            const slotX = i * (PADDLE_METER_SLOT_SIZE + PADDLE_METER_SLOT_GAP);
            const bg = this.scene.add.rectangle(slotX, 0, PADDLE_METER_SLOT_SIZE, PADDLE_METER_SLOT_SIZE, 0x0b1824, 0.65)
                .setStrokeStyle(2, 0xffffff, 0.65);
            const fill = this.scene.add.rectangle(slotX, 0, PADDLE_METER_SLOT_SIZE - 6, PADDLE_METER_SLOT_SIZE - 6, color, 1)
                .setVisible(false);
            const label = this.scene.add.text(slotX, 0, labels[i], {
                fontFamily: 'monospace',
                fontSize: '11px',
                color: '#ffffff',
            }).setOrigin(0.5);

            container.add([bg, fill, label]);
            fills.push(fill);
        }

        return { container, fills };
    }

    setPaddleMeter(side, filledKeys)
    {
        const meter = this.paddleMeters[side];
        meter.container.setVisible(filledKeys.length > 0);
        meter.fills.forEach((fill, index) => {
            fill.setVisible(filledKeys.includes(PADDLE_METER_KEYS[side][index]));
        });
    }

    hidePaddleMeter(side)
    {
        this.setPaddleMeter(side, []);
    }

    getPaddleKey(side, role)
    {
        if (side === 'left') {
            return role === 'catch' ? 'Q' : 'W';
        }

        return role === 'catch' ? 'P' : 'O';
    }

    updatePaddleMeterTimeouts()
    {
        const now = this.scene.time.now;

        if (this.leftStroke.firstRole !== null && now - this.leftStroke.firstTime > STROKE_WINDOW_MS) {
            this.leftStroke.firstRole = null;
            this.hidePaddleMeter('left');
        }

        if (this.rightStroke.firstRole !== null && now - this.rightStroke.firstTime > STROKE_WINDOW_MS) {
            this.rightStroke.firstRole = null;
            this.hidePaddleMeter('right');
        }
    }

    // paddle inputs
    createInputs()
    {
        this.keys = this.scene.input.keyboard.addKeys({
            Q: Phaser.Input.Keyboard.KeyCodes.Q,
            W: Phaser.Input.Keyboard.KeyCodes.W,
            O: Phaser.Input.Keyboard.KeyCodes.O,
            P: Phaser.Input.Keyboard.KeyCodes.P,
        });

        this.keys.Q.on('down', () => {
            console.log('Q');
            this.onPaddleKey('left', 'catch');
        });
        this.keys.W.on('down', () => {
            console.log('W');
            this.onPaddleKey('left', 'drive');
        });
        this.keys.P.on('down', () => {
            console.log('P');
            this.onPaddleKey('right', 'catch');
        });
        this.keys.O.on('down', () => {
            console.log('O');
            this.onPaddleKey('right', 'drive');
        });
    }

    // paddle animations
    createAnims(left, right)
    {
        if(!this.scene.anims.exists('left-idle'))
        {
            this.scene.anims.create({
                key: 'left-idle',
                repeat: -1,
                frames: this.scene.anims.generateFrameNumbers(left, {
                    start: 0,
                    end: 0
                })

            });
        }
        if(!this.scene.anims.exists('right-idle'))
        {
            this.scene.anims.create({
                key: 'right-idle',
                repeat: -1,
                frames: this.scene.anims.generateFrameNumbers(right, {
                    start: 0,
                    end: 0
                })

            });
        }
        if(!this.scene.anims.exists('left-forward'))
        {
            this.scene.anims.create({
                key: 'left-forward',
                frameRate: 10,
                repeat: 0,
                frames: this.scene.anims.generateFrameNumbers(left, {
                    start: 5,
                    end: 1
                })

            });
        }
        if(!this.scene.anims.exists('left-backward'))
        {
            this.scene.anims.create({
                key: 'left-backward',
                frameRate: 10,
                repeat: 0,
                frames: this.scene.anims.generateFrameNumbers(left, {
                    start: 1,
                    end: 5
                })

            });
        }
        if (!this.scene.anims.exists('right-forward'))
        {
            this.scene.anims.create({
                key: 'right-forward',
                frameRate: 10,
                repeat: 0,
                frames: this.scene.anims.generateFrameNumbers(right, {
                    start: 5,
                    end: 1
                })

            });
        }
        if (!this.scene.anims.exists('right-backward'))
        {
            this.scene.anims.create({
                key: 'right-backward',
                frameRate: 10,
                repeat: 0,
                frames: this.scene.anims.generateFrameNumbers(right, {
                    start: 1,
                    end: 5
                })

            });
        }
    }

    setPaddlePose(side, role) {
        if(side === 'left') {
            this.leftPaddle.setFrame(role === 'catch' ? 1 : 5);
        } else {
            this.rightPaddle.setFrame(role === 'catch' ? 1 : 5);
        }
    }

    onPaddleKey(side, role) {
        if (side === 'left' && this.leftPaddleCooldown) return;
        if (side === 'right' && this.rigthPaddleCooldown) return;

        this.setPaddlePose(side, role);
        const now = this.scene.time.now;
        const stroke = side === 'left' ? this.leftStroke : this.rightStroke;

        if (stroke.firstRole === null || now - stroke.firstTime > STROKE_WINDOW_MS) {
            stroke.firstRole = role;
            stroke.firstTime = now;
            this.setPaddleMeter(side, [this.getPaddleKey(side, role)]);
            return;
        }

        if (stroke.firstRole === role) {
            stroke.firstTime = now;
            this.setPaddleMeter(side, [this.getPaddleKey(side, role)]);
            return;
        }

        const dir = stroke.firstRole === 'catch' ? 1 : -1;
        const firstKey = this.getPaddleKey(side, stroke.firstRole);
        const secondKey = this.getPaddleKey(side, role);
        stroke.firstRole = null;
        this.setPaddleMeter(side, [firstKey, secondKey]);
        this.scene.time.delayedCall(160, () => this.hidePaddleMeter(side));

        if (side === 'left') this.leftPaddleCooldown = true;
        if (side === 'right') this.rigthPaddleCooldown = true;

        this.playStrokeAnims(side, dir);
        this.completeStroke(side, now, dir);
    }

    playStrokeAnims(side, dir)
    {
        const paddle = side === 'left' ? this.leftPaddle : this.rightPaddle;
        const animKey = side === 'left' 
            ? (dir === 1 ? 'left-backward' : 'left-forward') 
            : (dir === 1 ? 'right-backward' : 'right-forward');

        paddle.play(animKey, true);
        paddle.once('animationcomplete', () => {
            paddle.setFrame(0);
            if (side === 'left') this.leftPaddleCooldown = false;
            if (side === 'right') this.rigthPaddleCooldown = false;
        });
    }

    completeStroke(side, now, dir)
    {
        console.log('stroke complete');
        const angle = this.rotation - Math.PI / 2;
        const forwardX = Math.cos(angle);
        const forwardY = Math.sin(angle);

        if (side === 'left') {
            this.setAngularVelocity(this.body.angularVelocity + dir * TURN_IMPULSE);
            this.lastLeft = { time: now, dir };
        } else {
            this.setAngularVelocity(this.body.angularVelocity - dir * TURN_IMPULSE);
            this.lastRight = { time: now, dir };
        }

        const other = side === 'left' ? this.lastRight : this.lastLeft;
        const synced = now - other.time < SYNC_WINDOW_MS && other.dir === dir;
        
        // see split 3 notes to understand the rotation movement
        if (synced) {
            const totalForce = STROKE_FORCE * 0.2 + SYNC_BONUS_FORCE;

            this.applyForce({
                x: forwardX * totalForce * dir,
                y: forwardY * totalForce * dir
            });

            this.setAngularVelocity(this.body.angularVelocity * 0.3);
        }

        if (this.scene.inventory) this.scene.inventory.onStroke();
    }

    update()
    {
        this.updatePaddleMeterTimeouts();

        const sideOffset = 16;

        // see split 3 notes to understand the mathematical offset of the boat
        const boatRotation = this.rotation;          // visual rotation of the boat
        const heading = boatRotation - Math.PI / 2;  // mathematical heading (bow)

        this.leftPaddle.x = this.x + Math.cos(heading - Math.PI / 2) * sideOffset;
        this.leftPaddle.y = this.y + Math.sin(heading - Math.PI / 2) * sideOffset;

        this.rightPaddle.x = this.x + Math.cos(heading + Math.PI / 2) * sideOffset;
        this.rightPaddle.y = this.y + Math.sin(heading + Math.PI / 2) * sideOffset;

        // 3. Keep paddle rotation matching the boat
        this.leftPaddle.rotation = boatRotation;
        this.rightPaddle.rotation = boatRotation;
    }
}
