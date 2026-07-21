function show_win(stars) {

    playSound('win');
    var isLast = currentLevel >= MAX_LEVEL;
    
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