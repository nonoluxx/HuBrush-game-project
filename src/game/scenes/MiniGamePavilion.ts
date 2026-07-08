import { Scene } from 'phaser';

export class MiniGamePavilion extends Scene {
  constructor() {
    super('MiniGamePavilion');
  }

  create(): void {
    const { width, height } = this.cameras.main;

    this.add.image(width / 2, height / 2, 'pavilion-bg')
      .setDisplaySize(width, height);

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
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('HubScene', { dockKey: 'pavilion' }));
    });
  }
}