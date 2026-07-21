function calculateStars(levelNum, shotsCount) {
    var thresholds = STAR_THRESHOLDS[levelNum] || DEFAULT_THRESHOLDS;
    if (shotsCount <= thresholds[0]) return 3;
    if (shotsCount <= thresholds[1]) return 2;
    return 1;
}