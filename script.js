const menuButton = document.querySelector('.menu-toggle');
const siteNav = document.querySelector('#site-nav');

if (menuButton && siteNav) {
  menuButton.addEventListener('click', () => {
    const isOpen = siteNav.classList.toggle('is-open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
  });
}

class SnakeGame {
  constructor() {
    this.canvas = document.querySelector('#game-canvas');
    this.ctx = this.canvas?.getContext('2d');
    this.scoreEl = document.querySelector('#score');
    this.highScoreEl = document.querySelector('#high-score');
    this.statusEl = document.querySelector('#game-status');
    this.startButton = document.querySelector('#start-button');
    this.pauseButton = document.querySelector('#pause-button');
    this.restartButton = document.querySelector('#restart-button');
    this.dpadButtons = document.querySelectorAll('[data-direction]');

    this.gridSize = 24;
    this.timerId = null;
    this.state = 'ready';
    this.tickMs = 140;
    this.score = 0;
    this.highScore = 0;
    this.direction = { x: 1, y: 0 };
    this.pendingDirection = { x: 1, y: 0 };
    this.paletteIndex = 0;
    this.snakePalettes = [
      { body: '#77d9ff', head: '#d8fbff', accent: '#39b8ff' },
      { body: '#7ff0bc', head: '#ecfff5', accent: '#2ed99b' },
      { body: '#d7a9ff', head: '#f6e6ff', accent: '#b672ff' },
      { body: '#ffbe7d', head: '#fff0dd', accent: '#ff8d3a' },
    ];
    this.snake = [];
    this.food = { x: 0, y: 0 };

    if (!this.canvas || !this.ctx) {
      return;
    }

    this.safeLoadHighScore();
    this.resetGame(false);
    this.bindEvents();
    this.updateHighScore();
    this.setStatus('Ready');
    this.resizeCanvas();
    this.draw();
  }

  get palette() {
    return this.snakePalettes[this.paletteIndex % this.snakePalettes.length];
  }

  safeLoadHighScore() {
    try {
      this.highScore = Number(localStorage.getItem('snake-high-score') || 0);
    } catch (error) {
      this.highScore = 0;
    }
  }

  safeStoreHighScore() {
    try {
      localStorage.setItem('snake-high-score', String(this.highScore));
    } catch (error) {
      // Ignore storage failures in private browsing or locked-down environments.
    }
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resizeCanvas());
    window.addEventListener('keydown', (event) => this.handleKeydown(event));
    this.canvas.addEventListener('dblclick', () => {
      this.paletteIndex = (this.paletteIndex + 1) % this.snakePalettes.length;
      this.draw();
    });

    this.startButton?.addEventListener('click', () => this.start());
    this.pauseButton?.addEventListener('click', () => this.togglePause());
    this.restartButton?.addEventListener('click', () => this.restart());

    this.dpadButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const direction = button.dataset.direction;
        if (direction === 'pause') {
          this.togglePause();
          return;
        }

        const map = {
          up: { x: 0, y: -1 },
          down: { x: 0, y: 1 },
          left: { x: -1, y: 0 },
          right: { x: 1, y: 0 },
        };

        if (map[direction]) {
          this.setDirection(map[direction]);
          if (this.state === 'ready') {
            this.start();
          }
        }
      });
    });
  }

  resizeCanvas() {
    const parentWidth = this.canvas.clientWidth;
    const dpr = window.devicePixelRatio || 1;
    const size = Math.max(240, Math.floor(parentWidth));
    this.canvas.width = Math.floor(size * dpr);
    this.canvas.height = Math.floor(size * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  resetGame(clearTimer = true) {
    if (clearTimer) {
      this.stopTimer();
    }

    const mid = Math.floor(this.gridSize / 2);
    this.snake = [
      { x: mid + 1, y: mid },
      { x: mid, y: mid },
      { x: mid - 1, y: mid },
    ];
    this.direction = { x: 1, y: 0 };
    this.pendingDirection = { x: 1, y: 0 };
    this.score = 0;
    this.tickMs = 140;
    this.food = this.createFood();
    this.state = 'ready';
    this.updateScore();
    this.setStatus('Ready');
    this.draw();
  }

  start() {
    if (this.state === 'playing') {
      return;
    }

    if (this.state === 'over') {
      this.resetGame(false);
    }

    this.state = 'playing';
    this.setStatus('Playing');
    this.startTimer();
    this.draw();
  }

  pause() {
    if (this.state !== 'playing') {
      return;
    }

    this.state = 'paused';
    this.stopTimer();
    this.setStatus('Paused');
    this.draw();
  }

  togglePause() {
    if (this.state === 'playing') {
      this.pause();
      return;
    }

    if (this.state === 'paused') {
      this.start();
      return;
    }

    this.start();
  }

  restart() {
    this.resetGame();
    this.start();
  }

  startTimer() {
    this.stopTimer();
    this.timerId = window.setInterval(() => this.step(), this.tickMs);
  }

  stopTimer() {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  setStatus(value) {
    if (this.statusEl) {
      this.statusEl.textContent = value;
    }
  }

  updateScore() {
    if (this.scoreEl) {
      this.scoreEl.textContent = String(this.score);
    }
  }

  updateHighScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.safeStoreHighScore();
    }

    if (this.highScoreEl) {
      this.highScoreEl.textContent = String(this.highScore);
    }
  }

  setDirection(nextDirection) {
    const current = this.pendingDirection;
    if (current.x === -nextDirection.x && current.y === -nextDirection.y) {
      return;
    }

    this.pendingDirection = nextDirection;
  }

  handleKeydown(event) {
    const key = event.key.toLowerCase();
    const directionMap = {
      arrowup: { x: 0, y: -1 },
      w: { x: 0, y: -1 },
      arrowdown: { x: 0, y: 1 },
      s: { x: 0, y: 1 },
      arrowleft: { x: -1, y: 0 },
      a: { x: -1, y: 0 },
      arrowright: { x: 1, y: 0 },
      d: { x: 1, y: 0 },
    };

    if (key === ' ' || key === 'spacebar') {
      event.preventDefault();
      this.togglePause();
      return;
    }

    if (directionMap[key]) {
      event.preventDefault();
      this.setDirection(directionMap[key]);
      if (this.state === 'ready') {
        this.start();
      }
    }
  }

  createFood() {
    let position = { x: 0, y: 0 };
    do {
      position = {
        x: Math.floor(Math.random() * this.gridSize),
        y: Math.floor(Math.random() * this.gridSize),
      };
    } while (this.snake.some((segment) => segment.x === position.x && segment.y === position.y));
    return position;
  }

  step() {
    if (this.state !== 'playing') {
      return;
    }

    this.direction = this.pendingDirection;
    const head = this.snake[0];
    const nextHead = {
      x: head.x + this.direction.x,
      y: head.y + this.direction.y,
    };

    if (this.isOutOfBounds(nextHead) || this.isOnSnake(nextHead)) {
      this.gameOver();
      return;
    }

    this.snake.unshift(nextHead);

    if (nextHead.x === this.food.x && nextHead.y === this.food.y) {
      this.score += 10;
      this.updateScore();
      this.updateHighScore();
      this.food = this.createFood();
      if (this.score % 50 === 0 && this.tickMs > 90) {
        this.tickMs = Math.max(90, this.tickMs - 8);
        this.startTimer();
      }
    } else {
      this.snake.pop();
    }

    this.draw();
  }

  isOutOfBounds(point) {
    return point.x < 0 || point.y < 0 || point.x >= this.gridSize || point.y >= this.gridSize;
  }

  isOnSnake(point) {
    return this.snake.some((segment, index) => index !== this.snake.length - 1 && segment.x === point.x && segment.y === point.y);
  }

  gameOver() {
    this.state = 'over';
    this.stopTimer();
    this.updateHighScore();
    this.setStatus('Game Over');
    this.draw();
  }

  draw() {
    if (!this.ctx) {
      return;
    }

    const size = this.canvas.clientWidth || 480;
    const cell = size / this.gridSize;
    this.ctx.clearRect(0, 0, size, size);

    this.drawGrid(size, cell);
    this.drawFood(cell);
    this.drawSnake(cell);
    this.drawOverlay(size);
  }

  drawGrid(size, cell) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;

    for (let i = 0; i <= this.gridSize; i += 1) {
      const offset = i * cell;
      ctx.beginPath();
      ctx.moveTo(offset, 0);
      ctx.lineTo(offset, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, offset);
      ctx.lineTo(size, offset);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawFood(cell) {
    const { x, y } = this.food;
    const ctx = this.ctx;
    const size = cell * 0.66;
    const px = x * cell + cell / 2;
    const py = y * cell + cell / 2;

    ctx.save();
    ctx.shadowColor = 'rgba(242, 201, 109, 0.65)';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#f2c96d';
    this.roundCircle(px, py, size / 2);
    ctx.fill();
    ctx.restore();
  }

  drawSnake(cell) {
    const ctx = this.ctx;
    const palette = this.palette;

    this.snake.forEach((segment, index) => {
      const isHead = index === 0;
      const px = segment.x * cell + 2;
      const py = segment.y * cell + 2;
      const size = cell - 4;
      const radius = Math.max(8, size / 3);

      ctx.save();
      ctx.fillStyle = isHead ? palette.head : palette.body;
      ctx.shadowColor = isHead ? palette.accent : 'rgba(0, 0, 0, 0.18)';
      ctx.shadowBlur = isHead ? 18 : 8;
      this.roundRect(px, py, size, size, radius);
      ctx.fill();

      if (isHead) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#05111a';
        const eyeSize = Math.max(2, cell * 0.08);
        const eyeOffset = cell * 0.2;
        const eyeY = py + cell * 0.35;
        const eyeX1 = px + eyeOffset;
        const eyeX2 = px + size - eyeOffset - eyeSize;
        ctx.beginPath();
        ctx.arc(eyeX1, eyeY, eyeSize, 0, Math.PI * 2);
        ctx.arc(eyeX2, eyeY, eyeSize, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });
  }

  drawOverlay(size) {
    if (this.state === 'ready') {
      this.drawTextOverlay(size, 'Start the game', 'Press Start or use arrows / WASD');
    } else if (this.state === 'paused') {
      this.drawTextOverlay(size, 'Paused', 'Press Pause or Space to continue');
    } else if (this.state === 'over') {
      this.drawTextOverlay(size, 'Game Over', 'Press Restart to try again');
    }
  }

  drawTextOverlay(size, title, caption) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(5, 11, 16, 0.48)';
    ctx.fillRect(0, 0, size, size);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#edf3ff';
    ctx.font = '700 28px Inter, Segoe UI, Arial, sans-serif';
    ctx.fillText(title, size / 2, size / 2 - 16);

    ctx.fillStyle = '#aab7ca';
    ctx.font = '500 15px Inter, Segoe UI, Arial, sans-serif';
    ctx.fillText(caption, size / 2, size / 2 + 18);
    ctx.restore();
  }

  roundRect(x, y, width, height, radius) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }

  roundCircle(x, y, radius) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.closePath();
  }
}

const snakeGame = new SnakeGame();
window.__snakeGame = snakeGame;
