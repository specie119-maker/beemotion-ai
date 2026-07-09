const BGMManager = (function() {
    let currentAudio = null;
    let fadeInterval = null;
    let programType = 'general'; // 'general' or 'walk'
    let currentMode = 'individual'; // 'individual' or 'group'
    
    // 경로(assets인지 asserts인지에 유의: 기존 html을 참고하여 ../asserts/bgm/ 사용)
    const BGM_PATH = '../asserts/bgm/';
    const BGM_VOLUME = 0.4;

    const tracksGeneral = [
        '01.mp3', '02.mp3', '03.mp3', '04.mp3', '05.mp3', '06.mp3', '07.mp3', 'BeeMotion3minite.mp3'
    ];
    const tracksWalk = [
        'walk_120min.mp3', 'walk_140min.mp3'
    ];

    function getRandomTrack() {
        const list = programType === 'walk' ? tracksWalk : tracksGeneral;
        const randomIndex = Math.floor(Math.random() * list.length);
        return list[randomIndex];
    }

    function createAudio(src) {
        const audio = new Audio(BGM_PATH + src);
        audio.loop = true;
        audio.volume = 0; // fadeIn을 위해 0으로 시작
        return audio;
    }

    function fadeIn(audio) {
        clearInterval(fadeInterval);
        audio.play().catch(e => console.error("BGM Play error (Auto-play blocked or no user interaction):", e));
        let vol = 0;
        const step = BGM_VOLUME / 10; // 10 steps
        fadeInterval = setInterval(() => {
            vol += step;
            if (vol >= BGM_VOLUME) {
                vol = BGM_VOLUME;
                clearInterval(fadeInterval);
            }
            audio.volume = vol;
        }, 100); // 1000ms / 10 = 100ms
    }

    function fadeOut(audio, onComplete) {
        clearInterval(fadeInterval);
        let vol = audio.volume;
        const step = BGM_VOLUME / 10;
        fadeInterval = setInterval(() => {
            vol -= step;
            if (vol <= 0) {
                vol = 0;
                clearInterval(fadeInterval);
                audio.pause();
                audio.currentTime = 0;
                if (onComplete) onComplete();
            }
            audio.volume = Math.max(0, vol);
        }, 100);
    }

    return {
        init: function(type, mode) {
            programType = type === 'walk' ? 'walk' : 'general';
            currentMode = mode || 'individual';
        },
        play: function(isGroupNextTurn = false) {
            // 이미 재생 중이고, 그룹 모드의 다음 턴 전환(isGroupNextTurn)이 아니면 무시
            if (currentAudio && !currentAudio.paused && !isGroupNextTurn) return;

            const newSrc = getRandomTrack();
            const newAudio = createAudio(newSrc);

            if (currentAudio) {
                const oldAudio = currentAudio;
                fadeOut(oldAudio, () => {
                    oldAudio.src = "";
                });
                currentAudio = newAudio;
                fadeIn(currentAudio);
            } else {
                currentAudio = newAudio;
                fadeIn(currentAudio);
            }
        },
        stop: function() {
            if (!currentAudio) return;
            fadeOut(currentAudio, () => {
                currentAudio.src = "";
                currentAudio = null;
            });
        },
        setMode: function(mode) {
            currentMode = mode;
        }
    };
})();
