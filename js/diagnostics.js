(function() {
  window.Game = window.Game || {};

  var controls;
  var active = false;
  var currentPatient = null;
  var currentInstrument = null;
  var currentGame = null; // 'stethoscope' | 'hammer' | 'rhinoscope'

  var overlayEl, canvasEl, ctx, titleEl, controlsEl, statusEl, closeBtn;
  var canvasW = 600, canvasH = 500;

  // ===== STETHOSCOPE MINI-GAME =====
  var steth = {
    points: [],
    correctIndex: 0,
    hoveredIndex: -1,
    holdTimer: 0,
    holdTarget: 3.0,
    dimmed: [],
    mouseX: 0,
    mouseY: 0,
    complaint: ''
  };

  var STETH_POINT_POSITIONS = [
    { x: 300, y: 180, label: 'Сердце' },
    { x: 220, y: 160, label: 'Левое лёгкое' },
    { x: 380, y: 160, label: 'Правое лёгкое' },
    { x: 300, y: 320, label: 'Живот' },
    { x: 300, y: 100, label: 'Горло' }
  ];

  // Determine correct auscultation point from complaint text
  function getStethCorrectPoint(complaint) {
    var c = complaint.toLowerCase();
    // Throat/voice keywords → Горло (4)
    if (c.indexOf('горл') !== -1 || c.indexOf('голос') !== -1 || c.indexOf('глотать') !== -1 ||
        c.indexOf('глота') !== -1 || c.indexOf('перш') !== -1 || c.indexOf('сипит') !== -1 ||
        c.indexOf('гнусав') !== -1 || c.indexOf('ангин') !== -1 || c.indexOf('миндал') !== -1 ||
        c.indexOf('лающий') !== -1 || c.indexOf('слюну') !== -1 || c.indexOf('рот') !== -1) return 4;
    // Left lung/side keywords → Левое лёгкое (1)
    if (c.indexOf('слева') !== -1 || c.indexOf('в боку') !== -1 || c.indexOf('справа') !== -1 ||
        c.indexOf('плевр') !== -1) return 1;
    // Chest/breathing/wheeze → Правое лёгкое (2) or heart
    if (c.indexOf('свист') !== -1 || c.indexOf('хрип') !== -1 || c.indexOf('булькает') !== -1 ||
        c.indexOf('мокрот') !== -1 || c.indexOf('задых') !== -1 || c.indexOf('обструкт') !== -1) return 2;
    // Chest center/sternum → Сердце (0)
    if (c.indexOf('за грудин') !== -1 || c.indexOf('грудь') !== -1 || c.indexOf('сжалось') !== -1 ||
        c.indexOf('груди') !== -1) return 0;
    // Cough deep → Живот (3) for diaphragm-related
    if (c.indexOf('до рвоты') !== -1 || c.indexOf('живот') !== -1) return 3;
    // Default: throat
    return 4;
  }

  function startStethoscope(patient) {
    steth.points = STETH_POINT_POSITIONS;
    steth.correctIndex = getStethCorrectPoint(patient.complaint || '');
    steth.hoveredIndex = -1;
    steth.holdTimer = 0;
    steth.dimmed = [];
    steth.mouseX = canvasW / 2;
    steth.mouseY = canvasH / 2;
    steth.complaint = patient.complaint || '';

    titleEl.textContent = 'Фонендоскоп — Найдите точку аускультации';
    statusEl.textContent = 'Наведите на точку и удерживайте 3 секунды';
    controlsEl.innerHTML = '';
  }

  function updateStethoscope(delta) {
    var mx = steth.mouseX;
    var my = steth.mouseY;
    var newHovered = -1;
    var radius = 22;

    for (var i = 0; i < steth.points.length; i++) {
      var p = steth.points[i];
      var dx = mx - p.x;
      var dy = my - p.y;
      if (dx * dx + dy * dy < radius * radius) {
        newHovered = i;
        break;
      }
    }

    if (newHovered !== steth.hoveredIndex) {
      steth.hoveredIndex = newHovered;
      steth.holdTimer = 0;
    }

    if (steth.hoveredIndex >= 0 && steth.dimmed.indexOf(steth.hoveredIndex) === -1) {
      steth.holdTimer += delta;
      if (steth.holdTimer >= steth.holdTarget) {
        if (steth.hoveredIndex === steth.correctIndex) {
          onSuccess();
          return;
        } else {
          steth.dimmed.push(steth.hoveredIndex);
          statusEl.textContent = 'Здесь ничего не слышно. Попробуйте другую точку.';
          steth.holdTimer = 0;
        }
      }
    }

    drawStethoscope();
  }

  function drawStethoscope() {
    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = '#1a2a3a';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Patient complaint at top
    if (steth.complaint) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.roundRect(40, 10, canvasW - 80, 36, 8);
      ctx.fill();
      ctx.fillStyle = '#ffcc66';
      ctx.font = 'italic 13px Segoe UI, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('\u00AB' + steth.complaint + '\u00BB', canvasW / 2, 33);
    }

    // Body silhouette
    ctx.fillStyle = '#2a4a5a';
    ctx.beginPath();
    ctx.arc(300, 60, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(288, 80, 24, 18);
    ctx.beginPath();
    ctx.moveTo(235, 98);
    ctx.lineTo(365, 98);
    ctx.lineTo(355, 275);
    ctx.lineTo(338, 380);
    ctx.lineTo(262, 380);
    ctx.lineTo(245, 275);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(185, 103, 55, 18);
    ctx.fillRect(360, 103, 55, 18);
    ctx.fillRect(185, 103, 18, 115);
    ctx.fillRect(397, 103, 18, 115);

    // Points
    for (var i = 0; i < steth.points.length; i++) {
      var p = steth.points[i];
      var isDimmed = steth.dimmed.indexOf(i) !== -1;
      var isHovered = steth.hoveredIndex === i;

      ctx.beginPath();
      ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);

      if (isDimmed) {
        ctx.fillStyle = 'rgba(100, 100, 100, 0.3)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(150, 150, 150, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (isHovered) {
        ctx.fillStyle = 'rgba(100, 200, 255, 0.3)';
        ctx.fill();
        ctx.strokeStyle = '#66ccff';
        ctx.lineWidth = 3;
        ctx.stroke();

        if (steth.holdTimer > 0) {
          var progress = steth.holdTimer / steth.holdTarget;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 22, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
          ctx.strokeStyle = '#44ff88';
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          ctx.stroke();
          ctx.lineCap = 'butt';
        }
      } else {
        ctx.fillStyle = 'rgba(100, 180, 255, 0.15)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(100, 180, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.fillStyle = isDimmed ? 'rgba(150,150,150,0.3)' : (isHovered ? '#fff' : 'rgba(200,220,240,0.6)');
      ctx.font = '11px Segoe UI, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.label, p.x, p.y + 32);
    }

    // Cursor
    ctx.beginPath();
    ctx.arc(steth.mouseX, steth.mouseY, 12, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(steth.mouseX, steth.mouseY, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fill();
  }

  // ===== REFLEX HAMMER MINI-GAME =====
  var hammer = {
    successCount: 0,
    requiredHits: 3,
    // Power bar
    barValue: 0,       // 0..1 oscillating
    barDirection: 1,
    barSpeed: 1.8,     // oscillations per second (full sweep)
    greenMin: 0.35,
    greenMax: 0.65,
    // Knee target
    targetX: 320,
    targetY: 220,
    targetRadius: 22,
    // Leg kick animation
    kickTimer: 0,
    kickDuration: 0.5,
    kicking: false,
    // Feedback
    feedbackText: '',
    feedbackTimer: 0,
    feedbackColor: '#fff',
    mouseX: 0,
    mouseY: 0,
    canClick: true
  };

  function startHammer(patient) {
    hammer.successCount = 0;
    hammer.barValue = 0;
    hammer.barDirection = 1;
    hammer.kicking = false;
    hammer.kickTimer = 0;
    hammer.feedbackText = '';
    hammer.feedbackTimer = 0;
    hammer.mouseX = canvasW / 2;
    hammer.mouseY = canvasH / 2;
    hammer.canClick = true;

    titleEl.textContent = 'Рефлекс-молоток — Проверьте рефлексы';
    statusEl.textContent = 'Кликните по точке на колене когда шкала в зелёной зоне (0/' + hammer.requiredHits + ')';
    controlsEl.innerHTML = '';
  }

  function onHammerClick() {
    if (!hammer.canClick || hammer.kicking) return;

    var inGreen = hammer.barValue >= hammer.greenMin && hammer.barValue <= hammer.greenMax;
    if (!inGreen) {
      if (hammer.barValue < hammer.greenMin) {
        hammer.feedbackText = 'Слишком слабо!';
      } else {
        hammer.feedbackText = 'Слишком сильно!';
      }
      hammer.feedbackColor = '#ff6644';
      hammer.feedbackTimer = 1.2;
      return;
    }

    // Success hit
    hammer.successCount++;
    hammer.kicking = true;
    hammer.kickTimer = hammer.kickDuration;
    hammer.canClick = false;
    hammer.feedbackText = 'Рефлекс!';
    hammer.feedbackColor = '#44ff88';
    hammer.feedbackTimer = 0.8;

    if (hammer.successCount >= hammer.requiredHits) {
      statusEl.textContent = 'Рефлексы проверены! (' + hammer.successCount + '/' + hammer.requiredHits + ')';
      setTimeout(function() { onSuccess(); }, 800);
    } else {
      statusEl.textContent = 'Кликните по точке когда шкала в зелёной зоне (' + hammer.successCount + '/' + hammer.requiredHits + ')';
    }
  }

  function updateHammer(delta) {
    // Oscillate power bar
    hammer.barValue += hammer.barDirection * hammer.barSpeed * delta;
    if (hammer.barValue >= 1) { hammer.barValue = 1; hammer.barDirection = -1; }
    if (hammer.barValue <= 0) { hammer.barValue = 0; hammer.barDirection = 1; }

    // Kick animation
    if (hammer.kicking) {
      hammer.kickTimer -= delta;
      if (hammer.kickTimer <= 0) {
        hammer.kicking = false;
        hammer.canClick = true;
      }
    }

    // Feedback timer
    if (hammer.feedbackTimer > 0) {
      hammer.feedbackTimer -= delta;
    }

    drawHammer();
  }

  function drawHammer() {
    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = '#1a2a3a';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Draw leg (side view)
    var legColor = '#3a5a6a';
    var thighAngle = 0;
    var shinAngle = -0.3; // slightly bent knee at rest

    // Kick animation: shin swings forward
    if (hammer.kicking) {
      var kickProgress = 1 - (hammer.kickTimer / hammer.kickDuration);
      var kickAngle = Math.sin(kickProgress * Math.PI) * 0.8;
      shinAngle += kickAngle;
    }

    var hipX = 200, hipY = 160;
    var thighLen = 120;
    var shinLen = 110;

    // Thigh
    var kneeX = hipX + Math.sin(thighAngle) * thighLen;
    var kneeY = hipY + Math.cos(thighAngle) * thighLen;

    ctx.strokeStyle = legColor;
    ctx.lineWidth = 28;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(kneeX, kneeY);
    ctx.stroke();

    // Shin
    var footX = kneeX + Math.sin(shinAngle) * shinLen;
    var footY = kneeY + Math.cos(shinAngle) * shinLen;

    ctx.beginPath();
    ctx.moveTo(kneeX, kneeY);
    ctx.lineTo(footX, footY);
    ctx.stroke();

    // Foot
    ctx.lineWidth = 20;
    ctx.beginPath();
    ctx.moveTo(footX, footY);
    ctx.lineTo(footX + 25, footY + 5);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Hip joint circle
    ctx.beginPath();
    ctx.arc(hipX, hipY, 16, 0, Math.PI * 2);
    ctx.fillStyle = '#2a4a5a';
    ctx.fill();

    // Chair/seat
    ctx.fillStyle = '#2a3a4a';
    ctx.fillRect(140, 140, 80, 20);
    ctx.fillRect(140, 140, 15, 60);

    // Reflex target point on knee
    hammer.targetX = kneeX + 12;
    hammer.targetY = kneeY + 5;

    // Target circle
    ctx.beginPath();
    ctx.arc(hammer.targetX, hammer.targetY, hammer.targetRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 200, 100, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(hammer.targetX, hammer.targetY, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 200, 100, 0.8)';
    ctx.fill();

    // Label
    ctx.fillStyle = 'rgba(255, 200, 100, 0.6)';
    ctx.font = '11px Segoe UI, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Рефлекторная точка', hammer.targetX + 50, hammer.targetY - 25);

    // --- Power bar ---
    var barX = 420, barY = 80, barW = 40, barH = 300;

    // Bar background
    ctx.fillStyle = '#0a1520';
    ctx.strokeStyle = '#3a5a7a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 6);
    ctx.fill();
    ctx.stroke();

    // Red-Green-Red zones
    var greenStartY = barY + barH * (1 - hammer.greenMax);
    var greenEndY = barY + barH * (1 - hammer.greenMin);
    var greenH = greenEndY - greenStartY;

    // Bottom red
    ctx.fillStyle = 'rgba(200, 60, 60, 0.3)';
    ctx.fillRect(barX + 4, greenEndY, barW - 8, barY + barH - greenEndY - 4);
    // Green zone
    ctx.fillStyle = 'rgba(60, 200, 60, 0.3)';
    ctx.fillRect(barX + 4, greenStartY, barW - 8, greenH);
    // Top red
    ctx.fillStyle = 'rgba(200, 60, 60, 0.3)';
    ctx.fillRect(barX + 4, barY + 4, barW - 8, greenStartY - barY - 4);

    // Indicator line
    var indicatorY = barY + barH * (1 - hammer.barValue);
    var inGreen = hammer.barValue >= hammer.greenMin && hammer.barValue <= hammer.greenMax;
    ctx.strokeStyle = inGreen ? '#44ff88' : '#ff4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(barX - 4, indicatorY);
    ctx.lineTo(barX + barW + 4, indicatorY);
    ctx.stroke();

    // Bar labels
    ctx.fillStyle = '#7a9ab0';
    ctx.font = '10px Segoe UI, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('СИЛА', barX + barW / 2, barY - 8);
    ctx.fillText('слабо', barX + barW / 2, barY + barH + 16);
    ctx.fillText('сильно', barX + barW / 2, barY - 22);

    // Success counter
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Segoe UI, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(hammer.successCount + ' / ' + hammer.requiredHits, 500, 440);

    // Star indicators
    for (var i = 0; i < hammer.requiredHits; i++) {
      ctx.fillStyle = i < hammer.successCount ? '#44ff88' : 'rgba(100,100,100,0.3)';
      ctx.font = '22px Segoe UI, Arial, sans-serif';
      ctx.fillText('\u2605', 470 + i * 28, 470);
    }

    // Feedback text
    if (hammer.feedbackTimer > 0) {
      var alpha = Math.min(1, hammer.feedbackTimer / 0.3);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = hammer.feedbackColor;
      ctx.font = 'bold 20px Segoe UI, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(hammer.feedbackText, 300, 440);
      ctx.globalAlpha = 1;
    }

    // Cursor (hammer head)
    ctx.save();
    ctx.translate(hammer.mouseX, hammer.mouseY);
    // Handle
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(12, 18);
    ctx.stroke();
    // Head
    ctx.fillStyle = '#cc8844';
    ctx.beginPath();
    ctx.ellipse(-4, -3, 10, 5, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#aa6622';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.restore();
  }

  // ===== RHINOSCOPE MINI-GAME (MAZE) =====
  var maze = {
    grid: [],
    cols: 6,
    rows: 6,
    cellSize: 0,
    offsetX: 0,
    offsetY: 0,
    playerCol: 0,
    playerRow: 0,
    playerX: 0,  // pixel position (smooth)
    playerY: 0,
    exitCol: 0,
    exitRow: 0,
    mouseX: 0,
    mouseY: 0,
    reachedExit: false,
    fixTimer: 0,
    fixTarget: 2.0,
    fixing: false,
    viewRadius: 120
  };

  // Maze cell: { top, right, bottom, left, visited }
  function generateMaze(cols, rows) {
    var grid = [];
    for (var r = 0; r < rows; r++) {
      grid[r] = [];
      for (var c = 0; c < cols; c++) {
        grid[r][c] = { top: true, right: true, bottom: true, left: true, visited: false };
      }
    }

    // Recursive backtracking
    var stack = [];
    var cr = 0, cc = 0;
    grid[cr][cc].visited = true;
    stack.push({ r: cr, c: cc });

    while (stack.length > 0) {
      var neighbors = [];
      if (cr > 0 && !grid[cr - 1][cc].visited) neighbors.push({ r: cr - 1, c: cc, dir: 'top' });
      if (cc < cols - 1 && !grid[cr][cc + 1].visited) neighbors.push({ r: cr, c: cc + 1, dir: 'right' });
      if (cr < rows - 1 && !grid[cr + 1][cc].visited) neighbors.push({ r: cr + 1, c: cc, dir: 'bottom' });
      if (cc > 0 && !grid[cr][cc - 1].visited) neighbors.push({ r: cr, c: cc - 1, dir: 'left' });

      if (neighbors.length > 0) {
        var next = neighbors[Math.floor(Math.random() * neighbors.length)];
        // Remove wall between current and next
        if (next.dir === 'top') { grid[cr][cc].top = false; grid[next.r][next.c].bottom = false; }
        if (next.dir === 'right') { grid[cr][cc].right = false; grid[next.r][next.c].left = false; }
        if (next.dir === 'bottom') { grid[cr][cc].bottom = false; grid[next.r][next.c].top = false; }
        if (next.dir === 'left') { grid[cr][cc].left = false; grid[next.r][next.c].right = false; }
        cr = next.r;
        cc = next.c;
        grid[cr][cc].visited = true;
        stack.push({ r: cr, c: cc });
      } else {
        var prev = stack.pop();
        cr = prev.r;
        cc = prev.c;
      }
    }

    return grid;
  }

  function startRhinoscope(patient) {
    maze.grid = generateMaze(maze.cols, maze.rows);
    maze.cellSize = Math.floor(Math.min(
      (canvasW - 40) / maze.cols,
      (canvasH - 40) / maze.rows
    ));
    maze.offsetX = Math.floor((canvasW - maze.cols * maze.cellSize) / 2);
    maze.offsetY = Math.floor((canvasH - maze.rows * maze.cellSize) / 2);

    maze.playerCol = 0;
    maze.playerRow = 0;
    maze.playerX = maze.offsetX + maze.cellSize / 2;
    maze.playerY = maze.offsetY + maze.cellSize / 2;
    maze.exitCol = maze.cols - 1;
    maze.exitRow = maze.rows - 1;
    maze.reachedExit = false;
    maze.fixTimer = 0;
    maze.fixing = false;
    maze.mouseX = maze.playerX;
    maze.mouseY = maze.playerY;

    titleEl.textContent = 'Риноскоп — Пройдите к очагу воспаления';
    statusEl.textContent = 'Проведите прибор через носовой проход к красной точке';
    controlsEl.innerHTML = '';
  }

  function getMazeCell(px, py) {
    var c = Math.floor((px - maze.offsetX) / maze.cellSize);
    var r = Math.floor((py - maze.offsetY) / maze.cellSize);
    if (c < 0 || c >= maze.cols || r < 0 || r >= maze.rows) return null;
    return { col: c, row: r };
  }

  function canMoveTo(fromCol, fromRow, toCol, toRow) {
    if (toCol < 0 || toCol >= maze.cols || toRow < 0 || toRow >= maze.rows) return false;
    var dc = toCol - fromCol;
    var dr = toRow - fromRow;
    var cell = maze.grid[fromRow][fromCol];
    if (dc === 1 && !cell.right) return true;
    if (dc === -1 && !cell.left) return true;
    if (dr === 1 && !cell.bottom) return true;
    if (dr === -1 && !cell.top) return true;
    return false;
  }

  function updateRhinoscope(delta) {
    // Target: mouse position, but constrained to valid maze movement
    var targetX = maze.mouseX;
    var targetY = maze.mouseY;

    // Current cell
    var curCell = getMazeCell(maze.playerX, maze.playerY);
    if (!curCell) return;

    // Move player toward mouse, checking walls
    var speed = 200 * delta;
    var dx = targetX - maze.playerX;
    var dy = targetY - maze.playerY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) { dx = 0; dy = 0; }
    else { dx = (dx / dist) * Math.min(speed, dist); dy = (dy / dist) * Math.min(speed, dist); }

    var newX = maze.playerX + dx;
    var newY = maze.playerY + dy;

    // Check if new position crosses a wall
    var half = maze.cellSize / 2;
    var margin = 4;
    var cellCenterX = maze.offsetX + curCell.col * maze.cellSize + half;
    var cellCenterY = maze.offsetY + curCell.row * maze.cellSize + half;

    // Check X movement
    if (dx > 0 && newX > cellCenterX + half - margin) {
      if (maze.grid[curCell.row][curCell.col].right) {
        newX = cellCenterX + half - margin;
      }
    }
    if (dx < 0 && newX < cellCenterX - half + margin) {
      if (maze.grid[curCell.row][curCell.col].left) {
        newX = cellCenterX - half + margin;
      }
    }
    if (dy > 0 && newY > cellCenterY + half - margin) {
      if (maze.grid[curCell.row][curCell.col].bottom) {
        newY = cellCenterY + half - margin;
      }
    }
    if (dy < 0 && newY < cellCenterY - half + margin) {
      if (maze.grid[curCell.row][curCell.col].top) {
        newY = cellCenterY - half + margin;
      }
    }

    maze.playerX = newX;
    maze.playerY = newY;

    // Update current cell based on position
    var newCell = getMazeCell(maze.playerX, maze.playerY);
    if (newCell) {
      maze.playerCol = newCell.col;
      maze.playerRow = newCell.row;
    }

    // Check if at exit
    var exitCX = maze.offsetX + maze.exitCol * maze.cellSize + half;
    var exitCY = maze.offsetY + maze.exitRow * maze.cellSize + half;
    var distToExit = Math.sqrt(
      (maze.playerX - exitCX) * (maze.playerX - exitCX) +
      (maze.playerY - exitCY) * (maze.playerY - exitCY)
    );

    if (distToExit < half * 0.8) {
      onSuccess();
      return;
    }

    drawRhinoscope();
  }

  function drawRhinoscope() {
    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = '#1a0a0a';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Maze background
    ctx.fillStyle = '#2a1010';
    ctx.fillRect(maze.offsetX - 4, maze.offsetY - 4,
      maze.cols * maze.cellSize + 8, maze.rows * maze.cellSize + 8);

    // Passage floor
    ctx.fillStyle = '#3a1a1a';
    for (var r = 0; r < maze.rows; r++) {
      for (var c = 0; c < maze.cols; c++) {
        var cx = maze.offsetX + c * maze.cellSize;
        var cy = maze.offsetY + r * maze.cellSize;
        ctx.fillRect(cx + 1, cy + 1, maze.cellSize - 2, maze.cellSize - 2);
      }
    }

    // Draw walls
    ctx.strokeStyle = '#bb5555';
    ctx.lineWidth = 3;
    for (var r = 0; r < maze.rows; r++) {
      for (var c = 0; c < maze.cols; c++) {
        var cell = maze.grid[r][c];
        var cx = maze.offsetX + c * maze.cellSize;
        var cy = maze.offsetY + r * maze.cellSize;

        if (cell.top) {
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + maze.cellSize, cy);
          ctx.stroke();
        }
        if (cell.right) {
          ctx.beginPath();
          ctx.moveTo(cx + maze.cellSize, cy);
          ctx.lineTo(cx + maze.cellSize, cy + maze.cellSize);
          ctx.stroke();
        }
        if (cell.bottom) {
          ctx.beginPath();
          ctx.moveTo(cx, cy + maze.cellSize);
          ctx.lineTo(cx + maze.cellSize, cy + maze.cellSize);
          ctx.stroke();
        }
        if (cell.left) {
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx, cy + maze.cellSize);
          ctx.stroke();
        }
      }
    }

    // Start marker (blue circle, top-left)
    var startCX = maze.offsetX + maze.cellSize / 2;
    var startCY = maze.offsetY + maze.cellSize / 2;
    ctx.beginPath();
    ctx.arc(startCX, startCY, 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(100, 200, 255, 0.6)';
    ctx.fill();
    ctx.fillStyle = 'rgba(100, 200, 255, 0.7)';
    ctx.font = '10px Segoe UI, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('СТАРТ', startCX, startCY - 12);

    // Exit marker (inflammation, bottom-right)
    var exitCX = maze.offsetX + maze.exitCol * maze.cellSize + maze.cellSize / 2;
    var exitCY = maze.offsetY + maze.exitRow * maze.cellSize + maze.cellSize / 2;
    var pulseSize = 8 + Math.sin(Date.now() * 0.005) * 3;
    ctx.beginPath();
    ctx.arc(exitCX, exitCY, pulseSize, 0, Math.PI * 2);
    var grad = ctx.createRadialGradient(exitCX, exitCY, 0, exitCX, exitCY, pulseSize);
    grad.addColorStop(0, 'rgba(255, 60, 60, 0.9)');
    grad.addColorStop(1, 'rgba(200, 30, 30, 0.2)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.fillStyle = '#ff6644';
    ctx.font = '10px Segoe UI, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ОЧАГ', exitCX, exitCY - 12);

    // Player dot
    ctx.beginPath();
    ctx.arc(maze.playerX, maze.playerY, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(maze.playerX, maze.playerY, 7, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 200, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Fix progress ring at exit
    if (maze.fixing && maze.fixTimer > 0) {
      var progress = maze.fixTimer / maze.fixTarget;
      ctx.beginPath();
      ctx.arc(maze.playerX, maze.playerY, 12, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.strokeStyle = '#44ff88';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
  }

  // ===== COMMON LOGIC =====

  function onSuccess() {
    active = false;
    overlayEl.style.display = 'none';
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
    // Animated popup reveal (controls stay unlocked for popup)
    Game.Patients.revealDiagnosisAnimated(currentPatient);
    currentPatient = null;
    currentGame = null;
    // controls.lock() will happen when popup closes after animation
  }

  function onClose() {
    active = false;
    overlayEl.style.display = 'none';
    currentPatient = null;
    currentGame = null;
    controls.lock();
  }

  function onMouseMove(e) {
    if (!active) return;
    var rect = canvasEl.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;
    if (currentGame === 'stethoscope') {
      steth.mouseX = mx;
      steth.mouseY = my;
    } else if (currentGame === 'hammer') {
      hammer.mouseX = mx;
      hammer.mouseY = my;
    } else if (currentGame === 'rhinoscope') {
      maze.mouseX = mx;
      maze.mouseY = my;
    }
  }

  function onCanvasClick(e) {
    if (!active) return;
    if (currentGame === 'hammer') {
      onHammerClick();
    }
  }

  var lastTime = 0;
  var animFrameId = null;

  function gameLoop(timestamp) {
    if (!active) return;
    var delta = lastTime ? (timestamp - lastTime) / 1000 : 0.016;
    if (delta > 0.05) delta = 0.05;
    lastTime = timestamp;

    if (currentGame === 'stethoscope') updateStethoscope(delta);
    else if (currentGame === 'hammer') updateHammer(delta);
    else if (currentGame === 'rhinoscope') updateRhinoscope(delta);

    animFrameId = requestAnimationFrame(gameLoop);
  }

  window.Game.Diagnostics = {
    setup: function(_controls) {
      controls = _controls;
      overlayEl = document.getElementById('diagnostics-overlay');
      canvasEl = document.getElementById('diagnostics-canvas');
      titleEl = document.getElementById('diagnostics-title');
      controlsEl = document.getElementById('diagnostics-controls');
      statusEl = document.getElementById('diagnostics-status');
      closeBtn = document.getElementById('diagnostics-close');

      canvasEl.width = canvasW;
      canvasEl.height = canvasH;
      ctx = canvasEl.getContext('2d');

      closeBtn.addEventListener('click', onClose);
      document.addEventListener('mousemove', onMouseMove);
      canvasEl.addEventListener('click', onCanvasClick);

      document.addEventListener('keydown', function(e) {
        if (e.code === 'Escape' && active) {
          onClose();
        }
      });
    },

    startMinigame: function(patient, instrumentType) {
      currentPatient = patient;
      currentInstrument = instrumentType;
      active = true;

      overlayEl.style.display = 'flex';
      controls.unlock();

      if (instrumentType === 'instrument_stethoscope') {
        currentGame = 'stethoscope';
        startStethoscope(patient);
      } else if (instrumentType === 'instrument_hammer') {
        currentGame = 'hammer';
        startHammer(patient);
      } else if (instrumentType === 'instrument_rhinoscope') {
        currentGame = 'rhinoscope';
        startRhinoscope(patient);
      }

      lastTime = 0;
      if (animFrameId) cancelAnimationFrame(animFrameId);
      animFrameId = requestAnimationFrame(gameLoop);
    },

    isActive: function() { return active; },
    getPatient: function() { return currentPatient; },

    update: function(delta) {
      // Mini-game runs its own animation loop
    }
  };
})();
