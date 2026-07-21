function restartLevel() {
    if (level) level.__removeFromParent();
    if (shotsLabel) {
        shotsLabel.__removeFromParent();
        shotsLabel = 0;
    };

    blocks.length = 0;
    bullets.length = 0;
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
            if (body && !body.isStatic) {
                // this is block
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