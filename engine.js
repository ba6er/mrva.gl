// Internal vars

var spriteCount = 0;
const spriteBatch = 64;

var gl = null;
var overlay = null;

const camera = {
  resX: 0, resY: 0,
  posX: 0, posY: 0,
}
const buffers = {
  pos: {
    id: null,
    data: new Float32Array(3 * 6 * spriteBatch).fill(0),
  },
  col: {
    id: null,
    data: new Float32Array(4 * 6 * spriteBatch).fill(0),
  },
  tex: {
    id: null,
    data: new Float32Array(2 * 6 * spriteBatch).fill(0),
  },
};
const shader = {prog: null, aPos: null, aCol: null, aTex: null, uView: null, uSampler: null};

var textures = {};
var currentTexture = null;

var sprites = {};
var sounds = {};
var labels = {};
var inputs = {};

// Assets

const createShader = (vertSrc, fragSrc) => {
  // Vertex
  const vert = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vert, vertSrc);
  gl.compileShader(vert);

  // Check for compile errors
  if (!gl.getShaderParameter(vert, gl.COMPILE_STATUS)) {
    console.error("Failed to compile vertex shader:" + gl.getShaderInfoLog(vert));
    gl.deleteShader(vert);
    return null;
  }

  // Fragment
  const frag = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(frag, fragSrc);
  gl.compileShader(frag);

  // Check for compile errors
  if (!gl.getShaderParameter(frag, gl.COMPILE_STATUS)) {
    console.error("Failed to compile fragment shader:" + gl.getShaderInfoLog(frag));
    gl.deleteShader(frag);
    return null;
  }

  // Shader program
  const program = gl.createProgram();
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);

  // Check for linking errors
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Failed to link shaders:" + gl.getProgramInfoLog(program));
    return null;
  }

  gl.deleteShader(vert);
  gl.deleteShader(frag);
  return program;
}

const initBuffers = () => {
  buffers.pos.id = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.pos.id);
  gl.bufferData(gl.ARRAY_BUFFER, buffers.pos.data, gl.DYNAMIC_DRAW);
  gl.vertexAttribPointer(shader.aPos, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(shader.aPos);

  buffers.col.id = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.col.id);
  gl.bufferData(gl.ARRAY_BUFFER, buffers.col.data, gl.DYNAMIC_DRAW);
  gl.vertexAttribPointer(shader.aCol, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(shader.aCol);

  buffers.tex.id = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.tex.id);
  gl.bufferData(gl.ARRAY_BUFFER, buffers.tex.data, gl.DYNAMIC_DRAW);
  gl.vertexAttribPointer(shader.aTex, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(shader.aTex);
}

const initShader = () => {
  const vertSrc = `
    attribute vec4 aPos;
    attribute vec4 aCol;
    attribute vec4 aTex;

    uniform vec4 uView;

    varying lowp vec4 vCol;
    varying highp vec2 vTex;

    void main() {
      gl_Position = vec4((aPos.x + uView.z) / uView.x * 2.0,
                         (aPos.y + uView.w) / uView.y * 2.0,
                         -aPos.z / 1000.0, 1.0);
      vCol = aCol;
      vTex = aTex.xy;
    }`;

  const fragSrc = `
    varying lowp vec4 vCol;
    varying highp vec2 vTex;

    uniform sampler2D uSampler;

    void main() {
      highp vec4 texCol = texture2D(uSampler, vTex);
      gl_FragColor = vCol * texCol;
    }`;

  const program = createShader(vertSrc, fragSrc);
  if (program == null) {
    console.error("Failed to create draw shader!");
    return null;
  }

  shader.prog = program;
  shader.aPos = gl.getAttribLocation(program, "aPos");
  shader.aCol = gl.getAttribLocation(program, "aCol");
  shader.aTex = gl.getAttribLocation(program, "aTex");
  shader.uView = gl.getUniformLocation(program, "uView");
  shader.uSampler = gl.getUniformLocation(program, "uSampler");

  gl.useProgram(shader.prog);
  gl.uniform1i(shader.uSampler, 0);
}

const textureAdd = (name, url) => {
  textures[name] = {id: gl.createTexture(), width: 1, height: 1};
  gl.bindTexture(gl.TEXTURE_2D, textures[name].id);

  // Single pixel placeholder while waiting for the image to load
  const format = gl.RGBA;
  const srcType = gl.UNSIGNED_BYTE;
  const pixel = new Uint8Array([255, 255, 255, 255]);
  gl.texImage2D(gl.TEXTURE_2D, 0, format, 1, 1, 0, format, srcType, pixel);

  const image = new Image();
  image.src = url;
  image.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, textures[name].id);
    gl.texImage2D(gl.TEXTURE_2D, 0, format, format, srcType, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    textures[name].width = image.width;
    textures[name].height = image.height;
  }

  currentTexture = name;
  gl.activeTexture(gl.TEXTURE0);
  gl.uniform1i(shader.uSampler, 0);
}

const soundAdd = (name, url, loop) => {
  sounds[name] =  new Audio(url);
  sounds[name].loop = loop;
}

const soundPlay = (name) => {
  if (sounds[name].paused) {
    sounds[name].play();
  }
}

const soundPause = (name) => {
  sounds[name].pause();
}

// Renderer

const initCanvas = (canvas, width, height) => {
  gl = canvas.getContext("webgl");
  if (gl == null) {
    console.error("Failed to init WebGL!");
    return null;
  }

  gl.clearColor(0.9, 0.9, 0.9, 1.0);

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LESS);

  gl.enable(gl.BLEND);
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  cameraSetRes(width, height);
  cameraSetPos(-width / 2, -height / 2);
}

const flushBuffers = () => {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.pos.id);
  gl.vertexAttribPointer(shader.aPos, 3, gl.FLOAT, false, 0, 0);
  gl.bufferData(gl.ARRAY_BUFFER, buffers.pos.data, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(shader.aPos);

  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.col.id);
  gl.vertexAttribPointer(shader.aCol, 4, gl.FLOAT, false, 0, 0);
  gl.bufferData(gl.ARRAY_BUFFER, buffers.col.data, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(shader.aCol);

  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.tex.id);
  gl.vertexAttribPointer(shader.aTex, 2, gl.FLOAT, false, 0, 0);
  gl.bufferData(gl.ARRAY_BUFFER, buffers.tex.data, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(shader.aTex);

  gl.drawArrays(gl.TRIANGLES, 0, 6 * spriteCount);
}

const spriteAdd = (name, tex, atlas, size) => {
  if (size == null) {
    size = {x: atlas[2] - atlas[0], y: atlas[3] - atlas[1]};
  }
  sprites[name] = {tex: tex, atlas: atlas, size: size};
}

const spriteDraw = (name, pos, scale, modulate) => {
  if (pos == null) {
    pos = {x: 0, y: 0, z: 0};
  }
  if (scale == null) {
    scale = {x: 1, y: 1};
  }
  if (modulate == null) {
    modulate = {r: 1, g: 1, b: 1, a: 1};
  }

  if (currentTexture != sprites[name].tex) {
    flushBuffers();
    spriteCount = 0;

    currentTexture = sprites[name].tex;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures[currentTexture].id);
  }

  if (spriteCount >= spriteBatch) {
    flushBuffers();
    spriteCount = 0;
  }

  const s1 = sprites[name].atlas[0] / textures[sprites[name].tex].width;
  const t1 = sprites[name].atlas[1] / textures[sprites[name].tex].height;
  const s2 = sprites[name].atlas[2] / textures[sprites[name].tex].width;
  const t2 = sprites[name].atlas[3] / textures[sprites[name].tex].height;
  const w2 = sprites[name].size.x / 2 * scale.x;
  const h2 = sprites[name].size.y / 2 * scale.y;

  buffers.pos.data[spriteCount * 6 * 3 + 0]  = pos.x - w2;
  buffers.pos.data[spriteCount * 6 * 3 + 1]  = pos.y - h2;
  buffers.pos.data[spriteCount * 6 * 3 + 2]  = pos.z;
  buffers.pos.data[spriteCount * 6 * 3 + 3]  = pos.x + w2;
  buffers.pos.data[spriteCount * 6 * 3 + 4]  = pos.y - h2;
  buffers.pos.data[spriteCount * 6 * 3 + 5]  = pos.z;
  buffers.pos.data[spriteCount * 6 * 3 + 6]  = pos.x + w2;
  buffers.pos.data[spriteCount * 6 * 3 + 7]  = pos.y + h2;
  buffers.pos.data[spriteCount * 6 * 3 + 8]  = pos.z;
  buffers.pos.data[spriteCount * 6 * 3 + 9]  = pos.x - w2;
  buffers.pos.data[spriteCount * 6 * 3 + 10] = pos.y - h2;
  buffers.pos.data[spriteCount * 6 * 3 + 11] = pos.z;
  buffers.pos.data[spriteCount * 6 * 3 + 12] = pos.x + w2;
  buffers.pos.data[spriteCount * 6 * 3 + 13] = pos.y + h2;
  buffers.pos.data[spriteCount * 6 * 3 + 14] = pos.z;
  buffers.pos.data[spriteCount * 6 * 3 + 15] = pos.x - w2;
  buffers.pos.data[spriteCount * 6 * 3 + 16] = pos.y + h2;
  buffers.pos.data[spriteCount * 6 * 3 + 17] = pos.z;

  buffers.col.data[spriteCount * 6 * 4 + 0]  = modulate.r;
  buffers.col.data[spriteCount * 6 * 4 + 1]  = modulate.g;
  buffers.col.data[spriteCount * 6 * 4 + 2]  = modulate.b;
  buffers.col.data[spriteCount * 6 * 4 + 3]  = modulate.a;
  buffers.col.data[spriteCount * 6 * 4 + 4]  = modulate.r;
  buffers.col.data[spriteCount * 6 * 4 + 5]  = modulate.g;
  buffers.col.data[spriteCount * 6 * 4 + 6]  = modulate.b;
  buffers.col.data[spriteCount * 6 * 4 + 7]  = modulate.a;
  buffers.col.data[spriteCount * 6 * 4 + 8]  = modulate.r;
  buffers.col.data[spriteCount * 6 * 4 + 9]  = modulate.g;
  buffers.col.data[spriteCount * 6 * 4 + 10] = modulate.b;
  buffers.col.data[spriteCount * 6 * 4 + 11] = modulate.a;
  buffers.col.data[spriteCount * 6 * 4 + 12] = modulate.r;
  buffers.col.data[spriteCount * 6 * 4 + 13] = modulate.g;
  buffers.col.data[spriteCount * 6 * 4 + 14] = modulate.b;
  buffers.col.data[spriteCount * 6 * 4 + 15] = modulate.a;
  buffers.col.data[spriteCount * 6 * 4 + 16] = modulate.r;
  buffers.col.data[spriteCount * 6 * 4 + 17] = modulate.g;
  buffers.col.data[spriteCount * 6 * 4 + 18] = modulate.b;
  buffers.col.data[spriteCount * 6 * 4 + 19] = modulate.a;
  buffers.col.data[spriteCount * 6 * 4 + 20] = modulate.r;
  buffers.col.data[spriteCount * 6 * 4 + 21] = modulate.g;
  buffers.col.data[spriteCount * 6 * 4 + 22] = modulate.b;
  buffers.col.data[spriteCount * 6 * 4 + 23] = modulate.a;

  buffers.tex.data[spriteCount * 6 * 2 + 0]  = s1;
  buffers.tex.data[spriteCount * 6 * 2 + 1]  = t1;
  buffers.tex.data[spriteCount * 6 * 2 + 2]  = s2;
  buffers.tex.data[spriteCount * 6 * 2 + 3]  = t1;
  buffers.tex.data[spriteCount * 6 * 2 + 4]  = s2;
  buffers.tex.data[spriteCount * 6 * 2 + 5]  = t2;
  buffers.tex.data[spriteCount * 6 * 2 + 6]  = s1;
  buffers.tex.data[spriteCount * 6 * 2 + 7]  = t1;
  buffers.tex.data[spriteCount * 6 * 2 + 8]  = s2;
  buffers.tex.data[spriteCount * 6 * 2 + 9]  = t2;
  buffers.tex.data[spriteCount * 6 * 2 + 10] = s1;
  buffers.tex.data[spriteCount * 6 * 2 + 11] = t2;

  spriteCount++;
}

const renderBegin = () => {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  spriteCount = 0;

  gl.useProgram(shader.prog);
  gl.uniform4f(shader.uView, camera.resX, camera.resY, camera.posX, camera.posY);
}

const renderEnd = () => {
  flushBuffers();
}

// Camera

const cameraMove = (x, y) => {
  camera.posX += x;
  camera.posY += y;
}

const cameraSetPos = (x, y) => {
  camera.posX = x;
  camera.posY = y;
}

const cameraSetRes = (x, y) => {
  camera.resX = x;
  camera.resY = -y;
}

// Overlay

const addLabels = (elem) => {
  for (const c of elem.children) {
    if (c.children.length != 0) {
      addLabels(c);
      continue;
    }
    labels[c.getAttribute("id")] = {l: null, s: null};
    labels[c.getAttribute("id")].l = c;
    labels[c.getAttribute("id")].s = c.style.display;
  }
}

const initOverlay = (elem, width, height) => {
  overlay = elem;
  addLabels(overlay);

  resizeView(width, height);
  window.addEventListener("resize", () => {resizeView(width, height)});
}

const labelWrite = (name, text) => {
  labels[name].l.textContent = text;
}

const labelShow = (name, show) => {
  if (show == true) {
    labels[name].l.style.display = labels[name].s;
  } else {
    labels[name].l.style.display = "none";
  }
}

// Input

const initInput = () => {
  document.addEventListener("keydown", (event) => {
    if (event.repeat == true) {
      return;
    }

    for (var i in inputs) {
      if (event.code != inputs[i].code) {
        continue;
      }
      inputs[i].val = 1;
      break;
    }
  });

  document.addEventListener("keyup", (event) => {
    for (var i in inputs) {
      if (event.code != inputs[i].code) {
        continue;
      }
      inputs[i].val = 0;
      break;
    }
  });
}

const inputAdd = (name, code) => {
  inputs[name] = {val: 0, code: code};
};

const inputPressed = (name) => {
  return inputs[name].val;
}

// Main

const resizeView = (w, h) => {
  var cw = 1;
  var ch = 1;
  var overlaySize = 1;

  if (window.innerWidth / w < window.innerHeight / h) {
    cw = Math.round(window.innerWidth);
    ch = Math.round(window.innerWidth / w * h);
    gl.canvas.style.width = "100%";
    gl.canvas.style.height = "auto";
    overlaySize = window.innerWidth / w;
  } else {
    cw = Math.round(window.innerHeight * w / h);
    ch = Math.round(window.innerHeight);
    gl.canvas.style.width = "auto";
    gl.canvas.style.height = "100%";
    overlaySize = window.innerHeight / h;
  }

  gl.canvas.width = cw;
  gl.canvas.height = ch;
  gl.viewport(0, 0, cw, ch);

  overlay.style.fontSize = `${overlaySize}px`;
}

const init = (canvas, overlay, width, height) => {
  initInput();

  initCanvas(canvas, width, height);
  initShader();
  initBuffers();

  initOverlay(overlay, width, height);

  resizeView(width, height);
  window.addEventListener("resize", () => {resizeView(width, height)});
}

const run = (update) => {
  var pt = 0.0;
  var dt = 0.0;

  const tick = (ct) => {
    ct *= 0.001;
    dt = ct - pt;
    pt = ct;

    update(ct, dt);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

export {
  init,
  run,

  textureAdd,
  spriteAdd,
  spriteDraw,

  soundAdd,
  soundPlay,
  soundPause,

  renderBegin,
  renderEnd,

  cameraMove,
  cameraSetPos,
  cameraSetRes,

  labelWrite,
  labelShow,

  inputAdd,
  inputPressed,
};
