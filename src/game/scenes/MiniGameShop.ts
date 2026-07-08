import { Scene } from 'phaser';

export class MiniGameShop extends Scene {
  constructor() {
    super('MiniGameShop');
  }

  preload(): void {
    this.load.image('shop-bg', 'assets/shop/shop-bg.png');
  }

  create(): void {
    const { width, height } = this.cameras.main;

    this.add.image(width / 2, height / 2, 'shop-bg')
      .setDisplaySize(width, height);

    // 浮动标签（桌子已在背景图中绘制）
    const labelY = height * 0.85 - 200;
    const indicatorStyle = {
      fontSize: '28px',
      color: '#ffd700',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
      backgroundColor: '#1a1a2ecc',
      padding: { x: 10, y: 5 },
    };

    const leftLabel = this.add.text(width * 0.34, labelY, '结 头', indicatorStyle)
      .setOrigin(0.5).setDepth(20);
    const rightLabel = this.add.text(width * 0.66, labelY, '装 笔', indicatorStyle)
      .setOrigin(0.5).setDepth(20);

    this.tweens.add({ targets: leftLabel, y: labelY - 10, alpha: 0.4, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: rightLabel, y: labelY - 10, alpha: 0.4, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // 右上角「回到小船」按钮
    const backBtn = this.add.text(width - 20, 30, '回到小船', {
      fontSize: '16px', color: '#d4c4a8',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
      backgroundColor: '#1a1a2ecc', padding: { x: 12, y: 6 },
    }).setOrigin(1, 0).setDepth(51).setInteractive();
    backBtn.on('pointerover', () => backBtn.setAlpha(0.7));
    backBtn.on('pointerout', () => backBtn.setAlpha(1));
    backBtn.on('pointerdown', () => {
      backBtn.disableInteractive();
      this.cameras.main.fadeOut(500, 0x1a, 0x1a, 0x2e);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('HubScene', { dockKey: 'shop' }));
    });
  }
}