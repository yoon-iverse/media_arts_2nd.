function setup() {
 // put setup code here
}

function draw() {
  // put drawing code here
}

// 벽돌깨기 게임 변수 선언
let paddle, ball, bricks = [], rows = 5, cols = 8, brickW, brickH = 25, brickPadding = 5;
let gameState = 'start'; // start, play, win, lose
let score = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  resetGame();
}

function resetGame() {
  // 패들
  paddle = {
    w: min(120, width * 0.3),
    h: 18,
    x: width/2 - min(120, width * 0.3)/2,
    y: height - 40,
    speed: 12
  };
  // 공
  ball = {
    x: width/2,
    y: paddle.y - 16,
    r: 13,
    dx: random([-6, 6]),
    dy: -7
  };
  // 벽돌
  bricks = [];
  brickW = (width - (cols+1)*brickPadding) / cols;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      bricks.push({
        x: brickPadding + c * (brickW + brickPadding),
        y: 60 + r * (brickH + brickPadding),
        w: brickW,
        h: brickH,
        alive: true,
        color: color(255 - r*30, 100 + r*30, 200 - c*10)
      });
    }
  }
  score = 0;
  gameState = 'start';
}

function draw() {
  background(30);
  drawBricks();
  drawPaddle();
  drawBall();
  drawScore();
  if (gameState === 'start') {
    drawMessage('터치 또는 클릭해서 시작!');
  } else if (gameState === 'win') {
    drawMessage('🎉 클리어! 다시 시작하려면 터치');
  } else if (gameState === 'lose') {
    drawMessage('😢 실패! 다시 시작하려면 터치');
  } else if (gameState === 'play') {
    updateBall();
    checkCollisions();
  }
}

function drawBricks() {
  for (let b of bricks) {
    if (b.alive) {
      fill(b.color);
      rect(b.x, b.y, b.w, b.h, 6);
    }
  }
}

function drawPaddle() {
  fill(255);
  rect(paddle.x, paddle.y, paddle.w, paddle.h, 10);
}

function drawBall() {
  fill(255, 200, 0);
  ellipse(ball.x, ball.y, ball.r*2);
}

function drawScore() {
  fill(255);
  textAlign(LEFT, TOP);
  textSize(20);
  text('점수: ' + score, 12, 12);
}

function drawMessage(msg) {
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(28);
  text(msg, width/2, height/2);
}

function updateBall() {
  ball.x += ball.dx;
  ball.y += ball.dy;
  // 벽 반사
  if (ball.x - ball.r < 0 || ball.x + ball.r > width) ball.dx *= -1;
  if (ball.y - ball.r < 0) ball.dy *= -1;
  // 바닥
  if (ball.y - ball.r > height) {
    gameState = 'lose';
  }
}

function checkCollisions() {
  // 패들
  if (ball.y + ball.r > paddle.y && ball.x > paddle.x && ball.x < paddle.x + paddle.w && ball.y < paddle.y + paddle.h) {
    ball.dy *= -1;
    // 패들 중앙에서 멀수록 각도 변화
    let hitPos = (ball.x - (paddle.x + paddle.w/2)) / (paddle.w/2);
    ball.dx = hitPos * 8;
    ball.y = paddle.y - ball.r - 1;
  }
  // 벽돌
  for (let b of bricks) {
    if (b.alive && ball.x > b.x && ball.x < b.x + b.w && ball.y - ball.r < b.y + b.h && ball.y + ball.r > b.y) {
      b.alive = false;
      ball.dy *= -1;
      score += 10;
      break;
    }
  }
  // 승리 체크
  if (bricks.every(b => !b.alive)) {
    gameState = 'win';
  }
}

// 마우스/터치로 패들 이동
function mouseMoved() {
  if (gameState === 'play') {
    paddle.x = constrain(mouseX - paddle.w/2, 0, width - paddle.w);
  }
}
function touchMoved() {
  if (gameState === 'play') {
    paddle.x = constrain(touches[0].x - paddle.w/2, 0, width - paddle.w);
  }
  return false;
}

// 시작/재시작
function mousePressed() {
  if (gameState === 'start' || gameState === 'win' || gameState === 'lose') {
    resetGame();
    gameState = 'play';
  }
}
function touchStarted() {
  mousePressed();
  return false;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  resetGame();
}
