
// прототип геймплея

options.__soundDisabled = 0;

var level
    , rubber
    , ball
    , fader
    , blocks = []
    , shots = 0
    , shotsLabel
    , currentLevel = 1
    , MAX_LEVEL = 3
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
    var s = randomFloat(25, 35);
    var breack_block = level.__addChildBox({
        __img: 'new_break_' + randomInt(1, 9),
        __ofs: [x, y, -20],
        __size: [s, s],
        __rotate: randomInt(0, 360),
        __physics: {
            __isStatic: false,
            __friction: 10,
            __frictionAir: 1,
            __frictionStatic: 50,
            __restitution: 0,
            __density: 1,
            __bodyType: 1
        }
    });
    looperPost(a => {
        if (breack_block.__ph_body) {
            //ph_Body.setVelocity(breack_block.__ph_body, new Vector2(velocity.x + randomFloat(-10, 10), velocity.y + randomFloat(-8, 3)));
            ph_Body.setVelocity(breack_block.__ph_body, new Vector2(randomFloat(-3, 3), randomFloat(-3, 1)));
            _setTimeout(() => {
                if (breack_block.__ph_body) {

                    _setTimeout(() => {
                        if (!breack_block.__destructed) {
                            removeBlock(breack_block);
                        }
                    }, randomFloat(.5, 2));
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

        var step = 50,
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
                var stars = shots <= 3 ? 3 : shots <= 5 ? 2 : 1;
                show_win(stars);
            }, 1);
        }
    } else {
        if (random() > 0.5 && !windowManager.__hasOpenedWindow()) {
            playSound('new_break_' + randomInt(1, 4), 0, 0, 0.5);
        }
    }

}

function initCollision(body, node, hp) {
    blocks.push(node);
    body.__hp = hp;
    body.__onCollision = (speed) => {
        // урон мяча от скорости
        var dmg = floor(clamp((speed - 3.5) * 10, 0, 100));
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

            userInputArea: {
                __dragDist: 1,
                __drag(x, y, dx, dy) {
                    // натягиваем резинку
                    var dmouse = this.__dmouse = this.__worldPosition.__clone().sub(new Vector2(x, y));
                    rubber.__parent.__rotate = -dmouse.__angle() * RAD2DEG;
                    rubber.__width = Math.min(dmouse.__length() * 0.5, 100);

                    ball.__x = -rubber.__width + 7;
                },
                __dragStart() {
                    rubber.__killAllAnimations();
                },
                __dragEnd() {

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
                    var wp = rubber.__worldPosition
                        , bullet = level.__addChildBox({
                            __effect: 'tail',
                            __img: 'ball',
                            __size: [28, 28],
                            __ofs: [wp.x, wp.y, -10],
                            __physics: {
                                __isStatic: false,
                                __friction: 130,
                                __frictionAir: 0.2,
                                __frictionStatic: 500,
                                __restitution: 10,
                                __density: 4,
                                __bodyType: 1
                            }
                        }).update()
                        , velocity = this.__dmouse.__multiplyScalar(0.15);

                    if (bullet.__ph_body) {
                        ph_Body.setVelocity(bullet.__ph_body, velocity);
                    }

                    // пуля исчезает через 2 сек
                    _setTimeout(() => {
                        bullet.__removeFromParent();
                    }, 2);

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
                initCollision(body, node, 100);
            }
        });

    }, 0.01);
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
    shotsLabel.__text.__text = 'Shots: ' + shots;
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
