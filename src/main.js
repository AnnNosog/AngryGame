
// прототип геймплея

options.__soundDisabled = 0;

var level
    , rubber
    , ball
    , fader
    , boost
    , blocks = []
    , shots = 0
    , shotsLabel
    , currentLevel = 1
    , MAX_LEVEL = 3
    , aimDots = []
    , big_blocks = 0;

function looperPostOne(f, delay) {
    if (f.__posted > 0) {
        f.__posted = _clearTimeout(f.__posted);
    }

    if (!f.__posted) {
        if (delay) {
            f.__posted = _setTimeout(() => {
                f.__posted = 0;
                f();
            }, delay);
        } else {
            f.__posted = -1;
            looperPost(() => {
                f.__posted = 0;
                f();
            });
        };
    }
}

function relImpactSpeed(bodyA, bodyB) {
    var va = bodyA.velocity, vb = bodyB.velocity
        , v = new Vector2(va.x - vb.x, va.y - vb.y);
    return v.__length();
}

function addBreakBlock(x, y, velocity) {
    var s = randomFloat(SHARD_SIZE_MIN, SHARD_SIZE_MAX);
    var break_block = level.__addChildBox({
        __img: 'new_break_' + randomInt(1, 9),
        __ofs: [x, y, -20],
        __size: [s, s],
        __rotate: randomInt(0, 360),
        __physics: SHARD_PHYSICS
    });
    looperPost(a => {
        if (break_block.__ph_body) {
            //выключаем столкновения осколков, но сохраняем разлёт
            break_block.__ph_body.collisionFilter.mask = 0;

            ph_Body.setVelocity(break_block.__ph_body, new Vector2(
                randomFloat(SHARD_VELOCITY_X[0], SHARD_VELOCITY_X[1]),
                randomFloat(SHARD_VELOCITY_Y[0], SHARD_VELOCITY_Y[1]))
            );
            _setTimeout(() => {
                if (break_block.__ph_body) {

                    _setTimeout(() => {
                        if (!break_block.__destructed) {
                            removeBlock(break_block);
                        }
                    }, randomFloat(SHARD_LIFETIME_MIN, SHARD_LIFETIME_MAX));
                }
            }, 1);
        }
    });
}

function awakeBlocks() {

    $each(blocks, b => {
        b.__ph_awake();
    });
}

function removeBlock(block) {
    removeFromArray(block, blocks);
    var size = block.__size, v = block.__ph_body.velocity;

    block.__removeFromParent();

    looperPostOne(awakeBlocks);

    if (block.__needBreaks) {

        playSound('new_break_' + randomInt(1, 4), 0, 0, 0.5);

        var step = SHARD_STEP,
            centerX = block.__x,
            centerY = block.__y;
        var a = (block.__rotate || 0) * DEG2RAD;
        var sa = sin(a);
        var ca = cos(a);

        // todo: не учитывается вращение блока
        for (var x = 0; x < size.x; x += step) {
            for (var y = 0; y < size.y; y += step) {
                var localX = x - size.x / 2 + step / 2;
                var localY = y - size.y / 2 + step / 2;

                var worldX = centerX + localX * ca + localY * sa;
                var worldY = centerY - localX * sa + localY * ca;

                addBreakBlock(worldX, worldY, v);
            }
        }

        big_blocks--;
        if (big_blocks == 0) {
            _setTimeout(() => {
                var stars = calculateStars(currentLevel, shots);
                show_win(stars);
            }, 1);
        }
    } else {
        if (random() > 0.5 && !windowManager.__hasOpenedWindow()) {
            playSound('new_break_' + randomInt(1, 4), 0, 0, 0.5);
        }
    }
}

// пороги STAR_THRESHOLDS для звёзд берём из config.js
function calculateStars(levelNum, shotsCount) {
    var thresholds = STAR_THRESHOLDS[levelNum] || DEFAULT_THRESHOLDS;
    if (shotsCount <= thresholds[0]) return 3;
    if (shotsCount <= thresholds[1]) return 2;
    return 1;
}

function initCollision(body, node, hp) {
    blocks.push(node);
    body.__hp = hp;
    body.__onCollision = (speed) => {
        // урон мяча от скорости
        var dmg = floor(clamp((speed - DMG_SPEED_THRESHOLD) * DMG_MULT, 0, DMG_MAX));
        if (dmg && body.__hp) {
            // consoleLog('damage', dmg);
            body.__hp = mmax(0, body.__hp - dmg);
            if (!body.__hp) {
                body.__onCollision = 0;
                looperPost(a => {
                    removeBlock(node);
                });
            }
        }
    }
}

function show_win(stars) {

    playSound('win');
    var isLast = currentLevel >= MAX_LEVEL;
    // todo: посчитать очки игрока и выдать звезды
    showWindow('win', wnd => {

        wnd.__closeAnimation = function () {
            wnd.__anim({ sva: 0.6, sha: 0.6 }, 0.2, 0, easeBackI);
            wnd.__anim({ __alphaDeep: 0 }, 0.2, 0, easeQuadIO);

            _setTimeout(() => {
                wnd.__realClose();
            }, 0.2)
        }

        var onRetry = function () {
            wnd.__close();
            transitionTo(restartLevel);
            // _setTimeout(() => {
            //     transitionTo(restartLevel);
            // }, 0.1)
        };

        wnd.__setAliasesData({

            star_1: { __visible: stars >= 1 },
            star_2: { __visible: stars >= 2 },
            star_3: { __visible: stars >= 3 },

            button: {
                __onTap: onRetry,
                __onTapHighlight: 1,
                __visible: !isLast
            },

            btn_finish_try: {
                __onTap: onRetry,
                __onTapHighlight: 1,
                __visible: isLast
            },

            btn_next: {
                __onTap() {
                    wnd.__close();
                    transitionTo(nextLevel);
                },
                __onTapHighlight: 1,
                __visible: !isLast
            }
        })
    })

}

function initCollisionHandler() {
    if (ph_Events.__collisionBounds) return;
    ph_Events.__collisionBounds = 1;
    ph_Events.on(ph_Engine, 'collisionStart', (event) => {
        var pairs = event.pairs, i, pair, bodyA, bodyB, speed;
        for (i = 0; i < pairs.length; i++) {
            pair = pairs[i];
            bodyA = pair.bodyA;
            bodyB = pair.bodyB;
            speed = relImpactSpeed(bodyA, bodyB);

            if (bodyA && bodyA.__onCollision) bodyA.__onCollision(speed);
            if (bodyB && bodyB.__onCollision) bodyB.__onCollision(speed);
        }
    });
}

function restartLevel() {
    if (level) level.__removeFromParent();
    if (shotsLabel) {
        shotsLabel.__removeFromParent();
        shotsLabel = 0;
    };

    blocks.length = 0;
    big_blocks = 0;
    shots = 0;

    initLevel();
}

function addFaderToLevel(alpha) {
    fader = level.__addChildBox({
        __color: 0,
        __alpha: alpha,
        sha: 1,
        sva: 1,
        __size: [3000, 2000],
        __ofs: [0, 0, -9000]
    });

    fader.update(1);
}

function transitionTo(action) {
    addFaderToLevel(0);
    fader.__anim({ __alpha: 1 }, 0.2, 0, easeQuadIO);

    _setTimeout(() => {
        action();
        addFaderToLevel(1);

        _setTimeout(() => {
            fader.__anim({ __alpha: 0 }, .2, 0, easeQuadIO);
        }, .1);

    }, 0.2);
}

function initLevel() {

    // добавляем первый уровень на сцену
    level = scene
        .__addChildBox('level_' + currentLevel)
        .__setAliasesData({

            rubber(node) {
                rubber = node;
            },

            ball(node) {
                ball = node;
            },

            boost(node) {
                boost = node;
            },

            userInputArea: {
                __dragDist: 1,
                __drag(x, y, dx, dy) {
                    // натягиваем резинку
                    var dmouse = this.__dmouse = this.__worldPosition.__clone().sub(new Vector2(x, y));
                    rubber.__parent.__rotate = -dmouse.__angle() * RAD2DEG;
                    rubber.__width = Math.min(dmouse.__length() * 0.5, 100);

                    ball.__x = -rubber.__width + 7;

                    var rubberPosition = rubber.__worldPosition;
                    var predictedVel = dmouse.__clone().__multiplyScalar(BULLET_LAUNCH_POWER);
                    updateAimDots(rubberPosition.x, rubberPosition.y, predictedVel);
                },
                __dragStart() {
                    rubber.__killAllAnimations();
                },
                __dragEnd() {

                    // скрываем предполагаемую траекторию мяча
                    for (let index = 0; index < aimDots.length; index++) {
                        aimDots[index].__alpha = 0;
                    }

                    shots++;
                    updateShotsLabel();
                    playSound('punch');

                    ball.__visible = false;

                    _setTimeout(() => {
                        ball.__x = 0;
                        ball.__visible = true;
                    }, .4);

                    // отпускаем резинку
                    rubber.__anim({
                        __width: 7
                    }, 0.4, 0, easeElasticO);
                    var wp = rubber.__worldPosition;
                    var velocity = this.__dmouse.__multiplyScalar(BULLET_LAUNCH_POWER);
                    createBullet(wp.x, wp.y, velocity, 1);
                }
            }
        });

    _setTimeout(a => {
        level.update(1);

        initCollisionHandler();
        updateShotsLabel();

        // проходим по уровню и инициализируем блоки
        level.__traverse(node => {
            var body = node.__ph_body;
            if (body && !body.isStatic) { // this is block
                node.__needBreaks = 1;
                big_blocks++;
                initCollision(body, node, BLOCK_HP);

                // усыпляем блоки, чтобы не дёргались от зазоров/нахлёстов при старте
                node.__ph_sleep();
            }
        });

        createAimDots();

    }, 0.01);
}

function createBullet(x, y, velocity, canBoost) {
    var bullet = level.__addChildBox({
        __effect: 'tail',
        __img: 'ball',
        __size: BULLET_SIZE,
        __ofs: [x, y, -10],
        __physics: BULLET_PHYSICS
    }).update();

    if (bullet.__ph_body) {
        ph_Body.setVelocity(bullet.__ph_body, velocity);
    }

    if (boost && canBoost) {
        // пролёт мяча через буст ловим проверкой дистанции каждый кадр
        // не используем isSensor, так как плохо работает с большими скоростями (проскок между кадрами)
        var boostChecker = () => {
            if (!bullet.__ph_body || bullet.__boosted) return;

            var bulletPosition = bullet.__worldPosition;
            var boostPosition = boost.__worldPosition;
            var dx = bulletPosition.x - boostPosition.x;
            var dy = bulletPosition.y - boostPosition.y;
            var dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < BOOST_RADIUS) {
                bullet.__boosted = 1;
                playSound('break_4');

                var v = bullet.__ph_body.velocity;
                ph_Body.setVelocity(
                    bullet.__ph_body,
                    new Vector2(v.x * BOOST_SPEED_MULT, v.y * BOOST_SPEED_MULT - BOOST_LIFT)
                );

                createBullet(
                    boostPosition.x,
                    boostPosition.y,
                    new Vector2(v.x * BOOST_SPAWN_SPEED_MULT, v.y * BOOST_SPAWN_SPEED_MULT + BOOST_SPAWN_LIFT),
                    0
                );
            }
            else {
                looperPost(boostChecker);
            }
        };
        looperPost(boostChecker);
    }

    _setTimeout(() => {
        bullet.__removeFromParent();
    }, BULLET_LIFETIME);

    return bullet;
}

// переиспользуем пул точек, прячем через альфу
function createAimDots() {
    aimDots = [];
    for (let index = 0; index < AIM_DOTS_COUNT; index++) {
        var dot = level.__addChildBox({
            __img: 'ball',
            __size: AIM_DOT_SIZE,
            __ofs: [0, 0, -12],
            __alpha: 0,
            __physics: 0
        });

        aimDots.push(dot);
    }
}

// из-за frictionAir траектория не парабола, поэтому считаем пошаговой симуляцией полёта мяча
function updateAimDots(startX, startY, velocity) {

    for (let index = 0; index < AIM_DOTS_COUNT; index++) {
        for (let step = 0; step < AIM_STEPS_PER_DOT; step++) {
            velocity.x *= (1 - AIM_FRICTION_AIR * AIM_FRICTION_FRAME);
            velocity.y *= (1 - AIM_FRICTION_AIR * AIM_FRICTION_FRAME);
            velocity.y += AIM_GRAVITY;
            startX += velocity.x;
            startY += velocity.y;
        }
        var dot = aimDots[index];
        dot.__x = startX;
        dot.__y = startY;
        dot.__alpha = 0.6 - index * (0.5 / AIM_DOTS_COUNT);
    }
}

function updateShotsLabel() {
    if (!shotsLabel) {
        shotsLabel = level.__addChildBox({
            sva: 0,
            sha: 1,
            __ofs: [0, 20, -5],
            __size: [400, 60],
            __text: {
                __fontsize: 44,
                __text: ''
            }
        });
    }
    shotsLabel.__text.__text = TR('shots_title', shots);
}

function nextLevel() {
    currentLevel++;
    if (currentLevel > MAX_LEVEL) {
        currentLevel = 1;
    }

    transitionTo(restartLevel);
}

BUS.__addEventListener(
    __ON_GAME_LOADED, a => {
        initLevel();
        return 1;
    }
);
