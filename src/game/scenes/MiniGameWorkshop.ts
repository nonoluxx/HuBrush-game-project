import { Scene } from 'phaser';

export class MiniGameWorkshop extends Scene {
  constructor() {
    super('MiniGameWorkshop');
  }

  create(): void {
    const { width, height } = this.cameras.main;

    const loadingText = this.add.text(width / 2, height / 2, '正在进入临水作坊...', {
      fontSize: '24px', color: '#d4c4a8',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    }).setOrigin(0.5).setDepth(200);

    this.load.image('workshop-bg', 'assets/workshop/workshop-bg.png');
    this.load.image('workshop-table', 'assets/workshop/table.png');

    this.load.on('loaderror', (file: any) => {
      console.warn('[Workshop] 加载失败:', file.key);
    });

    this.load.once('complete', () => {
      loadingText.destroy();
      this.renderScene();
    });

    this.load.start();
  }

  private renderScene(): void {
    const { width, height } = this.cameras.main;

    this.add.image(width / 2, height / 2, 'workshop-bg')
      .setDisplaySize(width, height);

    const tableY = height * 0.85;
    const tableScale = 0.8;
    this.add.image(width * 0.34, tableY, 'workshop-table').setScale(tableScale).setDepth(10);
    this.add.image(width * 0.66, tableY, 'workshop-table').setScale(tableScale).setDepth(10);

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

    this.tweens.add({ targets: leftLabel, y: labelY - 10, alpha: 0.4, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: rightLabel, y: labelY - 10, alpha: 0.4, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

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