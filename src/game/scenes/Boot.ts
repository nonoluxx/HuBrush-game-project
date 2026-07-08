import { Scene } from 'phaser';

/**
 * Boot 场景 - 游戏启动的第一个场景
 * 负责加载最小资源（loading 动画素材）并跳转到 Preloader
 */
export class Boot extends Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    // 这里只加载 Preloader 场景需要显示的 loading 界面素材
    // 例如 loading 背景图、进度条等
    // this.load.image('loading-bg', 'assets/ui/loading-bg.png');
  }

  create(): void {
    // 浏览器自动播放策略：首次用户交互时解锁音频
    const unlockAudio = () => {
      this.sound.unlock();
      document.removeEventListener('pointerdown', unlockAudio);
    };
    document.addEventListener('pointerdown', unlockAudio);

    this.scene.start('Preloader');
  }
}
