// p5 + MediaPipe Hands example
// Draws a yellow circle following your index fingertip using the webcam.

let videoElement; // HTMLVideoElement used by MediaPipe
let hands; // MediaPipe Hands instance
let latestLandmarks = null; // most recent hand landmarks
let cameraStarted = false; // whether camera stream and frame loop started

function setup() {
  createCanvas(windowWidth, windowHeight);
  // create a hidden video element that MediaPipe will use
  // We'll create/start the camera on user gesture for better mobile compatibility.
  // Create a placeholder video element reference (will be assigned in startCamera()).
  videoElement = null;

  // Initialize MediaPipe Hands
  hands = new Hands({locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
  }});

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.6
  });

  hands.onResults(onHandsResults);

  // Auto-start camera on desktop; on mobile, require a user gesture (tap) to begin.
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!isMobile) {
    startCamera();
  }
}

function onHandsResults(results) {
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    // Use first detected hand
    latestLandmarks = results.multiHandLandmarks[0];
  } else {
    latestLandmarks = null;
  }
}

// Start camera stream (called on user gesture on mobile, or automatically on desktop)
async function startCamera() {
  if (cameraStarted) return;
  try {
    const constraints = { video: { width: 640, height: 480, facingMode: 'user' }, audio: false };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    // create a plain video element (not p5 capture) so MediaPipe can use it
    videoElement = document.createElement('video');
    videoElement.style.display = 'none';
    videoElement.setAttribute('playsinline', ''); // for iOS
    videoElement.muted = true;
    videoElement.autoplay = true;
    videoElement.srcObject = stream;
    await videoElement.play();

    cameraStarted = true;

    // Start frame loop feeding MediaPipe
    async function frameLoop() {
      if (!cameraStarted) return;
      if (videoElement.readyState >= 2) {
        try {
          await hands.send({ image: videoElement });
        } catch (e) {
          // ignore intermittent errors
        }
      }
      requestAnimationFrame(frameLoop);
    }
    requestAnimationFrame(frameLoop);
  } catch (err) {
    console.warn('Could not start camera:', err);
    cameraStarted = false;
  }
}

function draw() {
  background(30);

  // If camera hasn't started yet, show a tap/click to start overlay (mobile friendly)
  if (!cameraStarted) {
    fill(0, 160);
    rect(0, 0, width, height);
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(22);
    text('카메라를 사용하려면 탭하세요 (Tap to start camera)', width/2, height/2 - 30);
    // Draw a start button
    fill(255, 235, 59);
    stroke(220, 200, 30);
    strokeWeight(2);
    rectMode(CENTER);
    rect(width/2, height/2 + 30, 180, 56, 12);
    fill(30);
    noStroke();
    textSize(18);
    text('Start', width/2, height/2 + 30);
    rectMode(CORNER);
    return;
  }

  // Mirror video width/height mapping to canvas
  if (latestLandmarks) {
    // Index fingertip is landmark 8 (0-based indexing)
    const tip = latestLandmarks[8]; // {x: 0..1, y: 0..1, z: ...}

    // MediaPipe coordinates: x grows to the right, y grows downward, origin top-left of video
    // The video feed is mirrored by default in p5 capture; to match typical webcam mirror, we'll flip x
    const videoW = videoElement.width;
    const videoH = videoElement.height;

    // Map landmark to canvas coordinates
    // Tip.x is ratio relative to video width; to mirror, use 1 - tip.x
    const canvasX = map(1 - tip.x, 0, 1, 0, width);
    const canvasY = map(tip.y, 0, 1, 0, height);

    // Draw trailing glow
    noStroke();
    for (let i = 24; i > 0; i -= 6) {
      fill(255, 235, 59, 10 + i * 6); // yellow translucent
      ellipse(canvasX, canvasY, i * 6 + 20);
    }

    // Solid yellow circle at fingertip
    fill(255, 235, 59);
    stroke(220, 200, 30);
    strokeWeight(2);
    ellipse(canvasX, canvasY, 36);
  } else {
    // Instruction text when no hand found
    fill(255);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(20);
    text('손을 카메라 앞에 두세요 (Index finger tip will be tracked)', width/2, height/2);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// p5.js + ml5.handpose example
// Draw a yellow circle that follows the user's hand (mobile-friendly)

let video;
let handposeModel;
let predictions = [];

// camera facing state for toggle UI ('user' = front, 'environment' = back)
let cameraFacing = 'environment';
let toggleButton;

// Smoothed position for the circle
let sx = 0;
let sy = 0;
let smoothing = 0.2; // 0 - 1, higher = faster

function setup() {
  // create canvas full screen and append to body
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  // create a video capture via restartVideo (so we can restart with different facingMode)
  restartVideo(cameraFacing);

  // create toggle button for front/back camera
  toggleButton = createButton(cameraFacing === 'user' ? '전면 카메라' : '후면 카메라');
  toggleButton.position(12, 12);
  toggleButton.style('padding', '8px 12px');
  toggleButton.style('background', '#ffeb3b');
  toggleButton.style('border-radius', '6px');
  toggleButton.style('border', 'none');
  toggleButton.style('font-weight', '600');
  toggleButton.mousePressed(() => {
    // toggle facing mode and restart video
    cameraFacing = cameraFacing === 'user' ? 'environment' : 'user';
    toggleButton.html(cameraFacing === 'user' ? '전면 카메라' : '후면 카메라');
    // remove any existing predictions / model while restarting
    predictions = [];
    if (handposeModel && handposeModel.removeAllListeners) {
      try { handposeModel.removeAllListeners('predict'); } catch(e) { /* ignore */ }
    }
    restartVideo(cameraFacing);
  });

  // dark background
  background(27);
  noStroke();
  fill(255);
}

function onVideoReady() {
  // load the handpose model from ml5
  if (handposeModel && handposeModel.removeAllListeners) {
    try { handposeModel.removeAllListeners('predict'); } catch(e) {}
  }
  handposeModel = ml5.handpose(video, { flipHorizontal: true }, modelReady);
  handposeModel.on('predict', results => {
    predictions = results;
  });
}

// Helper to restart video capture with a given facing mode
function restartVideo(facingMode) {
  // stop and remove existing video capture if present
  if (video) {
    try {
      // p5.Video has remove() method to stop capture
      video.remove();
    } catch (e) {
      // ignore
    }
    video = null;
  }

  const constraints = {
    video: {
      facingMode: facingMode,
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: false
  };

  // start new capture and initialize model in onVideoReady
  video = createCapture(constraints, onVideoReady);
  video.size(width, height);
  video.hide();
}

function modelReady() {
  console.log('Handpose model ready');
}

function draw() {
  // clear with slight transparency for trailing effect
  background(27, 27, 27, 200);

  // Mirror video for more natural interaction
  push();
  translate(width, 0);
  scale(-1, 1);
  // draw a small, low-opacity video preview in top-right for debugging on large screens
  const previewW = min(160, width * 0.2);
  const previewH = (previewW / video.width) * video.height || previewW * (9 / 16);
  tint(255, 40);
  image(video, 10, 10, previewW, previewH);
  pop();

  // default position is center
  let tx = width / 2;
  let ty = height / 2;

  if (predictions && predictions.length > 0) {
    // predictions[0].landmarks is an array of 21 [x,y,z] points
    const lm = predictions[0].landmarks;
    // compute centroid of landmarks (use only x,y)
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < lm.length; i++) {
      cx += lm[i][0];
      cy += lm[i][1];
    }
    cx /= lm.length;
    cy /= lm.length;

    // the model and video are mirrored by flipHorizontal, but our canvas is not, so mirror x
    tx = width - map(cx, 0, video.width, 0, width);
    ty = map(cy, 0, video.height, 0, height);
  }

  // smooth
  sx = lerp(sx, tx, smoothing);
  sy = lerp(sy, ty, smoothing);

  // choose circle size based on distance between thumb tip (4) and index tip (8) if available
  let circleR = min(width, height) * 0.08;
  if (predictions && predictions.length > 0) {
    const lm = predictions[0].landmarks;
    if (lm[4] && lm[8]) {
      const d = dist(lm[4][0], lm[4][1], lm[8][0], lm[8][1]);
      const dMapped = map(d, 0, video.width * 0.5, circleR * 0.3, circleR * 1.6);
      circleR = constrain(dMapped, circleR * 0.3, circleR * 2);
    }
  }

  // draw yellow circle with slight glow
  push();
  noStroke();
  // glow layers
  for (let i = 6; i >= 1; i--) {
    fill(255, 230, 0, 12 * i);
    ellipse(sx, sy, circleR * (1 + i * 0.25));
  }
  // solid center
  fill(255, 230, 0);
  ellipse(sx, sy, circleR);
  pop();

  // helpful hint text on first run
  if (!handposeModel) {
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(16);
    text('Initializing camera & model... allow camera access', width / 2, height - 40);
  } else if (predictions.length === 0) {
    fill(200);
    textAlign(CENTER, CENTER);
    textSize(16);
    text('Place your hand in view', width / 2, height - 40);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (video) video.size(width, height);
}

// Prevent touch scrolling on mobile so interactions feel immediate
function touchMoved() {
  return false;
}