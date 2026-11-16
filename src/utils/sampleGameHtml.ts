export const SAMPLE_GAME_HTML = `<!doctype html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Scarlet Veil — Demo Scene Game HTML</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #090b10;
      color: #f8fafc;
      font-family: system-ui, -apple-system, sans-serif;
      position: relative;
      height: 100vh;
      overflow: hidden;
    }
    .toolbar {
      position: absolute;
      top: 10px;
      left: 10px;
      right: 10px;
      z-index: 10;
      display: flex;
      gap: 8px;
      padding: 8px 12px;
      background: rgba(17, 21, 32, 0.84);
      border: 1px solid rgba(51, 65, 85, 0.72);
      border-radius: 10px;
      backdrop-filter: blur(8px);
      align-items: center;
      flex-wrap: wrap;
    }
    .toolbar span {
      font-size: 12px;
      color: #94a3b8;
      margin-right: 6px;
    }
    button {
      background: #1e293b;
      color: #e2e8f0;
      border: 1px solid #334155;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
    }
    button.active {
      background: #be123c;
      border-color: #e11d48;
      color: #ffffff;
    }
    .stage {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #06080c;
      overflow: hidden;
    }
    canvas {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <span>Pilih Scene Game:</span>
    <button class="active" data-scene="Hutan Scarlet" onclick="setScene('forest', this)">Hutan Scarlet</button>
    <button data-scene="Benteng Obsidian" onclick="setScene('citadel', this)">Benteng Obsidian</button>
    <button data-scene="Kuil Senja" onclick="setScene('temple', this)">Kuil Senja</button>
    <button data-scene="Puncak Salju" onclick="setScene('summit', this)">Puncak Salju</button>
  </div>
  <div class="stage">
    <canvas id="gameCanvas" width="1280" height="720"></canvas>
  </div>
  <script>
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    let currentScene = 'forest';
    let tick = 0;

    const particles = Array.from({ length: 55 }, (_, i) => ({
      x: (i * 97) % 1280,
      y: (i * 53) % 720,
      r: 1.2 + (i % 4) * 0.9,
      speed: 0.4 + (i % 5) * 0.25,
      drift: (i % 3) - 1
    }));

    function setScene(name, btn) {
      currentScene = name;
      document.querySelectorAll('button[data-scene]').forEach(b => b.classList.remove('active'));
      if (btn) btn.classList.add('active');
    }

    function drawMountains(color, baseY, amp, freq, shift) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, 720);
      for (let x = 0; x <= 1280; x += 24) {
        const y = baseY - Math.abs(Math.sin((x + shift) * freq)) * amp - Math.cos((x + shift) * freq * 0.5) * (amp * 0.35);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(1280, 720);
      ctx.closePath();
      ctx.fill();
    }

    function drawTrees(color, count, seed, maxHeight) {
      ctx.fillStyle = color;
      for (let i = 0; i < count; i++) {
        const x = ((i * 137 + seed) % 1360) - 40;
        const h = maxHeight * (0.65 + ((i * 29) % 35) / 100);
        const w = h * 0.24;
        ctx.beginPath();
        ctx.moveTo(x, 720);
        ctx.lineTo(x - w, 720);
        ctx.lineTo(x - w * 0.2, 720 - h);
        ctx.lineTo(x + w * 0.2, 720 - h);
        ctx.lineTo(x + w, 720);
        ctx.closePath();
        ctx.fill();
      }
    }

    function render() {
      tick += 0.016;
      const w = 1280, h = 720;

      if (currentScene === 'forest') {
        const sky = ctx.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, '#0f1722');
        sky.addColorStop(0.55, '#1e2b36');
        sky.addColorStop(1, '#0c1015');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, h);

        // Mist moon glow
        const moon = ctx.createRadialGradient(840, 210, 20, 840, 210, 320);
        moon.addColorStop(0, 'rgba(226, 232, 240, 0.38)');
        moon.addColorStop(0.4, 'rgba(148, 163, 184, 0.14)');
        moon.addColorStop(1, 'rgba(15, 23, 34, 0)');
        ctx.fillStyle = moon;
        ctx.fillRect(0, 0, w, h);

        drawMountains('#16202a', 540, 140, 0.004, 120);
        drawTrees('#0f161d', 18, 40, 420);
        drawTrees('#090d12', 12, 95, 530);

        // Scarlet cloak silhouette + glowing embers
        const ember = ctx.createRadialGradient(640, 440, 10, 640, 440, 260);
        ember.addColorStop(0, 'rgba(225, 29, 72, 0.35)');
        ember.addColorStop(1, 'rgba(225, 29, 72, 0)');
        ctx.fillStyle = ember;
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = '#991b1b';
        ctx.beginPath();
        ctx.moveTo(640, 260);
        ctx.lineTo(745, 720);
        ctx.lineTo(535, 720);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(640, 285, 52, Math.PI * 0.95, Math.PI * 2.05);
        ctx.lineTo(672, 340);
        ctx.lineTo(608, 340);
        ctx.closePath();
        ctx.fill();
      } else if (currentScene === 'citadel') {
        const sky = ctx.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, '#140c18');
        sky.addColorStop(0.6, '#2b1528');
        sky.addColorStop(1, '#0b0910');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, h);

        const moon = ctx.createRadialGradient(420, 200, 10, 420, 200, 240);
        moon.addColorStop(0, 'rgba(251, 113, 133, 0.55)');
        moon.addColorStop(1, 'rgba(43, 21, 40, 0)');
        ctx.fillStyle = moon;
        ctx.fillRect(0, 0, w, h);

        drawMountains('#1b1122', 560, 170, 0.005, 50);

        // Obsidian towers
        ctx.fillStyle = '#0d0912';
        const towers = [[460, 210, 75], [560, 140, 110], [690, 190, 85], [790, 250, 65]];
        towers.forEach(([tx, ty, tw]) => {
          ctx.fillRect(tx, ty, tw, 720 - ty);
          ctx.beginPath();
          ctx.moveTo(tx - 8, ty);
          ctx.lineTo(tx + tw / 2, ty - 75);
          ctx.lineTo(tx + tw + 8, ty);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#fb7185';
          ctx.fillRect(tx + tw * 0.42, ty + 48, tw * 0.16, 28);
          ctx.fillStyle = '#0d0912';
        });
      } else if (currentScene === 'temple') {
        const sky = ctx.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, '#17110d');
        sky.addColorStop(0.55, '#422415');
        sky.addColorStop(1, '#120c08');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, h);

        const sun = ctx.createRadialGradient(640, 390, 30, 640, 390, 340);
        sun.addColorStop(0, 'rgba(251, 191, 36, 0.55)');
        sun.addColorStop(0.5, 'rgba(217, 119, 6, 0.2)');
        sun.addColorStop(1, 'rgba(18, 12, 8, 0)');
        ctx.fillStyle = sun;
        ctx.fillRect(0, 0, w, h);

        drawMountains('#24150d', 560, 120, 0.0045, 210);
        // Temple pillars
        ctx.fillStyle = '#140c08';
        [340, 440, 800, 900].forEach(px => {
          ctx.fillRect(px, 230, 38, 490);
        });
        ctx.fillRect(300, 210, 680, 32);
        ctx.fillRect(260, 620, 760, 100);
      } else {
        const sky = ctx.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, '#091526');
        sky.addColorStop(0.55, '#1b3554');
        sky.addColorStop(1, '#0d1b2a');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, h);

        const aurora = ctx.createLinearGradient(100, 80, 1180, 280);
        aurora.addColorStop(0, 'rgba(56, 189, 248, 0)');
        aurora.addColorStop(0.45, 'rgba(56, 189, 248, 0.25)');
        aurora.addColorStop(0.7, 'rgba(45, 212, 191, 0.22)');
        aurora.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = aurora;
        ctx.fillRect(0, 60, w, 260);

        drawMountains('#162a42', 520, 220, 0.0038, 180);
        drawMountains('#0d1a2b', 610, 150, 0.0055, 310);
      }

      // Floating atmosphere particles
      particles.forEach((p, idx) => {
        p.y -= p.speed;
        p.x += Math.sin(tick + idx) * 0.35 + p.drift * 0.15;
        if (p.y < -10) p.y = 730;
        if (p.x < -10) p.x = 1290;
        if (p.x > 1290) p.x = -10;
        ctx.fillStyle = currentScene === 'forest'
          ? 'rgba(254, 205, 211, 0.45)'
          : currentScene === 'temple'
            ? 'rgba(253, 230, 138, 0.45)'
            : 'rgba(226, 232, 240, 0.4)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    render();
    setInterval(render, 70);
  </script>
</body>
</html>`;
