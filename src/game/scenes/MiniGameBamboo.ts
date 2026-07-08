import { Scene, GameObjects } from 'phaser';

// ── 场景子状态 ──
const enum BambooState {
  INTRO,
  PLAYING,
  RESULT,
}

// ── 竹竿数据 ──
interface BambooData {
  sprite: GameObjects.Image;
  x: number;
  y: number;
  speed: number;
  rotation: number;
  rotSpeed: number;
  isGood: boolean;
  cut: boolean;
}

/**
 * MiniGameBamboo - 天目竹林关卡（选杆）
 * 类似切水果：竹竿从天而降，挥刀切开
 */
export class MiniGameBamboo extends Scene {
  private gameState: BambooState = BambooState.INTRO;

  private introGroup: GameObjects.Group | null = null;
  private gameUI: GameObjects.Container | null = null;
  private resultGroup: GameObjects.Group | null = null;

  // 竹竿
  private bambooList: BambooData[] = [];
  private spawnTimer = 0;
  private totalCut = 0;
  private goodCut = 0;
  private timeLeft = 45;
  private timerEvent: Phaser.Time.TimerEvent | null = null;

  // 挥刀
  private isSlashing = false;
  private slashPath: { x: number; y: number }[] = [];
  private slashGfx: GameObjects.Graphics | null = null;
  private knife: GameObjects.Image | null = null;

  constructor() {
    super('MiniGameBamboo');
  }

  create(): void {
    const { width, height } = this.cameras.main;

    const loadingText = this.add.text(width / 2, height / 2, '正在进入天目竹林...', {
      fontSize: '24px', color: '#d4c4a8',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    }).setOrigin(0.5).setDepth(200);

    this.load.image('bamboo-bg', 'assets/bamboo/bamboo-bg.png');
    this.load.image('knife', 'assets/bamboo/knife.png');
    this.load.image('bamboo-green', 'assets/bamboo/bamboogreen2.png');
    this.load.image('bamboo-brown', 'assets/bamboo/bamboobrown2.png');

    this.load.on('loaderror', (file: any) => {
      console.warn('[Bamboo] 加载失败:', file.key);
    });

    this.load.once('complete', () => {
      loadingText.destroy();
      this.renderScene();
    });

    this.load.start();
  }

  private renderScene(): void {
    const { width, height } = this.cameras.main;
    this.add.image(width / 2, height / 2, 'bamboo-bg')
      .setDisplaySize(width, height).setDepth(0);

    this.events.on('shutdown', () => {
      this.game.canvas.style.cursor = "url('assets/hub/cursor-brush-32.png') 2 28, auto";
    });

    this.showIntro();
    this.cameras.main.fadeIn(500, 0x1a, 0x1a, 0x2e);
  }

  // ================================================================
  //  INTRO
  // ================================================================
  private showIntro(): void {
    this.gameState = BambooState.INTRO;
    const { width, height } = this.cameras.main;
    this.clearAllUI();
    this.introGroup = this.add.group();

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6).setDepth(50);
    this.introGroup.add(overlay);

    const lines = [
      '湖笔制作要挑选合适的笔杆。',
      '传统湖笔常以竹为杆，',
      '讲究竹身端直、粗细合度、质地坚韧，',
      '才能使笔头装配稳固、书写顺手。',
      '——',
      '竹材从空中落下，挥动小刀切开竹竿，',
      '挑出适合制成笔杆的好竹材。',
    ];
    const yStart = height / 2 - 140;
    lines.forEach((line, i) => {
      const txt = this.add.text(width / 2, yStart + i * 38, line, {
        fontSize: i === 4 ? '20px' : '20px',
        color: i === 4 ? '#7ec87e' : '#e8f0e8',
        fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
      }).setOrigin(0.5).setDepth(51);
      this.introGroup!.add(txt);
    });

    const startBtn = this.add.text(width / 2, height / 2 + 160, '开 始 选 杆', {
      fontSize: '28px', color: '#1a2e1a', fontStyle: 'bold',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
      backgroundColor: '#7ec87e', padding: { x: 40, y: 14 },
    }).setOrigin(0.5).setDepth(51).setInteractive();

    startBtn.on('pointerover', () => startBtn.setAlpha(0.85));
    startBtn.on('pointerout', () => startBtn.setAlpha(1));
    startBtn.on('pointerdown', () => {
      this.destroyGroup(this.introGroup);
      this.introGroup = null;
      this.startGame();
    });
    this.introGroup.add(startBtn);

    // 右上角「回到小船」按钮
    const backBtn = this.add.text(width - 20, 30, '回到小船', {
      fontSize: '16px', color: '#a8c8a8',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
      backgroundColor: '#0d1a0dcc', padding: { x: 12, y: 6 },
    }).setOrigin(1, 0).setDepth(51).setInteractive();
    backBtn.on('pointerover', () => backBtn.setAlpha(0.7));
    backBtn.on('pointerout', () => backBtn.setAlpha(1));
    backBtn.on('pointerdown', () => {
      this.cameras.main.fadeOut(500, 0x1a, 0x1a, 0x2e);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('HubScene', { dockKey: 'bamboo' }));
    });
    this.introGroup.add(backBtn);
  }

  // ================================================================
  //  START GAME
  // ================================================================
  private startGame(): void {
    this.gameState = BambooState.PLAYING;
    const { width } = this.cameras.main;
    this.totalCut = 0; this.goodCut = 0; this.timeLeft = 45;
    this.bambooList = []; this.spawnTimer = 0;
    this.slashPath = [];

    // ── UI ──
    this.gameUI = this.add.container(0, 0).setDepth(100);

    const barBg = this.add.rectangle(width / 2, 22, width, 44, 0x0d1a0d, 0.75);
    this.gameUI.add(barBg);

    const timerText = this.add.text(78, 22, '45s', {
      fontSize: '20px', color: '#7ec87e', fontStyle: 'bold',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    }).setOrigin(0, 0.5);
    timerText.setName('timerText');
    this.gameUI.add(timerText);

    const scoreText = this.add.text(width / 2, 22, '🔪 劈开: 0  |  🎋 良材: 0', {
      fontSize: '18px', color: '#e8f0e8',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    }).setOrigin(0.5);
    scoreText.setName('scoreText');
    this.gameUI.add(scoreText);

    const phaseText = this.add.text(width / 2, 44, '阶段一', {
      fontSize: '13px', color: '#7ec87e',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    }).setOrigin(0.5);
    phaseText.setName('phaseText');
    this.gameUI.add(phaseText);

    const backBtn = this.add.text(width - 20, 22, '✕ 退出', {
      fontSize: '16px', color: '#a8c8a8',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
      backgroundColor: '#0d1a0dcc', padding: { x: 10, y: 4 },
    }).setOrigin(1, 0.5).setInteractive();
    backBtn.on('pointerdown', () => this.endGame());
    this.gameUI.add(backBtn);

    // ── 挥刀轨迹 ──
    this.slashGfx?.destroy();
    this.slashGfx = this.add.graphics().setDepth(99);

    // ── 小刀精灵图（替换鼠标） ──
    this.knife?.destroy();
    this.knife = this.add.image(0, 0, 'knife').setDepth(101).setScale(0.24);

    // ── 输入 ──
    this.game.canvas.style.cursor = 'none';

    // 清除旧的事件监听器，防止 replay 时累积
    this.input.off('pointermove');
    this.input.off('pointerdown');
    this.input.off('pointerup');

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.gameState !== BambooState.PLAYING) return;
      this.knife!.setPosition(p.x + 30, p.y + 30);
      if (this.isSlashing) {
        this.knife!.setAngle(15);
        this.slashPath.push({ x: p.x, y: p.y });
        this.checkSlash(p);
      } else {
        this.knife!.setAngle(0);
      }
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.gameState !== BambooState.PLAYING) return;
      this.isSlashing = true;
      this.slashPath = [{ x: p.x, y: p.y }];
    });

    this.input.on('pointerup', () => {
      this.isSlashing = false;
      this.slashPath = [];
      this.slashGfx?.clear();
    });

    // ── 倒计时 ──
    this.timerEvent = this.time.addEvent({
      delay: 1000, repeat: 44,
      callback: () => {
        this.timeLeft--;
        const t = this.getUIText('timerText');
        if (t) { t.setText(`${this.timeLeft}s`); if (this.timeLeft <= 10) t.setColor('#ff4444'); }

        // 阶段切换
        const pt = this.getUIText('phaseText');
        if (this.timeLeft === 30) pt?.setText('阶段二 · 加速');
        if (this.timeLeft === 15) pt?.setText('阶段三 · 密集');

        if (this.timeLeft <= 0) this.endGame();
      },
    });
  }

  // ================================================================
  //  碰撞检测（挥刀切竹竿）
  // ================================================================
  private checkSlash(p: Phaser.Input.Pointer): void {
    if (this.slashPath.length < 2) return;
    const prev = this.slashPath[this.slashPath.length - 2];

    // 画挥刀轨迹（从粗到细的实线渐变）
    this.slashGfx?.clear();
    const pathLen = this.slashPath.length;
    const drawCount = Math.min(pathLen, 25);
    if (drawCount < 2) return;

    // 从尾部到头部逐段绘制，越靠近刀尖越粗越亮
    for (let i = pathLen - drawCount; i < pathLen - 1; i++) {
      const t = (i - (pathLen - drawCount)) / (drawCount - 2); // 0→1 从旧到新
      const width = 1 + t * 5;  // 尾部 1px，头部 6px
      const alpha = 0.2 + t * 0.6; // 尾部 0.2，头部 0.8
      // 颜色从暗绿 (74,143,74) 渐变到白 (255,255,255)
      const r = Math.floor(74 + t * 181);
      const g = Math.floor(143 + t * 112);
      const b = Math.floor(74 + t * 181);
      const hex = (r << 16) | (g << 8) | b;
      this.slashGfx?.lineStyle(width, hex, alpha);
      this.slashGfx?.beginPath();
      this.slashGfx?.moveTo(this.slashPath[i].x, this.slashPath[i].y);
      this.slashGfx?.lineTo(this.slashPath[i + 1].x, this.slashPath[i + 1].y);
      this.slashGfx?.strokePath();
    }

    // 刀光点
    this.slashGfx?.fillStyle(0xffffff, 0.9);
    this.slashGfx?.fillCircle(p.x, p.y, 5);

    // 检测线段与竹竿矩形相交
    this.bambooList.forEach((b) => {
      if (b.cut) return;
      const halfW = 70, halfH = 70;
      // 竹竿矩形（旋转后近似用轴对齐）
      const left = b.x - halfW, right = b.x + halfW;
      const top = b.y - halfH, bottom = b.y + halfH;

      if (this.lineIntersectsRect(prev.x, prev.y, p.x, p.y, left, top, right, bottom)) {
        this.cutBamboo(b);
      }
    });
  }

  private lineIntersectsRect(
    x1: number, y1: number, x2: number, y2: number,
    left: number, top: number, right: number, bottom: number,
  ): boolean {
    // 检查线段是否与矩形四条边相交 或 线段端点是否在矩形内
    if ((x1 >= left && x1 <= right && y1 >= top && y1 <= bottom) ||
        (x2 >= left && x2 <= right && y2 >= top && y2 <= bottom)) return true;

    const rectLines = [
      [left, top, right, top], [right, top, right, bottom],
      [right, bottom, left, bottom], [left, bottom, left, top],
    ];
    for (const [ax, ay, bx, by] of rectLines) {
      if (this.segmentsIntersect(x1, y1, x2, y2, ax, ay, bx, by)) return true;
    }
    return false;
  }

  private segmentsIntersect(
    x1: number, y1: number, x2: number, y2: number,
    x3: number, y3: number, x4: number, y4: number,
  ): boolean {
    const d1 = this.cross(x4 - x3, y4 - y3, x1 - x3, y1 - y3);
    const d2 = this.cross(x4 - x3, y4 - y3, x2 - x3, y2 - y3);
    const d3 = this.cross(x2 - x1, y2 - y1, x3 - x1, y3 - y1);
    const d4 = this.cross(x2 - x1, y2 - y1, x4 - x1, y4 - y1);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
           ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  }

  private cross(ax: number, ay: number, bx: number, by: number): number {
    return ax * by - ay * bx;
  }

  // ================================================================
  //  切开竹竿
  // ================================================================
  private cutBamboo(b: BambooData): void {
    b.cut = true;
    this.totalCut++;
    if (b.isGood) this.goodCut++;

    const st = this.getUIText('scoreText');
    if (st) st.setText(`🔪 劈开: ${this.totalCut}  |  🎋 良材: ${this.goodCut}`);

    // 劈开动画：原精灵图销毁 + 碎片飞出
    b.sprite.destroy();
    const texKey = b.isGood ? 'bamboo-green' : 'bamboo-brown';

    const half1 = this.add.image(b.x, b.y, texKey).setDepth(98).setScale(0.24).setCrop(0, 0, 256, 512);
    const half2 = this.add.image(b.x, b.y, texKey).setDepth(98).setScale(0.24).setCrop(256, 0, 256, 512);

    this.tweens.add({
      targets: half1, x: b.x - 60, y: b.y + 30, alpha: 0, duration: 400,
      onComplete: () => half1.destroy(),
    });
    this.tweens.add({
      targets: half2, x: b.x + 60, y: b.y + 30, alpha: 0, duration: 400,
      onComplete: () => half2.destroy(),
    });

    // 分数弹出
    const label = this.add.text(b.x, b.y, b.isGood ? '良材！' : '+1', {
      fontSize: '16px', color: b.isGood ? '#ffd700' : '#ffffff',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(110);
    this.tweens.add({
      targets: label, y: label.y - 40, alpha: 0, duration: 600,
      onComplete: () => label.destroy(),
    });

    // mark: already destroyed above
  }

  // ================================================================
  //  生成竹竿
  // ================================================================
  private spawnBamboo(): void {
    const w = this.cameras.main.width;
    const margin = 80;
    // 中间 1/3 区域概率更高（60% 在中间，40% 在两侧），左右各留 margin
    let x: number;
    const midStart = w * 0.33;
    const midEnd = w * 0.67;
    if (Math.random() < 0.6) {
      x = midStart + Math.random() * (midEnd - midStart); // 中间 1/3
    } else {
      x = margin + Math.random() * (midStart - margin); // 左侧
      if (Math.random() > 0.5) {
        x = midEnd + Math.random() * (w - margin - midEnd); // 右侧
      }
    }
    const y = -20;

    // 阶段参数
    const elapsed = 45 - this.timeLeft;
    let speed = 1.5;
    if (elapsed > 15) speed = 2.5;
    if (elapsed > 30) speed = 3.5;

    const isGood = Math.random() < 0.25; // 25% 良材

    const texKey = isGood ? 'bamboo-green' : 'bamboo-brown';
    const sprite = this.add.image(x, y, texKey).setDepth(50).setScale(0.24);
    const rotSpeed = (Math.random() - 0.5) * 0.03;

    this.bambooList.push({ sprite, x, y, speed, rotation: 0, rotSpeed, isGood, cut: false });
  }

  // ================================================================
  //  结算
  // ================================================================
  private endGame(): void {
    this.gameState = BambooState.RESULT;
    this.isSlashing = false;
    this.slashPath = [];
    this.slashGfx?.destroy(); this.slashGfx = null;
    this.knife?.destroy(); this.knife = null;
    this.game.canvas.style.cursor = "url('assets/hub/cursor-brush-32.png') 2 28, auto";
    this.timerEvent?.destroy();
    this.bambooList.forEach(b => b.sprite.destroy());
    this.bambooList = [];
    this.gameUI?.destroy(); this.gameUI = null;
    this.showResult();
  }

  private showResult(): void {
    const { width, height } = this.cameras.main;
    this.resultGroup = this.add.group();

    this.resultGroup.add(this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.65).setDepth(150));
    this.resultGroup.add(this.add.text(width / 2, height / 2 - 130, '「选杆」', {
      fontSize: '36px', color: '#7ec87e', fontStyle: 'bold',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    }).setOrigin(0.5).setDepth(151));
    this.resultGroup.add(this.add.text(width / 2, height / 2 - 85, '天目劲竹，直而中通', {
      fontSize: '22px', color: '#e8f0e8',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    }).setOrigin(0.5).setDepth(151));
    this.resultGroup.add(this.add.text(width / 2, height / 2 - 10,
      `你劈开 ${this.totalCut} 节竹竿，选得良材 ${this.goodCut} 节。`, {
        fontSize: '20px', color: '#ffd700',
        fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
      }).setOrigin(0.5).setDepth(151));

    const replayBtn = this.add.text(width / 2 - 90, height / 2 + 70, '再来一次', {
      fontSize: '22px', color: '#1a2e1a', fontStyle: 'bold',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
      backgroundColor: '#7ec87e', padding: { x: 28, y: 12 },
    }).setOrigin(0.5).setDepth(151).setInteractive();
    replayBtn.on('pointerover', () => replayBtn.setAlpha(0.85));
    replayBtn.on('pointerout', () => replayBtn.setAlpha(1));
    replayBtn.on('pointerdown', () => {
      this.destroyGroup(this.resultGroup); this.resultGroup = null;
      this.startGame();
    });
    this.resultGroup.add(replayBtn);

    const backBtn = this.add.text(width / 2 + 90, height / 2 + 70, '回到小船', {
      fontSize: '22px', color: '#e8f0e8', fontStyle: 'bold',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
      backgroundColor: '#0d1a0d', padding: { x: 28, y: 12 },
    }).setOrigin(0.5).setDepth(151).setInteractive();
    backBtn.on('pointerover', () => backBtn.setAlpha(0.85));
    backBtn.on('pointerout', () => backBtn.setAlpha(1));
    backBtn.on('pointerdown', () => {
      this.cameras.main.fadeOut(500, 0x1a, 0x1a, 0x2e);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('HubScene', { dockKey: 'bamboo' }));
    });
    this.resultGroup.add(backBtn);
  }

  // ================================================================
  //  UPDATE
  // ================================================================
  update(_time: number, delta: number): void {
    if (this.gameState !== BambooState.PLAYING) return;

    const height = this.cameras.main.height;

    // 生成竹竿间隔
    const elapsed = 45 - this.timeLeft;
    let spawnInterval = 448;
    if (elapsed > 15) spawnInterval = 288;
    if (elapsed > 30) spawnInterval = 179;

    this.spawnTimer += delta;
    if (this.spawnTimer > spawnInterval) {
      this.spawnTimer -= spawnInterval;
      this.spawnBamboo();
    }

    // 更新竹竿
    this.bambooList.forEach((b) => {
      if (b.cut) return;
      b.y += b.speed * (delta / 16);
      b.rotation += b.rotSpeed * (delta / 16);
      b.sprite.setPosition(b.x, b.y);
      b.sprite.setRotation(b.rotation);

      // 超出屏幕底部 → 消失
      if (b.y > height + 30) {
        b.sprite.destroy();
      }
    });

    // 清理已销毁的竹竿
    this.bambooList = this.bambooList.filter(b => {
      if (b.cut || b.y > height + 30) return false;
      return true;
    });
  }

  // ================================================================
  //  工具
  // ================================================================
  private getUIText(name: string): Phaser.GameObjects.Text | null {
    if (!this.gameUI) return null;
    return this.gameUI.getByName(name) as Phaser.GameObjects.Text;
  }

  private clearAllUI(): void {
    this.destroyGroup(this.introGroup);
    this.destroyGroup(this.resultGroup);
    this.gameUI?.destroy(); this.gameUI = null;
    this.introGroup = null; this.resultGroup = null;
  }

  private destroyGroup(g: GameObjects.Group | null): void {
    if (!g) return;
    g.destroy(true);
  }
}