function awakeBlocks() {

    $each(blocks, b => {
        b.__ph_awake();
    });
}

function removeBlock(block) {
    removeFromArray(block, blocks);
    var size = block.__size;

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

        var positions = [];
        // учитывается вращение блока
        for (var x = 0; x < size.x; x += step) {
            for (var y = 0; y < size.y; y += step) {
                var localX = x - size.x / 2 + step / 2;
                var localY = y - size.y / 2 + step / 2;

                positions.push([
                    centerX + localX * ca + localY * sa,
                centerY - localX * sa + localY * ca
                ]);
            }
        }

        var i = 0;
        var spawnChunk = () => {
            var n = Math.min(i + SHARD_PER_FRAME, positions.length);
            for (; i < n; i++) {
                addBreakBlock(positions[i][0], positions[i][1]);
            }
            if (i < positions.length) looperPost(spawnChunk);
        };
        spawnChunk();

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

function initCollision(body, node, hp) {
    blocks.push(node);
    body.__hp = hp;
    body.__onCollision = (speed) => {
        // урон мяча от скорости
        var dmg = floor(clamp((speed - DMG_SPEED_THRESHOLD) * DMG_MULT, 0, DMG_MAX));
        if (dmg && body.__hp) {
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