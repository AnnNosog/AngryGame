function createBullet(x, y, velocity, canBoost) {
    while (bullets.length >= MAX_BULLETS) {
        var old = bullets.shift();
        if (old && !old.__destructed) old.__removeFromParent();
    };

    var bullet = level.__addChildBox({
        __effect: 'tail',
        __img: 'ball',
        __size: BULLET_SIZE,
        __ofs: [x, y, -10],
        __physics: BULLET_PHYSICS
    }).update();

    bullets.push(bullet);

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
                playSound('boost');

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
        removeFromArray(bullet, bullets);
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