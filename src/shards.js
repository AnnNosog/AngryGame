function addBreakBlock(x, y) {
    var s = randomFloat(SHARD_SIZE_MIN, SHARD_SIZE_MAX);
    var break_block = level.__addChildBox({
        __img: 'new_break_' + randomInt(1, 9),
        __ofs: [x, y, -20],
        __size: [s, s],
        __rotate: randomInt(0, 360),
    });

    var life = randomFloat(SHARD_LIFETIME_MIN, SHARD_LIFETIME_MAX);

    // добавлена анимация, чтобы уйти от физики и возможных фризов при большом количестве осколков 
    break_block.__anim({
        __x: x + randomFloat(-80, 80),
        __y: y + randomFloat(200, 400),
        __rotate: break_block.__rotate + randomFloat(-120, 120),
        __alpha: .3
    }, life, 0, easeQuadI);

    _setTimeout(() => {
        if (!break_block.__destructed) break_block.__removeFromParent();
    }, life);
}