        let targetTime = 60;
        
        function setupRadioGroup(groupId, onChange) {
            const groupEl = document.getElementById(groupId);
            if (!groupEl) return;
            const btns = groupEl.querySelectorAll('.radio-btn');
            btns.forEach(btn => {
                btn.addEventListener('click', () => {
                    btns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    if (onChange) onChange(btn.dataset.val);
                });
            });
        }
        setupRadioGroup('opt-time', val => targetTime = parseInt(val));

        // Game State Variables
        let isRunning = false;
        let isCameraOn = false;
        let isReady = false;
        let totalSteps = 0;
        let cornerSteps = 0;
        const stepsPerCorner = 10;
        let visitedItems = [];
        
        let timeLeft = 0;
        let timeElapsed = 0;
        let gameTimer = null;
        let camera = null;
        let poseRecognized = false;
        let isPosePaused = false;
        let bgScale = 1.0;
        let walkingState = false;

        // Motion Tracking Variables
        let bodyCenterYBaseline = null;
        let bodyCenterYSmoothed = null;
        let bodyCenterXBaseline = null;
        let bodyCenterXSmoothed = null;
        let lastStepTime = 0;
        let lastMotionTime = 0;

        // Corner Data
        const corners = [
            { name: "생선가게", emoji: "🐟", src: "assets/market/shopping1.mp4" },
            { name: "과일·채소가게", emoji: "🍎", src: "assets/market/shopping2.mp4" },
            { name: "떡집", emoji: "🍡", src: "assets/market/shopping3.mp4" },
            { name: "반찬가게", emoji: "🥘", src: "assets/market/shopping4.mp4" },
            { name: "잡화가게", emoji: "🧺", src: "assets/market/shopping5.mp4" }
        ];
        let currentCorner = null;

        const videoElement = document.getElementById('video_input');
        const sceneCanvas = document.getElementById('scene_canvas');
        const sceneCtx = sceneCanvas.getContext('2d');
        const poseCanvas = document.getElementById('pose_canvas');
        const poseCtx = poseCanvas.getContext('2d');
        const imgCart = document.getElementById('img_cart');

        function resizeCanvases() {
            sceneCanvas.width = sceneCanvas.offsetWidth;
            sceneCanvas.height = sceneCanvas.offsetHeight;
            poseCanvas.width = poseCanvas.offsetWidth;
            poseCanvas.height = poseCanvas.offsetHeight;
        }
        window.addEventListener('resize', resizeCanvases);

        function updateTopBar() {
            document.getElementById('ui-left-stat').innerText = `남은시간 ${timeLeft}초`;
            document.getElementById('ui-right-stat').innerText = `걸음수 ${totalSteps}보`;
        }

        function setGuideMessage(main, sub) {
            const guide = document.getElementById('guide-overlay');
            guide.style.display = 'block';
            guide.querySelector('.main-guide').innerText = main;
            guide.querySelector('.sub-guide').innerText = sub;
            setTimeout(() => { if (!isRunning) return; guide.style.display = 'none'; }, 4000);
        }

        function selectRandomCorner() {
            const randomIdx = Math.floor(Math.random() * corners.length);
            currentCorner = corners[randomIdx];
            
            const marketVideo = document.getElementById('marketVideo');
            marketVideo.src = currentCorner.src;
            marketVideo.load();
            marketVideo.currentTime = 0;
            if (walkingState) {
                marketVideo.play().catch(e => console.log('Video play failed:', e));
            } else {
                marketVideo.pause();
            }
            cornerSteps = 0;
        }

        function showCornerSuccess() {
            const overlay = document.getElementById('corner-success-overlay');
            document.getElementById('corner-success-text').innerText = `${currentCorner.name} 도착!`;
            overlay.classList.add('active');
            
            // Add item to cart list
            visitedItems.push(currentCorner.emoji);
            
            setTimeout(() => {
                overlay.classList.remove('active');
                if (isRunning) selectRandomCorner();
            }, 2000);
        }

        // --- Pose Logic ---
        const pose = new Pose({ locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}` });
        pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.55, minTrackingConfidence: 0.5 });
        
        pose.onResults(results => {
            poseCtx.save();
            poseCtx.clearRect(0, 0, poseCanvas.width, poseCanvas.height);
            
            if (results.poseLandmarks) {
                const lm = results.poseLandmarks;
                const shoulderReady = lm[11] && lm[11].visibility > 0.4 && lm[12] && lm[12].visibility > 0.4;
                isReady = shoulderReady;

                if (isReady) {
                    if (!poseRecognized) {
                        poseRecognized = true;
                        document.getElementById('pose-status').innerText = '준비 완료! 시작하기 버튼을 눌러 쇼핑을 시작하세요.';
                        document.getElementById('pose-status').style.color = '#22c55e';
                        
                        const camOverlay = document.getElementById('camera-status-overlay');
                        camOverlay.innerText = 'AI 몸 인식 완료';
                        camOverlay.style.color = '#22c55e';
                    }
                    if (isRunning) {
                        isPosePaused = false;
                        document.getElementById('pose-warning-overlay').style.display = 'none';
                        processWalkingMotion(lm);
                    }
                } else {
                    if (poseRecognized || document.getElementById('pose-status').innerText.includes('카메라를 켜고')) {
                        poseRecognized = false;
                        document.getElementById('pose-status').innerText = '어깨가 보이면 쇼핑을 시작할 수 있어요.';
                        document.getElementById('pose-status').style.color = '#ef4444';
                    }
                    if (isRunning) {
                        isPosePaused = true;
                        document.getElementById('pose-warning-overlay').style.display = 'flex';
                        walkingState = false;
                    }
                }
                
                const filteredLm = lm.map((point, index) => {
                    if (index <= 10) return { ...point, visibility: 0 };
                    return point;
                });
                
                drawConnectors(poseCtx, filteredLm, POSE_CONNECTIONS, { color: '#00FF00', lineWidth: 4 });
                drawLandmarks(poseCtx, filteredLm, { color: '#00FF00', lineWidth: 2, radius: 4 });
            } else {
                if (poseRecognized || document.getElementById('pose-status').innerText.includes('카메라를 켜고')) {
                    poseRecognized = false;
                    document.getElementById('pose-status').innerText = 'TV 화면 사용 시 카메라는 몸 전체가 보이도록 설치해주세요.';
                    document.getElementById('pose-status').style.color = '#ef4444';
                }
                if (isRunning) {
                    isPosePaused = true;
                    document.getElementById('pose-warning-overlay').style.display = 'flex';
                    walkingState = false;
                }
            }
            poseCtx.restore();
        });

        function processWalkingMotion(lm) {
            if (!lm[11] || !lm[12] || lm[11].visibility <= 0.4 || lm[12].visibility <= 0.4) return;
            if (document.getElementById('corner-success-overlay').classList.contains('active')) return; // Stop counting while success is showing
            
            const bodyY = (lm[11].y + lm[12].y) / 2;
            const bodyX = (lm[11].x + lm[12].x) / 2;

            if (bodyCenterYSmoothed === null) {
                bodyCenterYSmoothed = bodyY;
                bodyCenterYBaseline = bodyY;
                bodyCenterXSmoothed = bodyX;
                bodyCenterXBaseline = bodyX;
            } else {
                bodyCenterYSmoothed = bodyCenterYSmoothed * 0.7 + bodyY * 0.3;
                bodyCenterXSmoothed = bodyCenterXSmoothed * 0.7 + bodyX * 0.3;
            }

            bodyCenterYBaseline = Math.max(bodyCenterYBaseline * 0.95 + bodyCenterYSmoothed * 0.05, bodyCenterYSmoothed);
            bodyCenterXBaseline = bodyCenterXBaseline * 0.95 + bodyCenterXSmoothed * 0.05;

            const diffY = bodyCenterYBaseline - bodyCenterYSmoothed;
            const diffX = Math.abs(bodyCenterXBaseline - bodyCenterXSmoothed);
            
            const thresholdY = 0.004;
            const thresholdX = 0.004;

            if (diffY > thresholdY || diffX > thresholdX) {
                lastMotionTime = performance.now();
            }

            const now = performance.now();
            if (now - lastMotionTime < 1000) {
                if (!walkingState) {
                    walkingState = true;
                    document.getElementById('marketVideo').play().catch(e => {});
                }
                registerStep();
            } else {
                if (walkingState) {
                    walkingState = false;
                    document.getElementById('marketVideo').pause();
                }
            }
        }

        function registerStep() {
            const now = performance.now();
            if (now - lastStepTime < 500) return; // 0.5초 딜레이

            totalSteps++;
            cornerSteps++;
            lastStepTime = now;
            updateTopBar();
            
            if (cornerSteps >= stepsPerCorner) {
                walkingState = false;
                showCornerSuccess();
            }
        }

        // --- Game Rendering Loop ---
        function gameLoop() {
            if (!isRunning && !document.getElementById('result-screen').classList.contains('active')) return;
            
            sceneCtx.clearRect(0, 0, sceneCanvas.width, sceneCanvas.height);
            
            const w = sceneCanvas.width;
            const h = sceneCanvas.height;
            const now = performance.now();
            
            let cartYOffset = 0;
            let currentCartWidth = Math.min(450, w * 0.5);
            if (walkingState) {
                cartYOffset = 3;
                currentCartWidth = currentCartWidth * 1.02;
            }
            
            const cartHeight = currentCartWidth * (imgCart.height / imgCart.width || 1); 
            const cartX = w * 0.5 - currentCartWidth * 0.5;
            const cartY = h - cartHeight + 20 + cartYOffset;

            if (imgCart.complete && imgCart.naturalHeight !== 0) {
                sceneCtx.drawImage(imgCart, cartX, cartY, currentCartWidth, cartHeight);
            }
            
            if (now - lastStepTime < 300) {
                sceneCtx.save();
                sceneCtx.font = "900 48px Inter";
                sceneCtx.fillStyle = "#FFC400";
                sceneCtx.strokeStyle = "#3A2A14";
                sceneCtx.lineWidth = 6;
                const alpha = 1 - (now - lastStepTime) / 300;
                sceneCtx.globalAlpha = alpha;
                sceneCtx.strokeText("+1", cartX + currentCartWidth - 80, cartY - 20 - (1-alpha)*30);
                sceneCtx.fillText("+1", cartX + currentCartWidth - 80, cartY - 20 - (1-alpha)*30);
                sceneCtx.restore();
            }

            requestAnimationFrame(gameLoop);
        }

        // --- Game Flow ---
        function startCamera() {
            const btnCam = document.getElementById('btn-camera');
            btnCam.innerText = '카메라 켜는 중...';
            camera = new Camera(videoElement, {
                onFrame: async () => { await pose.send({ image: videoElement }); },
                width: 640, height: 480
            });
            camera.start().then(() => {
                isCameraOn = true;
                btnCam.innerText = '카메라 켜짐';
                btnCam.disabled = true;
            });
        }

        function startRound() {
            if (!isCameraOn) {
                alert("카메라를 먼저 켜주세요.");
                return;
            }
            
            isRunning = true;
            document.getElementById('settings-panel').classList.add('hidden');
            document.getElementById('top-bar').classList.add('active');
            resizeCanvases();
            
            totalSteps = 0;
            cornerSteps = 0;
            visitedItems = [];
            timeElapsed = 0;
            bgScale = 1.0;
            bodyCenterYBaseline = null;
            bodyCenterYSmoothed = null;
            bodyCenterXBaseline = null;
            bodyCenterXSmoothed = null;
            walkingState = false;
            isPosePaused = false;
            lastMotionTime = 0;
            document.getElementById('pose-warning-overlay').style.display = 'none';
            document.getElementById('corner-success-overlay').classList.remove('active');
            
            timeLeft = targetTime;
            updateTopBar();
            setGuideMessage('쇼핑 시작!', '제자리 걷기를 하여 지정된 마트 코너로 이동하세요.');
            selectRandomCorner();
            
            requestAnimationFrame(gameLoop);
            
            gameTimer = setInterval(() => {
                if (document.getElementById('corner-success-overlay').classList.contains('active')) return; // pause timer during success
                
                timeElapsed++;
                timeLeft--;
                if (timeLeft <= 0) {
                    endRound();
                }
                updateTopBar();
            }, 1000);
        }

        function endRound() {
            isRunning = false;
            clearInterval(gameTimer);
            walkingState = false;
            const resScreen = document.getElementById('result-screen');
            document.getElementById('res-score').innerText = `총 걸음: ${totalSteps}보`;
            
            document.getElementById('res-items').innerText = `방문한 코너 수: ${visitedItems.length}개`;
            
            document.getElementById('res-time').innerText = `운동시간: ${timeElapsed}초`;
            
            resScreen.classList.add('active');
        }

        function nextAction() {
            document.getElementById('result-screen').classList.remove('active');
            document.getElementById('settings-panel').classList.remove('hidden');
            document.getElementById('top-bar').classList.remove('active');
        }
