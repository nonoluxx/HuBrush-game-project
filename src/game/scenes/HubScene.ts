import { Scene, Curves, GameObjects, Math as PhaserMath } from 'phaser';
import { playBgm, createMusicToggleBtn } from '../MusicManager';

/**
 * HubScene - 主世界（江南水乡全景河道 + 五个建筑节点）
 *
 * 背景图：江南水乡全景河道.jpg（1368x768，水墨风）
 * 航线：码头 → 湖畔牧场 → 天目竹林 → 临水作坊 → 善琏笔庄 → (680,180) → 挥墨亭
 */

/** 建筑地标定义 */
interface Landmark {
  key: string;            // 建筑标识
  name: string;           // 建筑名称
  progress: number;       // 在路径上的进度位置 (0-1)
  sceneKey?: string;      // 小游戏场景 key
  isDock?: boolean;       // 是否为码头（不可点击进入小游戏）
}

export class HubScene extends Scene {
  /** S 形河道路径 */
  private riverPath!: Curves.Path;

  /** 小船容器 */
  private boat!: GameObjects.Container;
  private boatImg!: GameObjects.Image;

  /** 当前航段进度 */
  private currentProgress: number = 0;

  /** 目标航点 */
  private targetProgress: number = 0;

  /** 是否正在移动 */
  private isMoving: boolean = false;

  /** 建筑地标数据（progress 值会在 createRiverPath 后动态计算） */
  private landmarks: Landmark[] = [
    { key: 'dock',     name: '码头',       progress: 0.00, isDock: true },
    { key: 'farm',     name: '河畔牧场',   progress: 0.00, sceneKey: 'MiniGameFarm' },
    { key: 'bamboo',   name: '天目竹林',   progress: 0.00, sceneKey: 'MiniGameBamboo' },
    { key: 'workshop', name: '临水作坊',   progress: 0.00, sceneKey: 'MiniGameWorkshop' },
    { key: 'shop',     name: '善琏笔庄',   progress: 0.00, sceneKey: 'MiniGameShop' },
    { key: 'pavilion', name: '挥墨亭',     progress: 0.00, sceneKey: 'MiniGamePavilion' },
  ];

  /** 建筑容器引用 */
  private buildingSprites: Map<string, GameObjects.Container> = new Map();

  /** 已点亮的建筑集合 */
  private activatedSet: Set<string> = new Set();

  constructor() {
    super('HubScene');
  }

  preload(): void {
    // 背景音乐按需加载（不阻塞启动）
    this.load.audio('main-bgm', 'assets/audio/main-background.mp3');
  }

  create(): void {
    const { width, height } = this.cameras.main;

    this.createBackground(width, height);
    this.createRiverPath(width, height);
    this.createWaterEffect();
    this.createBoat();
    this.createLandmarks();

    // 如果从子关卡返回，船停靠在对应码头上
    const sceneData = this.scene.settings.data as Record<string, unknown> | undefined;
    const dockKey = sceneData?.dockKey as string | undefined;
    if (dockKey && dockKey !== 'dock') {
      const lm = this.landmarks.find(l => l.key === dockKey);
      if (lm) {
        this.currentProgress = lm.progress;
        this.targetProgress = lm.progress;
        const point = this.riverPath.getPoint(lm.progress);
        if (point) {
          this.boat.setPosition(point.x, point.y);
          this.activatedSet.add(lm.key);
          // 重新创建浮动动画
          this.tweens.killTweensOf(this.boat);
          this.tweens.add({
            targets: this.boat,
            y: point.y + 2,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        }
      }
    }

    // 所有建筑初始就显示"点击探索"提示
    this.showAllIndicators();

    // 背景音乐
    playBgm(this, 'main-bgm', 0.4);

    // 右下角音乐开关（草灰绿底 + 灰白字）
    createMusicToggleBtn(this, width - 20, height - 46, 100, {
      fontSize: '16px',
      color: '#e8e8e0',
      backgroundColor: '#7a8a6acc',
      mutedBgColor: '#5a3030cc',
      padding: { x: 12, y: 6 },
      slashColor: '#e8e8e0',
      originX: 1,
    });

    // 自定义毛笔光标（笔尖位置设为热点，约(2, 28)）
    this.game.canvas.style.cursor = "url('assets/hub/cursor-brush-32.png') 2 28, auto";

    // 交互提示（左下角，与音乐开关水平对齐）
    this.add.text(20, height - 46, '乘上小船，开启制笔之旅', {
      fontSize: '16px',
      color: '#d4c4a8',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
      backgroundColor: '#1a1a2e99',
      padding: { x: 12, y: 6 },
    }).setOrigin(0, 0.5).setDepth(100);

    // 码头和河畔牧场初始已激活
    this.activatedSet.add(this.landmarks[0].key);
    this.activatedSet.add(this.landmarks[1].key);

    this.cameras.main.fadeIn(500, 0x1a, 0x1a, 0x2e);
  }

  /**
   * 加载江南水乡全景背景图
   */
  private createBackground(w: number, h: number): void {
    this.add.image(w / 2, h / 2, 'river-bg')
      .setDisplaySize(w, h)
      .setDepth(0);
    this.add.rectangle(w / 2, h / 2, w, h, 0x8b7355, 0.08).setDepth(1);
  }

  /**
   * 创建河道路径（依次经过所有地标）
   *
   * 航线：码头(180,570) → 湖畔牧场(350,420) → 天目竹林(880,480)
   *       → 临水作坊(700,250) → 善琏笔庄(1150,280) → (680,180) → 挥墨亭(1100,70)
   */
  private createRiverPath(_w: number, _h: number): void {
    // 起点：码头，Spline 第一个点就是码头，确保码头到湖畔牧场有连线
    this.riverPath = new Curves.Path(180, 590);

    // 用船停靠点坐标作为路径控制点，船会精确停泊在每个停靠位置
    this.riverPath.add(new Curves.Spline([
      180, 590,    // 码头停靠点
      310, 610,    // 下凹控制点1
      420, 560,    // 下凹控制点2（往竹林方向凹）
      440, 460,    // 平滑过渡点
      450, 380,    // 湖畔牧场停靠点
      620, 500,    // 天目竹林停靠点
      730, 310,    // 临水作坊停靠点
      1020, 280,   // 善琏笔庄停靠点
      680, 180,    // 中继点
      1020, 100,   // 挥墨亭停靠点
    ]));

    // 动态计算每个地标的真实 progress 值
    // 在路径上密集采样 1000 个点，找到离每个停靠点最近的 t 值
    this.landmarks.forEach((lm) => {
      const dockPos = this.getDockPixelPos(lm.key);
      if (!dockPos) return;

      let bestT = 0;
      let bestDist = Infinity;
      for (let i = 0; i <= 1000; i++) {
        const t = i / 1000;
        const p = this.riverPath.getPoint(t);
        if (!p) continue;
        const dist = Math.abs(p.x - dockPos.x) + Math.abs(p.y - dockPos.y);
        if (dist < bestDist) {
          bestDist = dist;
          bestT = t;
        }
      }
      lm.progress = bestT;
      console.log(`[路径校准] ${lm.name}: t=${bestT.toFixed(4)}, 距离=${bestDist.toFixed(1)}px`);
    });

  }

  // 码头位置索引（用于小船停靠）

  /**
   * 根据地标 key 获取建筑显示坐标
   */
  private getLandmarkPixelPos(key: string): { x: number; y: number } | undefined {
    const posMap: Record<string, { x: number; y: number }> = {
      dock:     { x: 180, y: 540 },   // 码头图标位置
      farm:     { x: 310, y: 380 },   // 河畔牧场 ←
      bamboo:   { x: 660, y: 610 },   // 天目竹林 ↙
      workshop: { x: 700, y: 250 },   // 临水作坊
      shop:     { x: 1150, y: 280 },  // 善琏笔庄
      pavilion: { x: 1100, y: 100 },   // 挥墨亭
    };
    return posMap[key];
  }

  /**
   * 根据地标 key 获取船停靠坐标（船在河道上的停泊位置，可能与建筑位置不同）
   */
  private getDockPixelPos(key: string): { x: number; y: number } | undefined {
    const dockMap: Record<string, { x: number; y: number }> = {
      dock:     { x: 180, y: 590 },   // 码头停靠点（小船位置，比图标低50避免重叠）
      farm:     { x: 450, y: 380 },   // 湖畔牧场停靠点
      bamboo:   { x: 620, y: 500 },   // 天目竹林停靠点 ←
      workshop: { x: 730, y: 310 },   // 临水作坊停靠点
      shop:     { x: 1020, y: 280 },  // 善琏笔庄停靠点 ←
      pavilion: { x: 1020, y: 100 },  // 挥墨亭停靠点 ←
    };
    return dockMap[key];
  }

  /**
   * 水面波纹粒子效果
   */
  private createWaterEffect(): void {
    const points = this.riverPath.getPoints(80);
    points.forEach((p, i) => {
      if (i % 5 === 0) {
        const sparkle = this.add.circle(p.x, p.y, 2, 0xffffff, 0.3).setDepth(5);
        this.tweens.add({
          targets: sparkle,
          alpha: { from: 0.1, to: 0.5 },
          scaleX: { from: 0.5, to: 1.5 },
          scaleY: { from: 0.5, to: 1.5 },
          duration: 1500 + Math.random() * 1000,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
          delay: Math.random() * 2000,
        });
      }
    });
  }

  /**
   * 创建小船（停靠在码头）
   */
  private createBoat(): void {
    const startPoint = this.riverPath.getPoint(0);

    // 使用精灵图替代手绘图形
    const boatImg = this.add.image(0, 0, 'sprite-boat');
    boatImg.setScale(0.24);
    this.boatImg = boatImg;

    this.boat = this.add.container(startPoint.x, startPoint.y, [boatImg]);
    this.boat.setDepth(50);

    // 轻微上下浮动
    this.tweens.add({
      targets: this.boat,
      y: startPoint.y + 2,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /**
   * 创建所有地标建筑
   */
  private createLandmarks(): void {
    this.landmarks.forEach((lm) => {
      const pos = this.getLandmarkPixelPos(lm.key);
      if (!pos) return;

      const container = this.add.container(pos.x, pos.y);

      // 精灵图 key 映射
      const spriteMap: Record<string, string> = {
        dock: 'sprite-dock',
        farm: 'sprite-farm',
        bamboo: 'sprite-bamboo',
        workshop: 'sprite-workshop',
        shop: 'sprite-shop',
        pavilion: 'sprite-pavilion',
      };

      // 使用精灵图（512x512 压缩后），部分建筑放大
      const spriteKey = spriteMap[lm.key];
      if (spriteKey) {
        const sprite = this.add.image(0, 0, spriteKey);
        // 各建筑缩放比例（512px 精灵图）
        const bigSet = ['shop', 'bamboo'];
        const scale = bigSet.includes(lm.key) ? 0.32 : (lm.key === 'farm' ? 0.32 : (lm.key === 'dock' ? 0.40 : (lm.key === 'workshop' ? 0.24 : 0.20)));
        sprite.setScale(scale);
        sprite.disableInteractive();
        container.add([sprite]);
      }

      // 码头：不显示标签，只显示图标
      if (lm.isDock) {
        container.setAlpha(1);
        container.setDepth(40);
      } else {
        // 普通建筑标签
        const labelY = lm.key === 'farm' ? 90 : 55;
        const label = this.add.text(0, labelY, lm.name, {
          fontSize: '18px',
          color: '#f0e6d3',
          fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
          backgroundColor: '#1a1a2ecc',
          padding: { x: 10, y: 5 },
        }).setOrigin(0.5);
        container.add([label]);
      }

      container.setAlpha(1); // 所有建筑常亮，小朋友能看清
      container.setDepth(40);

      // 点击热区
      const hitArea = this.add.zone(0, 0, 100, 120).setInteractive();
      container.add([hitArea]);

      hitArea.on('pointerdown', () => {
        this.sailToLandmark(lm);
      });

      hitArea.on('pointerover', () => {
        this.game.canvas.style.cursor = "url('assets/hub/cursor-brush-48.png') 3 42, auto";
      });
      hitArea.on('pointerout', () => {
        this.game.canvas.style.cursor = "url('assets/hub/cursor-brush-32.png') 2 28, auto";
      });

      this.buildingSprites.set(lm.key, container);
    });
  }

  /**
   * 所有建筑初始就显示"点击探索"浮动提示
   */
  private showAllIndicators(): void {
    this.landmarks.forEach((lm) => {
      if (lm.isDock) return; // 码头不显示
      const container = this.buildingSprites.get(lm.key);
      if (!container) return;

      const indicator = this.add.text(container.x, container.y - 70, '点击探索', {
        fontSize: '14px',
        color: '#ffd700',
        fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
        backgroundColor: '#1a1a2ecc',
        padding: { x: 10, y: 5 },
      }).setOrigin(0.5).setDepth(100);

      this.tweens.add({
        targets: indicator,
        y: indicator.y - 10,
        alpha: 0.4,
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
  }

  /**
   * 点亮建筑
   */
  private activateLandmark(lm: Landmark): void {
    const container = this.buildingSprites.get(lm.key);
    if (!container) return;

    this.activatedSet.add(lm.key);

    // 建筑弹跳动画（到达时给一个反馈）
    this.tweens.killTweensOf(container);
    this.tweens.add({
      targets: container,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 250,
      yoyo: true,
      ease: 'Sine.easeInOut',
    });

    // 码头不需要额外处理
    if (lm.isDock) return;
  }

  /**
   * 船驶向指定建筑（沿曲线路径）
   */
  private sailToLandmark(lm: Landmark): void {
    if (this.isMoving && lm.progress === this.targetProgress) return;

    this.isMoving = true;
    this.targetProgress = lm.isDock ? 0 : lm.progress;

    const startProgress = this.currentProgress;
    const endProgress = lm.progress;
    const pathLength = this.riverPath.getLength();
    const arcDistance = Math.abs(endProgress - startProgress) * pathLength;
    const duration = Math.max(1500, arcDistance * 3);

    this.tweens.killTweensOf(this.boat);

    // 平滑角度：存储当前 tilt，逐步 lerp 到目标角度
    let smoothTilt = 0;
    let smoothFlipX = false;

    const tweenObj = { t: startProgress };
    this.tweens.add({
      targets: tweenObj,
      t: endProgress,
      duration: duration,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const point = this.riverPath.getPoint(tweenObj.t);
        if (point) {
          this.boat.setPosition(point.x, point.y);

          const nextPoint = this.riverPath.getPoint(
            Math.min(tweenObj.t + 0.02, 1)
          );
          if (nextPoint) {
            const dx = nextPoint.x - point.x;
            const dy = nextPoint.y - point.y;
            const angle = Math.atan2(dy, dx);

            const isMovingLeft = Math.abs(angle) > Math.PI / 2;
            let targetTilt = isMovingLeft ? Math.PI - angle : angle;
            targetTilt = PhaserMath.Clamp(targetTilt, -0.26, 0.26);

            // 平滑插值：最多每帧变化 0.02 弧度
            const maxStep = 0.02;
            const diff = targetTilt - smoothTilt;
            smoothTilt += PhaserMath.Clamp(diff, -maxStep, maxStep);
            smoothFlipX = isMovingLeft;

            this.boatImg.setFlipX(smoothFlipX);
            this.boat.setRotation(smoothTilt);
          }
        }
      },
      onComplete: () => {
        this.isMoving = false;
        this.currentProgress = lm.isDock ? 0 : lm.progress;
        this.activateLandmark(lm);

        this.tweens.add({
          targets: this.boat,
          y: this.boat.y + 2,
          duration: 2000,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });

        this.time.delayedCall(800, () => {
          if (lm.sceneKey) {
            this.enterMiniGame(lm);
          }
        });
      },
    });
  }

  /**
   * 进入小游戏场景
   */
  private enterMiniGame(lm: Landmark): void {
    this.cameras.main.fadeOut(500, 0x1a, 0x1a, 0x2e);

    this.cameras.main.once('camerafadeoutcomplete', () => {
      if (lm.sceneKey) {
        this.scene.start(lm.sceneKey);
      }
    });
  }
}
