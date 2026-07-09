import { Scene, GameObjects } from 'phaser';

/** hex 颜色转为整数 */
function hexToInt(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

/**
 * 全局音乐管理器
 * 使用 game.registry 存储静音状态，跨场景共享
 */
const MUSIC_MUTED_KEY = 'musicMuted';

export function isMusicMuted(scene: Scene): boolean {
  return !!scene.game.registry.get(MUSIC_MUTED_KEY);
}

// 存储当前场景的 BGM 实例引用
const bgmInstances = new Map<string, Phaser.Sound.BaseSound>();

export function setMusicMuted(scene: Scene, muted: boolean): void {
  scene.game.registry.set(MUSIC_MUTED_KEY, muted);
  bgmInstances.forEach((inst) => {
    if (muted) inst.pause(); else inst.resume();
  });
}

export function toggleMusic(scene: Scene): boolean {
  const muted = !isMusicMuted(scene);
  setMusicMuted(scene, muted);
  return muted;
}

/**
 * 播放背景音乐（循环），自动读取静音状态
 * 若音频上下文被浏览器锁定，会在首次用户交互后自动播放
 */
export function playBgm(scene: Scene, key: string, volume = 0.5): void {
  // 停止并移除旧的 BGM 实例
  bgmInstances.forEach((inst) => { inst.stop(); inst.destroy(); });
  bgmInstances.clear();
  if (isMusicMuted(scene)) return;

  const music = scene.sound.add(key, { loop: true, volume });
  bgmInstances.set(key, music);

  // 音频上下文被浏览器锁定（自动播放策略），等待首次用户交互后播放
  if (scene.sound.locked) {
    const playOnUnlock = () => {
      scene.sound.unlock();
      if (!isMusicMuted(scene) && bgmInstances.has(key)) {
        music.play();
      }
      document.removeEventListener('pointerdown', playOnUnlock);
    };
    document.addEventListener('pointerdown', playOnUnlock);
  } else {
    music.play();
  }
}

export interface MusicBtnStyle {
  fontSize: string;
  color: string;
  backgroundColor: string;
  mutedBgColor: string;
  padding: { x: number; y: number };
  slashColor: string;
  originX: number;
}

const DEFAULT_STYLE: MusicBtnStyle = {
  fontSize: '16px',
  color: '#d4c4a8',
  backgroundColor: '#1a1a2ecc',
  mutedBgColor: '#4a2020cc',
  padding: { x: 12, y: 6 },
  slashColor: '#d4c4a8',
  originX: 1,
};

/**
 * 创建音乐开关按钮（文字 + 静音斜杠）
 */
export function createMusicToggleBtn(
  scene: Scene,
  x: number,
  y: number,
  depth = 51,
  style: Partial<MusicBtnStyle> = {},
): GameObjects.Container {
  const s = { ...DEFAULT_STYLE, ...style };
  const muted = isMusicMuted(scene);

  const container = scene.add.container(x, y).setDepth(depth);

  // 文字（直接交互，背景色提供点击区域）
  const label = scene.add.text(0, 0, muted ? '音乐关闭' : '音乐开关', {
    fontSize: s.fontSize,
    color: s.color,
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    backgroundColor: muted ? s.mutedBgColor : s.backgroundColor,
    padding: s.padding,
  }).setOrigin(s.originX, 0).setDepth(depth).setInteractive();

  // 斜杠（覆盖文字，静音时更粗更明显）
  const slash = scene.add.graphics().setDepth(depth + 1);
  const drawSlash = (isMuted: boolean) => {
    slash.clear();
    const w = label.width;
    const h = label.height;
    slash.lineStyle(isMuted ? 3 : 2, hexToInt(s.slashColor), isMuted ? 1 : 0.9);
    slash.lineBetween(-w * s.originX, 0, w * (1 - s.originX), h);
  };
  drawSlash(muted);
  slash.setVisible(muted);

  container.add([label, slash]);

  label.on('pointerdown', () => {
    const nowMuted = toggleMusic(scene);
    label.setText(nowMuted ? '音乐关闭' : '音乐开关');
    label.setBackgroundColor(nowMuted ? s.mutedBgColor : s.backgroundColor);
    drawSlash(nowMuted);
    slash.setVisible(nowMuted);
    if (!nowMuted) {
      const sceneKey = scene.scene.key;
      if (sceneKey === 'HubScene' || sceneKey === 'MiniGameFarm' || sceneKey === 'MiniGameBamboo') {
        playBgm(scene, 'main-bgm');
      }
    }
  });
  label.on('pointerover', () => label.setAlpha(0.7));
  label.on('pointerout', () => label.setAlpha(1));

  return container;
}