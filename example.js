// browser-sync start --server --files .
// use browser-sync for js code hot-reloading
import * as eng from "./engine.js";

const pos1 = {x: 160, y: 120, z: 1};
const timers = {fps: 0};

const update = (time, delta) => {
  const dirX = eng.inputPressed("right") - eng.inputPressed("left");
  const dirY = eng.inputPressed("down") - eng.inputPressed("up");
  pos1.x += dirX * 100 * delta;
  pos1.y += dirY * 100 * delta;

  if (eng.inputPressed("boom")) {
    eng.soundPlay("boom");
  }

  // FPS
  timers.fps += delta;
  if (timers.fps >= 1) {
    eng.labelWrite("fps-label", `FPS:${Math.round(1 / delta)}`);
    timers.fps = 0;
  }

  eng.renderBegin();
  eng.spriteDraw("amogus",
                 {x: 80, y: 120, z: 0},
                 {x: Math.sin(time), y: Math.cos(time), z: 0},
                 {r: 1.0, g: 0.2, b: 0.2, a: 1.0});
  eng.spriteDraw("player", pos1, null, null);
  eng.spriteDraw("jesse", {x: 240, y: 120, z: 2}, null, null);
  eng.renderEnd();
}

const main = () => {
  const gameCanvas = document.getElementById("game-canvas");
  const gameOverlay = document.getElementById("game-overlay");

  eng.init(gameCanvas, gameOverlay, 320, 240);

  eng.inputAdd("left", "ArrowLeft");
  eng.inputAdd("right", "ArrowRight");
  eng.inputAdd("up", "ArrowUp");
  eng.inputAdd("down", "ArrowDown");
  eng.inputAdd("boom", "Space");

  eng.soundAdd("boom", "./assets/explosion.wav", false);

  eng.textureAdd("jesse", "./assets/jesse.png");
  eng.textureAdd("amogus", "./assets/amogus.png");
  eng.textureAdd("frog", "./assets/frog.png");

  eng.spriteAdd("player", "frog", [0, 0, 32, 32], null);
  eng.spriteAdd("jesse", "jesse", [0, 0, 32, 32], null);
  eng.spriteAdd("amogus", "amogus", [0, 0, 32, 32], null);

  eng.run(update);
}

main();
