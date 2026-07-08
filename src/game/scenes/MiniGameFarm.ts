import { Scene, GameObjects, Math as PhaserMath } from 'phaser';
import { playBgm, createMusicToggleBtn } from '../MusicManager';

// ── 动物状态枚举 ──
const enum AnimalState {
  WALKING_LEFT,
  WALKING_RIGHT,
  STANDING,
  EATING,
  DODGING,
}

// ── 场景子状态 ──
const enum FarmState {
  INTRO,
  PLAYING,
  RESULT,
}

// ── 动物数据接口 ──
interface AnimalData {
  type: 'goat' | 'rabbit';
  container: GameObjects.Container;
  sprite: GameObjects.Image;
  grassIcon: GameObjects.Text;
  state: AnimalState;
  x: number;
  y: number;
  speed: number;
  woolYielded: number;
  maxYield: number;
  stateTimer: number;
  direction: number;
}

/**
 * MiniGameFarm - 河畔牧场关卡（择料）
 */
export class MiniGameFarm extends Scene {
  private farmState: FarmState = FarmState.INTRO;
  private animalList: AnimalData[] = [];
  private totalWool = 0;
  private premiumWool = 0;
  private timeLeft = 45;
  private timerEvent: Phaser.Time.TimerEvent | null = null;

  private introGroup: GameObjects.Group | null = null;
  private gameUI: GameObjects.Container | null = null;
  private resultGroup: GameObjects.Group | null = null;

  private isBrushing = false;
  private combSprite: GameObjects.Image | null = null;
  private brushTrail: GameObjects.Graphics | null = null;
  private woolsCollectedThisFrame = 0;
  private rabbitSpawnTimer: Phaser.Time.TimerEvent | null = null;

  private basketLeft: { x: number; y: number } = { x: 0, y: 0 };
  private basketRight: { x: number; y: number } = { x: 0, y: 0 };

  constructor() {
    super('MiniGameFarm');
  }

  create(): void {
    const { width, height } = this.cameras.main;
    this.add.image(width / 2, height / 2, 'farm-bg')
      .setDisplaySize(width, height).setDepth(0);

    // 场景关闭时重置光标，防止 'none' 残留到其他场景
    this.events.on('shutdown', () => {
      this.game.canvas.style.cursor = "url('assets/hub/cursor-brush-32.png') 2 28, auto";
    });

    playBgm(this, 'farm-bgm', 0.4);

    this.showIntro();
    this.cameras.main.fadeIn(500, 0x1a, 0x1a, 0x2e);
  }

  // ================================================================
  //  INTRO
  // ================================================================
  private showIntro(): void {
    this.farmState = FarmState.INTRO;
    const { width, height } = this.cameras.main;
    this.clearAllUI();
    this.introGroup = this.add.group();

    // 播放开场人声说明
    this.sound.add('farm-intro', { loop: false, volume: 0.8 }).play();

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6).setDepth(50);
    this.introGroup.add(overlay);

    const lines = [
      '湖笔制作的第一步是「择料」。',
      '上好的湖笔可选用山羊和兔子身上细软而有弹性的毛，',
      '其中适合制笔的"锋颖"数量并不多，需要细心挑选。',
      '——',
      '趁山羊和兔子吃草时，梳取可制笔的毛料。',
    ];
    const yStart = height / 2 - 120;
    lines.forEach((line, i) => {
      const txt = this.add.text(width / 2, yStart + i * 42, line, {
        fontSize: '22px',
        color: i === 3 ? '#c9a96e' : '#f0e6d3',
        fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
      }).setOrigin(0.5).setDepth(51);
      this.introGroup!.add(txt);
    });

    const startBtn = this.add.text(width / 2, height / 2 + 130, '开 始 择 料', {
      fontSize: '28px', color: '#1a1a2e', fontStyle: 'bold',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
      backgroundColor: '#c9a96e', padding: { x: 40, y: 14 },
    }).setOrigin(0.5).setDepth(51);
    this.introGroup.add(startBtn);
    const startHit = this.add.rectangle(width / 2, height / 2 + 130, 220, 56, 0xc9a96e, 0.001)
      .setDepth(52).setInteractive();
    startHit.on('pointerover', () => startBtn.setAlpha(0.85));
    startHit.on('pointerout', () => startBtn.setAlpha(1));
    startHit.on('pointerdown', () => {
      this.destroyGroup(this.introGroup);
      this.introGroup = null;
      this.startGame();
    });
    this.introGroup.add(startHit);

    const backBtn = this.add.text(width - 20, 30, '回到小船', {
      fontSize: '16px', color: '#d4c4a8',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
      backgroundColor: '#1a1a2ecc', padding: { x: 12, y: 6 },
    }).setOrigin(1, 0).setDepth(51);
    this.introGroup.add(backBtn);
    const backHit = this.add.rectangle(width - 20, 30, 100, 34, 0x1a1a2e, 0.001)
      .setOrigin(1, 0).setDepth(52).setInteractive();
    backHit.on('pointerover', () => backBtn.setAlpha(0.7));
    backHit.on('pointerout', () => backBtn.setAlpha(1));
    backHit.on('pointerdown', () => {
      this.cameras.main.fadeOut(500, 0x1a, 0x1a, 0x2e);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('HubScene', { dockKey: 'farm' }));
    });
    this.introGroup.add(backHit);

    const musicBtn = createMusicToggleBtn(this, width - 130, 30, 51);
    this.introGroup.add(musicBtn);
  }

  // ================================================================
  //  START GAME
  // ================================================================
  private startGame(): void {
    this.farmState = FarmState.PLAYING;
    const { width, height } = this.cameras.main;
    this.totalWool = 0; this.premiumWool = 0; this.timeLeft = 45;
    this.animalList = [];

    this.basketLeft  = { x: width * 0.4,  y: height - 90 };
    this.basketRight = { x: width * 0.6,  y: height - 90 };

    // 前20秒：只有10只山羊在活动
    for (let i = 0; i < 10; i++) this.createAnimal(width, height, 'goat');

    // 第21秒：10只兔子从左侧进入
    this.rabbitSpawnTimer = this.time.delayedCall(20000, () => {
      this.spawnRabbitWave(width, height);
    });

    // ── UI ──
    this.gameUI = this.add.container(0, 0).setDepth(100);

    const barBg = this.add.rectangle(width / 2, 22, width, 44, 0x1a1a2e, 0.75);
    this.gameUI.add(barBg);

    const timerText = this.add.text(78, 22, '45s', {
      fontSize: '20px', color: '#ffd700', fontStyle: 'bold',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    }).setOrigin(0, 0.5);
    timerText.setName('timerText');
    this.gameUI.add(timerText);

    const woolText = this.add.text(width / 2, 22, '🧶 毛料: 0  |  ✨ 锋颖: 0', {
      fontSize: '18px', color: '#f0e6d3',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    }).setOrigin(0.5);
    woolText.setName('woolText');
    this.gameUI.add(woolText);

    const exitBtn = this.add.text(width - 20, 22, '✕ 退出', {
      fontSize: '16px', color: '#d4c4a8',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
      backgroundColor: '#1a1a2ecc', padding: { x: 10, y: 4 },
    }).setOrigin(1, 0.5).setDepth(101);
    this.gameUI.add(exitBtn);
    const exitHit = this.add.rectangle(width - 20, 22, 70, 30, 0x1a1a2e, 0.001)
      .setOrigin(1, 0.5).setDepth(102).setInteractive();
    exitHit.on('pointerdown', () => this.endGame());
    this.gameUI.add(exitHit);

    this.createBaskets(width, height);

    this.combSprite = this.add.image(-100, -100, 'comb').setDepth(99).setScale(0.04);
    this.brushTrail?.destroy();
    this.brushTrail = this.add.graphics().setDepth(98);

    this.game.canvas.style.cursor = 'none';

    // 清除旧的事件监听器，防止 replay 时累积
    this.input.off('pointerdown');
    this.input.off('pointermove');
    this.input.off('pointerup');

    this.input.on('pointerdown', () => {
      if (this.farmState !== FarmState.PLAYING) return;
      this.isBrushing = true;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.farmState !== FarmState.PLAYING) return;
      if (this.isBrushing) {
        this.combSprite?.setPosition(p.x + 20, p.y + 20);
        this.updateBrushing(p);
      } else {
        this.combSprite?.setPosition(p.x, p.y);
      }
    });
    this.input.on('pointerup', () => {
      this.isBrushing = false;
      this.brushTrail?.clear();
    });

    this.timerEvent = this.time.addEvent({
      delay: 1000, repeat: 44,
      callback: () => {
        this.timeLeft--;
        const t = this.getUIText('timerText');
        if (t) { t.setText(`${this.timeLeft}s`); if (this.timeLeft <= 10) t.setColor('#ff4444'); }
        if (this.timeLeft <= 0) this.endGame();
      },
    });
  }

  // ================================================================
  //  篮筐
  // ================================================================
  private createBaskets(_w: number, h: number): void {
    const basketY = h - 90;
    const leftBasket = this.add.image(this.basketLeft.x, basketY, 'zhukuang').setDepth(101).setScale(0.06);
    const rightBasket = this.add.image(this.basketRight.x, basketY, 'zhukuang').setDepth(101).setScale(0.06);

    const leftLabel = this.add.text(this.basketLeft.x, basketY + 55, '普通毛料', {
      fontSize: '13px', color: '#f0e6d3',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    }).setOrigin(0.5).setDepth(101);
    const leftCount = this.add.text(this.basketLeft.x, basketY + 72, '0', {
      fontSize: '16px', color: '#ffd700', fontStyle: 'bold',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    }).setOrigin(0.5).setDepth(101);
    leftCount.setName('basketLeftCount');

    const rightLabel = this.add.text(this.basketRight.x, basketY + 55, '锋颖', {
      fontSize: '13px', color: '#ffd700',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    }).setOrigin(0.5).setDepth(101);
    const rightCount = this.add.text(this.basketRight.x, basketY + 72, '0', {
      fontSize: '16px', color: '#ffd700', fontStyle: 'bold',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    }).setOrigin(0.5).setDepth(101);
    rightCount.setName('basketRightCount');

    this.gameUI!.add([leftBasket, leftLabel, leftCount, rightBasket, rightLabel, rightCount]);
  }

  // ================================================================
  //  创建动物
  // ================================================================
  private getTexturePrefix(type: 'goat' | 'rabbit'): string {
    return type === 'goat' ? 'goat' : 'rabbit';
  }

  private getAnimalScale(type: 'goat' | 'rabbit'): number {
    return type === 'goat' ? 0.12 : 0.06;
  }

  private createAnimal(w: number, h: number, type: 'goat' | 'rabbit'): void {
    const marginX = 140, marginTop = Math.floor(h * 0.35), marginBottom = 120;
    const x = marginX + Math.random() * (w - marginX * 2);
    const y = marginTop + Math.random() * (h - marginTop - marginBottom);
    const dir = Math.random() > 0.5 ? 1 : -1;

    const container = this.add.container(x, y).setDepth(type === 'goat' ? 20 : 19);

    const prefix = this.getTexturePrefix(type);
    const scale = this.getAnimalScale(type);
    const isRight = dir === 1;
    const sprite = this.add.image(0, 0, `${prefix}-${isRight ? 'right' : 'left'}`);
    sprite.setScale(scale, scale);
    container.add(sprite);

    // 吃草标识（兔子更小，图标位置也调整）
    const iconY = type === 'goat' ? -65 : -45;
    const grassIcon = this.add.text(0, iconY, '🌿', { fontSize: type === 'goat' ? '24px' : '18px' }).setOrigin(0.5).setVisible(false);
    container.add(grassIcon);

    this.animalList.push({
      type,
      container,
      sprite,
      grassIcon,
      state: dir > 0 ? AnimalState.WALKING_RIGHT : AnimalState.WALKING_LEFT,
      x, y, speed: 0.12 + Math.random() * 0.25,
      woolYielded: 0, maxYield: 5 + Math.floor(Math.random() * 8),
      stateTimer: 1000 + Math.random() * 3000,
      direction: dir,
    });
  }

  // ================================================================
  //  兔子波次：第21秒从左侧进入
  // ================================================================
  private spawnRabbitWave(w: number, h: number): void {
    if (this.farmState !== FarmState.PLAYING) return;

    const marginTop = Math.floor(h * 0.35), marginBottom = 120;
    const entryX = 110; // 从左侧边缘外进入

    for (let i = 0; i < 10; i++) {
      const y = marginTop + Math.random() * (h - marginTop - marginBottom);
      const container = this.add.container(entryX, y).setDepth(19);

      const scale = 0.06;
      const sprite = this.add.image(0, 0, 'rabbit-right');
      sprite.setScale(scale, scale);
      container.add(sprite);

      const grassIcon = this.add.text(0, -45, '🌿', { fontSize: '18px' }).setOrigin(0.5).setVisible(false);
      container.add(grassIcon);

      // 入场动画：从左侧滑入
      const targetX = 140 + 50 + Math.random() * (w - 200);
      this.tweens.add({
        targets: container,
        x: targetX,
        duration: 800 + Math.random() * 600,
        ease: 'Quad.easeOut',
        delay: i * 250, // 依次进入，间隔0.25秒
      });

      this.animalList.push({
        type: 'rabbit',
        container,
        sprite,
        grassIcon,
        state: AnimalState.WALKING_RIGHT,
        x: targetX, y,
        speed: 0.12 + Math.random() * 0.25,
        woolYielded: 0,
        maxYield: 5 + Math.floor(Math.random() * 8),
        stateTimer: 1500 + Math.random() * 2000, // 先走一段再切换状态
        direction: 1,
      });
    }
  }

  // ================================================================
  //  梳毛
  // ================================================================
  private updateBrushing(pointer: Phaser.Input.Pointer): void {
    this.brushTrail?.clear();
    this.brushTrail?.fillStyle(0xc9a96e, 0.3);
    this.brushTrail?.fillCircle(pointer.x + 20, pointer.y + 20, 8);
    this.woolsCollectedThisFrame = 0;

    this.animalList.forEach((ad) => {
      if (ad.state !== AnimalState.EATING) return;
      if (this.woolsCollectedThisFrame >= 3) return;
      const dx = ad.container.x - (pointer.x + 20);
      const dy = ad.container.y - (pointer.y + 20);
      if (Math.sqrt(dx * dx + dy * dy) < 55) {
        this.woolsCollectedThisFrame++;
        this.collectWool(ad);
      }
    });
  }

  // ================================================================
  //  收集羊毛
  // ================================================================
  private collectWool(ad: AnimalData): void {
    ad.woolYielded++;
    const isPremium = Math.random() < 0.2;
    if (isPremium) this.premiumWool++;
    this.totalWool++;

    const wt = this.getUIText('woolText');
    if (wt) wt.setText(`🧶 毛料: ${this.totalWool}  |  ✨ 锋颖: ${this.premiumWool}`);

    const leftCount = this.getUIText('basketLeftCount');
    if (leftCount) leftCount.setText(String(this.totalWool - this.premiumWool));
    const rightCount = this.getUIText('basketRightCount');
    if (rightCount) rightCount.setText(String(this.premiumWool));

    const target = isPremium ? this.basketRight : this.basketLeft;
    const fromX = ad.container.x;
    const fromY = ad.container.y - 20;

    const woolKey = isPremium ? 'wool-glowing' : 'wool-ball';
    const woolScale = isPremium ? 0.06 : 0.04;
    const wool = this.add.image(fromX, fromY, woolKey).setScale(woolScale).setDepth(98);
    this.tweens.add({
      targets: wool,
      x: target.x, y: target.y, alpha: 0.3,
      duration: 550, ease: 'Quad.easeIn',
      onUpdate: () => {
        const progress = (wool.x - fromX) / (target.x - fromX + 0.001);
        wool.y = fromY + (target.y - fromY) * progress - Math.sin(progress * Math.PI) * 60;
      },
      onComplete: () => {
        wool.setAlpha(1);
        this.tweens.add({
          targets: wool, y: target.y + 4, duration: 100, yoyo: true,
          onComplete: () => {
            wool.destroy();
            if (this.gameUI) {
              this.tweens.killTweensOf(this.gameUI);
              this.tweens.add({ targets: this.gameUI, y: -3, duration: 80, yoyo: true });
            }
          },
        });
      },
    });

    if (ad.woolYielded >= ad.maxYield) {
      ad.state = AnimalState.DODGING;
      ad.grassIcon.setVisible(false);
      const targetX = ad.container.x + ad.direction * 300;
      this.tweens.add({
        targets: ad.container, x: targetX, duration: 600, ease: 'Quad.easeIn',
        onComplete: () => this.resetAnimal(ad),
      });
    }
  }

  // ================================================================
  //  重置动物
  // ================================================================
  private resetAnimal(ad: AnimalData): void {
    const { width, height } = this.cameras.main;
    const marginX = 140, marginTop = Math.floor(height * 0.35), marginBottom = 120;
    const dir = Math.random() > 0.5 ? 1 : -1;
    ad.x = marginX + Math.random() * (width - marginX * 2);
    ad.y = marginTop + Math.random() * (height - marginTop - marginBottom);
    ad.direction = dir;
    ad.woolYielded = 0;
    ad.maxYield = 5 + Math.floor(Math.random() * 8);
    ad.speed = 0.12 + Math.random() * 0.25;
    ad.stateTimer = 1000 + Math.random() * 3000;
    ad.state = dir > 0 ? AnimalState.WALKING_RIGHT : AnimalState.WALKING_LEFT;
    ad.container.setPosition(ad.x, ad.y).setAlpha(1).setScale(1);
    ad.grassIcon.setVisible(false);

    const prefix = this.getTexturePrefix(ad.type);
    ad.sprite.setTexture(`${prefix}-${dir > 0 ? 'right' : 'left'}`);
    const scale = this.getAnimalScale(ad.type);
    ad.sprite.setScale(scale, scale);
  }

  // ================================================================
  //  结算
  // ================================================================
  private endGame(): void {
    // 防止重复调用
    if (this.farmState === FarmState.RESULT) return;
    this.farmState = FarmState.RESULT;
    this.isBrushing = false;

    // 移除输入事件监听，防止梳毛操作干扰结算
    this.input.off('pointerdown');
    this.input.off('pointermove');
    this.input.off('pointerup');

    // 杀死所有 tweens，防止动画操作已销毁对象
    this.tweens.killAll();

    this.combSprite?.destroy(); this.combSprite = null;
    this.game.canvas.style.cursor = "url('assets/hub/cursor-brush-32.png') 2 28, auto";
    this.timerEvent?.destroy();
    this.rabbitSpawnTimer?.destroy(); this.rabbitSpawnTimer = null;
    this.brushTrail?.destroy(); this.brushTrail = null;
    this.animalList.forEach(ad => ad.container.destroy());
    this.animalList = [];
    this.gameUI?.destroy(); this.gameUI = null;
    this.showResult();
  }

  private showResult(): void {
    const { width, height } = this.cameras.main;
    this.resultGroup = this.add.group();

    this.resultGroup.add(this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.65).setDepth(150));
    this.resultGroup.add(this.add.text(width / 2, height / 2 - 130, '「择料」', {
      fontSize: '36px', color: '#c9a96e', fontStyle: 'bold',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    }).setOrigin(0.5).setDepth(151));
    this.resultGroup.add(this.add.text(width / 2, height / 2 - 85, '毛料锋颖，笔之上材', {
      fontSize: '22px', color: '#f0e6d3',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    }).setOrigin(0.5).setDepth(151));
    this.resultGroup.add(this.add.text(width / 2, height / 2 - 10,
      `你梳到 ${this.totalWool} 根毛料，其中锋颖 ${this.premiumWool} 根。`, {
        fontSize: '20px', color: '#ffd700',
        fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
      }).setOrigin(0.5).setDepth(151));

    const replayBtn = this.add.text(width / 2 - 90, height / 2 + 70, '再来一次', {
      fontSize: '22px', color: '#1a1a2e', fontStyle: 'bold',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
      backgroundColor: '#c9a96e', padding: { x: 28, y: 12 },
    }).setOrigin(0.5).setDepth(151);
    this.resultGroup.add(replayBtn);
    const replayHit = this.add.rectangle(width / 2 - 90, height / 2 + 70, 160, 48, 0xc9a96e, 0.001)
      .setDepth(152).setInteractive();
    replayHit.on('pointerover', () => replayBtn.setAlpha(0.85));
    replayHit.on('pointerout', () => replayBtn.setAlpha(1));
    replayHit.on('pointerdown', () => {
      this.destroyGroup(this.resultGroup); this.resultGroup = null;
      this.startGame();
    });
    this.resultGroup.add(replayHit);

    const backBtn = this.add.text(width / 2 + 90, height / 2 + 70, '回到小船', {
      fontSize: '22px', color: '#f0e6d3', fontStyle: 'bold',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
      backgroundColor: '#1a1a2e', padding: { x: 28, y: 12 },
    }).setOrigin(0.5).setDepth(151);
    this.resultGroup.add(backBtn);
    const backHit = this.add.rectangle(width / 2 + 90, height / 2 + 70, 160, 48, 0x1a1a2e, 0.001)
      .setDepth(152).setInteractive();
    backHit.on('pointerover', () => backBtn.setAlpha(0.85));
    backHit.on('pointerout', () => backBtn.setAlpha(1));
    backHit.on('pointerdown', () => {
      this.cameras.main.fadeOut(500, 0x1a, 0x1a, 0x2e);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('HubScene', { dockKey: 'farm' }));
    });
    this.resultGroup.add(backHit);
  }

  // ================================================================
  //  UPDATE
  // ================================================================
  update(_time: number, delta: number): void {
    if (this.farmState !== FarmState.PLAYING) return;

    const { width, height } = this.cameras.main;
    const fieldLeft = 140, fieldRight = width - 140;
    const fieldTop = Math.floor(height * 0.35), fieldBottom = height - 120;

    this.animalList.forEach((ad) => {
      if (ad.state === AnimalState.DODGING) return;
      ad.stateTimer -= delta;

      const prefix = this.getTexturePrefix(ad.type);
      const baseScale = this.getAnimalScale(ad.type);
      const hasStand = ad.type === 'goat'; // 兔子没有站立状态

      // 走动轻微摆动
      if (ad.state === AnimalState.WALKING_LEFT || ad.state === AnimalState.WALKING_RIGHT) {
        const sway = Math.sin(_time * 0.015 + ad.x) * 2 * (ad.speed / 0.2);
        const scaleY = baseScale * (1 + sway * 0.02);
        ad.sprite.setScale(baseScale, scaleY);
      } else {
        ad.sprite.setScale(baseScale, baseScale);
      }

      switch (ad.state) {
        case AnimalState.WALKING_LEFT:
        case AnimalState.WALKING_RIGHT:
          ad.container.x += (ad.state === AnimalState.WALKING_RIGHT ? ad.speed : -ad.speed) * delta;
          ad.direction = ad.state === AnimalState.WALKING_RIGHT ? 1 : -1;

          if (ad.container.x < fieldLeft) {
            ad.container.x = fieldLeft; ad.state = AnimalState.WALKING_RIGHT;
          } else if (ad.container.x > fieldRight) {
            ad.container.x = fieldRight; ad.state = AnimalState.WALKING_LEFT;
          }

          ad.container.y += (Math.random() - 0.5) * 0.3 * delta;
          ad.container.y = PhaserMath.Clamp(ad.container.y, fieldTop, fieldBottom);

          if (ad.stateTimer <= 0) {
            const r = Math.random();
            if (hasStand && r < 0.5) {
              ad.state = AnimalState.STANDING;
              ad.stateTimer = 1500 + Math.random() * 2000;
              ad.sprite.setTexture(`${prefix}-stand`);
              ad.sprite.setScale(baseScale, baseScale);
            } else if (r < 0.7) {
              ad.state = AnimalState.EATING;
              ad.stateTimer = 2000 + Math.random() * 3000;
              ad.sprite.setTexture(`${prefix}-graze`);
              ad.sprite.setScale(baseScale * 1.1, baseScale * 1.1);
              ad.grassIcon.setVisible(true);
            } else {
              ad.state = Math.random() > 0.5 ? AnimalState.WALKING_LEFT : AnimalState.WALKING_RIGHT;
              ad.stateTimer = 1000 + Math.random() * 3000;
            }
          }
          break;

        case AnimalState.STANDING:
          if (!hasStand) {
            ad.state = AnimalState.EATING;
            ad.stateTimer = 2000 + Math.random() * 3000;
            ad.sprite.setTexture(`${prefix}-graze`);
            ad.sprite.setScale(baseScale * 1.1, baseScale * 1.1);
            ad.grassIcon.setVisible(true);
            break;
          }
          ad.sprite.setTexture(`${prefix}-stand`);
          ad.sprite.setScale(baseScale, baseScale);
          if (ad.stateTimer <= 0) {
            const r = Math.random();
            if (r < 0.25) {
              ad.state = AnimalState.EATING;
              ad.stateTimer = 2000 + Math.random() * 3000;
              ad.sprite.setTexture(`${prefix}-graze`);
              ad.sprite.setScale(baseScale * 1.1, baseScale * 1.1);
              ad.grassIcon.setVisible(true);
            } else if (r < 0.55) {
              ad.state = Math.random() > 0.5 ? AnimalState.WALKING_LEFT : AnimalState.WALKING_RIGHT;
              ad.stateTimer = 1000 + Math.random() * 3000;
            } else {
              ad.stateTimer = 1000 + Math.random() * 2000;
            }
          }
          break;

        case AnimalState.EATING:
          ad.sprite.setTexture(`${prefix}-graze`);
          ad.sprite.setScale(baseScale * 1.1, baseScale * 1.1);
          ad.container.x += Math.sin(_time * 0.006 + ad.x) * 0.08 * delta;
          if (ad.stateTimer <= 0) {
            ad.grassIcon.setVisible(false);
            ad.state = Math.random() > 0.5 ? AnimalState.WALKING_LEFT : AnimalState.WALKING_RIGHT;
            ad.stateTimer = 1000 + Math.random() * 3000;
          }
          break;
      }

      // 根据状态设置行走纹理
      if (ad.state === AnimalState.WALKING_LEFT || ad.state === AnimalState.WALKING_RIGHT) {
        const isRight = ad.state === AnimalState.WALKING_RIGHT;
        ad.sprite.setTexture(`${prefix}-${isRight ? 'right' : 'left'}`);
      }

      ad.x = ad.container.x;
      ad.y = ad.container.y;
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