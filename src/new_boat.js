const STROKE_WINDOW_MS = 350;
const STROKE_FORCE = 0.3;
const SYNC_WINDOW_MS = 180;
const SYNC_BONUS_FORCE = 0.1;
const TURN_IMPULSE = 0.05;

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
            return;
        }

        if (stroke.firstRole === role) {
            stroke.firstTime = now;
            return;
        }

        const dir = stroke.firstRole === 'catch' ? 1 : -1;
        stroke.firstRole = null;

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