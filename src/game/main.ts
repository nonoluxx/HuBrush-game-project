/**
 * 湖笔技艺 · 非遗研学 - 游戏入口配置
 *
 * 场景注册顺序 = 启动顺序：
 *   Boot → Preloader → HubScene（主世界）
 *   5 个小游戏场景按需加载（通过 scene.switch 切换）
 */

import { Boot } from './scenes/Boot';
import { Preloader } from './scenes/Preloader';
import { HubScene } from './scenes/HubScene';
import { MiniGameFarm } from './scenes/MiniGameFarm';
import { MiniGameBamboo } from './scenes/MiniGameBamboo';
import { MiniGameWorkshop } from './scenes/MiniGameWorkshop';
import { MiniGameShop } from './scenes/MiniGameShop';
import { MiniGamePavilion } from './scenes/MiniGamePavilion';
import { AUTO, Game, Scale } from 'phaser';

// ====== 游戏配置 ======
const config: Phaser.Types.Core.GameConfig = {
  type: AUTO,
  width: 1280,
  height: 720,

  // 自适应缩放：保持 16:9 比例，适配桌面和移动端
  scale: {
    mode: Scale.FIT,
    autoCenter: Scale.CENTER_BOTH,
  },

  // 输入：鼠标 + 多点触控（移动端必需）
  input: {
    activePointers: 3,
  },

  parent: 'game-container',
  backgroundColor: '#1a1a2e',

  // 物理引擎（后续小游戏可能用到简单碰撞）
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },

  // 场景注册
  scene: [
    Boot,
    Preloader,
    HubScene,
    MiniGameFarm,
    MiniGameBamboo,
    MiniGameWorkshop,
    MiniGameShop,
    MiniGamePavilion,
  ],
};

// ====== 启动游戏 ======
const StartGame = (parent: string): Phaser.Game => {
  return new Game({ ...config, parent });
};

export { StartGame };
