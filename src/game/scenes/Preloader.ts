import { Scene, Textures } from 'phaser';

/**
 * Preloader 场景 - 资源预加载
 * 显示加载进度，加载所有游戏素材后跳转到 HubScene
 */
export class Preloader extends Scene {
  constructor() {
    super('Preloader');
  }

  preload(): void {
    const { width, height } = this.cameras.main;
    const barW = 400;
    const barH = 20;
    const barX = (width - barW) / 2;
    const barY = height / 2;

    // 背景条
    this.add.graphics()
      .fillStyle(0x333333, 0.8)
      .fillRoundedRect(barX, barY, barW, barH, 10);

    // 进度条
    const progressBar = this.add.graphics();

    // 加载文字
    this.add.text(width / 2, barY - 40, '造笔小蒙 · 加载中...', {
      fontSize: '24px',
      color: '#e0d6c8',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    }).setOrigin(0.5);

    const percentText = this.add.text(width / 2, barY + 50, '0%', {
      fontSize: '18px',
      color: '#a89b8c',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    }).setOrigin(0.5);

    // 监听加载进度
    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0xc9a96e, 1);
      progressBar.fillRoundedRect(barX, barY, barW * value, barH, 10);
      percentText.setText(`${Math.floor(value * 100)}%`);
    });

    // ====== 加载游戏素材 ======
    // 背景音乐
    this.load.audio('main-bgm', 'assets/audio/main-background.mp3');
    this.load.audio('farm-bgm', 'assets/audio/farm-background.mp3');
    this.load.audio('farm-intro', 'assets/audio/牧场开场.mp3');

    // HubScene 主背景（江南水乡全景河道）
    this.load.image('river-bg', 'assets/hub/river-bg.png');

    // 首页建筑精灵图（已去背景透明 PNG）
    // 使用 LINEAR 过滤保证缩放平滑
    this.load.image('sprite-dock', 'assets/hub/dock.png');
    this.load.image('sprite-farm', 'assets/hub/farm.png');
    this.load.image('sprite-bamboo', 'assets/hub/bamboo.png');
    this.load.image('sprite-workshop', 'assets/hub/workshop.png');
    this.load.image('sprite-shop', 'assets/hub/shop.png');
    this.load.image('sprite-pavilion', 'assets/hub/pavilion.png');
    this.load.image('sprite-boat', 'assets/hub/boat.png');

    // 河畔牧场关卡背景
    this.load.image('farm-bg', 'assets/farm/farm-bg.png');

    // 河畔牧场精灵图（山羊）
    this.load.image('goat-stand', 'assets/farm/goat-stand.png');
    this.load.image('goat-graze', 'assets/farm/goat-graze.png');
    this.load.image('goat-left', 'assets/farm/goat-walk-left.png');
    this.load.image('goat-right', 'assets/farm/goat-walk-right.png');
    // 河畔牧场精灵图（兔子）
    this.load.image('rabbit-graze', 'assets/farm/rabbit-graze.png');
    this.load.image('rabbit-left', 'assets/farm/rabbit-walk-left.png');
    this.load.image('rabbit-right', 'assets/farm/rabbit-walk-right.png');
    this.load.image('wool-ball', 'assets/farm/woolball.png');
    this.load.image('wool-glowing', 'assets/farm/woolballshine.png');
    this.load.image('zhukuang', 'assets/farm/zhukuang.png');
    this.load.image('comb', 'assets/farm/comb2.png');

    // 天目竹林关卡背景
    this.load.image('bamboo-bg', 'assets/bamboo/bamboo-bg.png');

    // 天目竹林精灵图
    this.load.image('knife', 'assets/bamboo/knife.png');
    this.load.image('bamboo-green', 'assets/bamboo/bamboogreen2.png');
    this.load.image('bamboo-brown', 'assets/bamboo/bamboobrown2.png');

    // 临水作坊关卡背景
    this.load.image('workshop-bg', 'assets/workshop/workshop-bg.png');
    // 作坊木桌
    this.load.image('workshop-table', 'assets/workshop/table.png');
    // 善琏笔庄关卡背景
    this.load.image('shop-bg', 'assets/shop/shop-bg.png');
    // 挥墨亭关卡背景
    this.load.image('pavilion-bg', 'assets/pavilion/pavilion-bg.png');
  }

  create(): void {
    // 加载完成后，对建筑精灵图设置高质量纹理过滤
    // 线性过滤 + mipmap，缩小放大都能保持清晰
    const spriteKeys = [
      'sprite-dock', 'sprite-farm', 'sprite-bamboo',
      'sprite-workshop', 'sprite-shop', 'sprite-pavilion', 'sprite-boat',
    ];
    spriteKeys.forEach((key) => {
      const texture = this.textures.get(key);
      if (texture && texture.key !== '__MISSING') {
        // 设置为线性过滤（默认就是，但显式确保）
        texture.setFilter(Textures.FilterMode.LINEAR);
      }
    });

    this.scene.start('HubScene');
  }
}
