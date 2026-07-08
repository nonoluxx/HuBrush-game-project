import { Scene } from 'phaser';

export class MiniGameWorkshop extends Scene {
  constructor() {
    super('MiniGameWorkshop');
  }

  preload(): void {
    this.load.image('workshop-bg', 'assets/workshop/workshop-bg.png');
    this.load.image('workshop-table', 'assets/workshop/table.png');
  }

  create(): void {
    const { width, height } = this.cameras.main;

    this.add.image(width / 2, height / 2, 'workshop-bg')
      .setDisplaySize(width, height);

    // 两个木桌：画面下边 1/3 区域，居中排列
    const tableY = height * 0.85; // 下移
    const tableScale = 0.4; // 1024→约410px
    this.add.image(width * 0.34, tableY, 'workshop-table').setScale(tableScale).setDepth(10);
    this.add.image(width * 0.66, tableY, 'workshop-table').setScale(tableScale).setDepth(10);

    // 桌子大小 1024×0.4=410px，标签放在桌子顶部上方
    const labelY = tableY - 200;
    const indicatorStyle = {
      fontSize: '28px',
      color: '#ffd700',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
      backgroundColor: '#1a1a2ecc',
      padding: { x: 10, y: 5 },
    };

    const leftLabel = this.add.text(width * 0.34, labelY, '择 毫', indicatorStyle)
      .setOrigin(0.5).setDepth(20);
    const rightLabel = this.add.text(width * 0.66, labelY, '配 毫', indicatorStyle)
      .setOrigin(0.5).setDepth(20);

    // 浮动动画（与主页面"点击探索"一致）
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
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('HubScene', { dockKey: 'workshop' }));
    });
  }
}