(function() {
  window.Game = window.Game || {};

  var THREE, scene, camera, controls;

  // State
  var shiftOpen = false;
  var gameTime = 0;        // 0..600 real seconds = 8:00..20:00
  var dayNumber = 1;
  var dayStats = { patientsServed: 0, patientsLost: 0, moneyEarned: 0, moneySpent: 0 };

  var SHIFT_DURATION = 300; // 5 minutes real time (12 game-hours: 08:00-20:00)

  // 3D sign
  var signGroup;
  var signMeshes = [];
  var signCanvas, signTexture, signBoardMat;
  var hoveredSign = false;
  var prevHovered = false;

  // Raycaster
  var interactRay;
  var screenCenter;

  // UI elements
  var timeValueEl, dayValueEl, taskTextEl, taskMascotEl;
  var dayEndPopupEl, statServedEl, statLostEl, statEarnedEl, statSpentEl, dayEndNumberEl;
  var lostHudEl;
  var dayEndPopupOpen = false;

  // ====== TIME MATH ======
  function getFormattedTime() {
    var gameHours = (gameTime / SHIFT_DURATION) * 12;
    var hour = Math.floor(8 + gameHours);
    var minute = Math.floor((gameHours % 1) * 60);
    if (hour > 20) hour = 20;
    if (hour === 20) minute = 0;
    return (hour < 10 ? '0' : '') + hour + ':' + (minute < 10 ? '0' : '') + minute;
  }

  // ====== 3D SIGN ======
  function createSign() {
    signGroup = new THREE.Group();
    signGroup.userData.isShiftSign = true;

    // Main board
    var boardGeo = new THREE.BoxGeometry(0.8, 0.5, 0.06);
    signBoardMat = new THREE.MeshLambertMaterial({ color: 0xcc3333 });
    var board = new THREE.Mesh(boardGeo, signBoardMat);
    signGroup.add(board);
    signMeshes.push(board);

    // Text face (front)
    signCanvas = document.createElement('canvas');
    signCanvas.width = 256;
    signCanvas.height = 160;
    signTexture = new THREE.CanvasTexture(signCanvas);
    signTexture.minFilter = THREE.LinearFilter;
    var faceMat = new THREE.MeshLambertMaterial({ map: signTexture });
    var face = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.42), faceMat);
    face.position.z = 0.031;
    signGroup.add(face);
    signMeshes.push(face);

    // Border frame (4 strips)
    var frameMat = new THREE.MeshLambertMaterial({ color: 0xdddddd });
    // top
    var ft = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.04, 0.07), frameMat);
    ft.position.y = 0.27;
    signGroup.add(ft);
    signMeshes.push(ft);
    // bottom
    var fb = ft.clone();
    fb.position.y = -0.27;
    signGroup.add(fb);
    signMeshes.push(fb);
    // left
    var fl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.58, 0.07), frameMat);
    fl.position.x = -0.42;
    signGroup.add(fl);
    signMeshes.push(fl);
    // right
    var fr = fl.clone();
    fr.position.x = 0.42;
    signGroup.add(fr);
    signMeshes.push(fr);

    // Two mounting brackets
    var bracketGeo = new THREE.BoxGeometry(0.05, 0.15, 0.12);
    var bracketMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
    var b1 = new THREE.Mesh(bracketGeo, bracketMat);
    b1.position.set(-0.3, 0.27, -0.06);
    signGroup.add(b1);
    signMeshes.push(b1);
    var b2 = b1.clone();
    b2.position.x = 0.3;
    signGroup.add(b2);
    signMeshes.push(b2);

    // Position: inside south wall, right of door, facing inward (rotY=PI)
    signGroup.position.set(2.5, 1.8, -0.08);
    signGroup.rotation.y = Math.PI;
    scene.add(signGroup);

    updateSignTexture();
  }

  function updateSignTexture() {
    var ctx = signCanvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 160);

    if (shiftOpen) {
      ctx.fillStyle = '#1a8a3a';
      ctx.fillRect(0, 0, 256, 160);
      signBoardMat.color.setHex(0x22aa44);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 42px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(Game.Lang.t('shift.sign.open'), 128, 80);
    } else {
      ctx.fillStyle = '#aa2222';
      ctx.fillRect(0, 0, 256, 160);
      signBoardMat.color.setHex(0xcc3333);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 42px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(Game.Lang.t('shift.sign.closed'), 128, 80);
    }

    signTexture.needsUpdate = true;
  }

  // ====== SIGN INTERACTION ======
  function clearSignHover() {
    if (prevHovered) unhighlightSign();
    hoveredSign = false;
    prevHovered = false;
  }

  function updateSignHover() {
    if (dayEndPopupOpen || !controls.isLocked) {
      clearSignHover();
      return;
    }
    if (Game.Patients && Game.Patients.isPopupOpen()) { clearSignHover(); return; }
    if (Game.Shop && Game.Shop.isOpen()) { clearSignHover(); return; }
    if (Game.Cashier && Game.Cashier.isPopupOpen()) { clearSignHover(); return; }
    if (!Game.Interaction.isActive('shift')) {
      clearSignHover();
      return;
    }

    var intersects = Game.Interaction.getHits('shift');
    var hit = intersects !== null;

    if (hit && !prevHovered) {
      highlightSign();
    } else if (!hit && prevHovered) {
      unhighlightSign();
    }

    hoveredSign = hit;
    prevHovered = hit;

    if (hit) {
      var hintEl = document.getElementById('interact-hint');
      if (shiftOpen) {
        hintEl.textContent = Game.Lang.t('shift.hint.ongoing');
      } else if (shiftEnding) {
        hintEl.textContent = Game.Lang.t('shift.hint.ending');
      } else {
        hintEl.textContent = Game.Lang.t('shift.hint.open');
      }
      hintEl.style.display = 'block';
    }
  }

  function highlightSign() {
    Game.Outline.setHover(signMeshes);
  }

  function unhighlightSign() {
    Game.Outline.clearHover();
  }

  var shiftEnding = false; // true when 20:00 reached but patients still in clinic

  function onSignClick() {
    if (!hoveredSign || dayEndPopupOpen) return;
    if (!controls.isLocked) return;

    if (!shiftOpen && !shiftEnding) {
      openShift();
    }
    // No manual close — shift closes automatically
  }

  // ====== SHIFT LOGIC ======
  function openShift() {
    shiftOpen = true;
    shiftEnding = false;
    gameTime = 0;
    dayStats = { patientsServed: 0, patientsLost: 0, moneyEarned: 0, moneySpent: 0 };
    updateLostHUD();
    updateSignTexture();
    updateTaskText();
    Game.Inventory.showNotification(Game.Lang.t('shift.started', [dayNumber]), 'rgba(34, 139, 34, 0.85)');
    // Always use slot-based auto-spawn (Level 1/tutorial removed).
    if (Game.Patients && Game.Patients.startWaveSystem) {
      Game.Patients.startWaveSystem();
    }
  }

  function endShiftTime() {
    // 20:00 reached — stop accepting patients, wait for remaining
    shiftOpen = false;
    shiftEnding = true;
    updateSignTexture();
    Game.Inventory.showNotification(Game.Lang.t('shift.ended'), 'rgba(200, 150, 50, 0.85)');
  }

  function finishDay() {
    shiftEnding = false;
    showDayEndPopup();
  }

  function getRemainingPatients() {
    if (Game.Patients) return Game.Patients.getActivePatientCount();
    return 0;
  }

  // ====== TASK TEXT ======
  function updateTaskText() {
    if (!taskTextEl) return;
    if (dayEndPopupOpen) {
      taskTextEl.textContent = '';
      return;
    }
    if (!shiftOpen && !shiftEnding) {
      taskTextEl.textContent = Game.Lang.t('shift.task.open');
    } else if (shiftEnding) {
      var remaining = getRemainingPatients();
      if (remaining > 0) {
        taskTextEl.textContent = Game.Lang.t('shift.task.finish', [remaining]);
      } else {
        taskTextEl.textContent = Game.Lang.t('shift.task.allDone');
      }
    } else if (shiftOpen) {
      taskTextEl.textContent = Game.Lang.t('shift.task.serve');
    }
  }

  // ====== MASCOT DRAWING ======
  function drawMascot() {
    var c = document.createElement('canvas');
    c.width = 160;
    c.height = 240;
    var ctx = c.getContext('2d');

    // Background transparent
    ctx.clearRect(0, 0, 160, 240);

    // Hair behind (flowing blonde/russian blonde)
    ctx.fillStyle = '#c8a060';
    ctx.beginPath();
    ctx.ellipse(80, 60, 38, 40, 0, 0, Math.PI * 2);
    ctx.fill();
    // Hair flowing down behind shoulders
    ctx.beginPath();
    ctx.moveTo(42, 60);
    ctx.quadraticCurveTo(30, 120, 35, 170);
    ctx.lineTo(48, 170);
    ctx.quadraticCurveTo(42, 120, 50, 65);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(118, 60);
    ctx.quadraticCurveTo(130, 120, 125, 170);
    ctx.lineTo(112, 170);
    ctx.quadraticCurveTo(118, 120, 110, 65);
    ctx.fill();

    // Neck
    ctx.fillStyle = '#f5d0b0';
    ctx.fillRect(70, 88, 20, 18);

    // Body / white uniform
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(45, 106);
    ctx.quadraticCurveTo(40, 140, 38, 240);
    ctx.lineTo(122, 240);
    ctx.quadraticCurveTo(120, 140, 115, 106);
    ctx.lineTo(90, 100);
    ctx.lineTo(70, 100);
    ctx.closePath();
    ctx.fill();

    // Uniform collar V-neck
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(62, 106);
    ctx.lineTo(80, 128);
    ctx.lineTo(98, 106);
    ctx.stroke();

    // Uniform details - belt line
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(42, 168);
    ctx.quadraticCurveTo(80, 172, 118, 168);
    ctx.stroke();

    // Red cross on chest
    ctx.fillStyle = '#dd3333';
    ctx.fillRect(74, 136, 12, 4);
    ctx.fillRect(77, 132, 6, 12);

    // Face
    ctx.fillStyle = '#f5d0b0';
    ctx.beginPath();
    ctx.ellipse(80, 62, 28, 32, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hair bangs (on top of face)
    ctx.fillStyle = '#c8a060';
    ctx.beginPath();
    ctx.moveTo(52, 50);
    ctx.quadraticCurveTo(60, 30, 80, 28);
    ctx.quadraticCurveTo(100, 30, 108, 50);
    ctx.quadraticCurveTo(104, 40, 95, 42);
    ctx.quadraticCurveTo(85, 36, 75, 38);
    ctx.quadraticCurveTo(62, 38, 52, 50);
    ctx.fill();

    // Side hair strands
    ctx.beginPath();
    ctx.moveTo(52, 50);
    ctx.quadraticCurveTo(44, 65, 42, 90);
    ctx.lineTo(50, 88);
    ctx.quadraticCurveTo(48, 65, 55, 52);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(108, 50);
    ctx.quadraticCurveTo(116, 65, 118, 90);
    ctx.lineTo(110, 88);
    ctx.quadraticCurveTo(112, 65, 105, 52);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#3a7a4f';
    ctx.beginPath();
    ctx.ellipse(68, 60, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(92, 60, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Eye whites/highlights
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(70, 58, 2, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(94, 58, 2, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Pupils
    ctx.fillStyle = '#1a3a22';
    ctx.beginPath();
    ctx.arc(68, 61, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(92, 61, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Eyelashes
    ctx.strokeStyle = '#5a3a20';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(62, 55);
    ctx.quadraticCurveTo(68, 53, 74, 55);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(86, 55);
    ctx.quadraticCurveTo(92, 53, 98, 55);
    ctx.stroke();

    // Eyebrows
    ctx.strokeStyle = '#9a7040';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(60, 49);
    ctx.quadraticCurveTo(68, 46, 76, 49);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(84, 49);
    ctx.quadraticCurveTo(92, 46, 100, 49);
    ctx.stroke();

    // Nose
    ctx.strokeStyle = '#d4a888';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(80, 62);
    ctx.lineTo(78, 70);
    ctx.quadraticCurveTo(80, 72, 82, 70);
    ctx.stroke();

    // Smile
    ctx.strokeStyle = '#cc5555';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(70, 78);
    ctx.quadraticCurveTo(80, 86, 90, 78);
    ctx.stroke();
    // Lip fill
    ctx.fillStyle = '#e06060';
    ctx.beginPath();
    ctx.moveTo(70, 78);
    ctx.quadraticCurveTo(80, 86, 90, 78);
    ctx.quadraticCurveTo(80, 82, 70, 78);
    ctx.fill();

    // Blush
    ctx.fillStyle = 'rgba(255, 150, 150, 0.25)';
    ctx.beginPath();
    ctx.ellipse(58, 72, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(102, 72, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Nurse cap
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(58, 35);
    ctx.lineTo(58, 22);
    ctx.quadraticCurveTo(80, 15, 102, 22);
    ctx.lineTo(102, 35);
    ctx.quadraticCurveTo(80, 30, 58, 35);
    ctx.fill();
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(58, 35);
    ctx.lineTo(58, 22);
    ctx.quadraticCurveTo(80, 15, 102, 22);
    ctx.lineTo(102, 35);
    ctx.stroke();
    // Red cross on cap
    ctx.fillStyle = '#dd3333';
    ctx.fillRect(75, 22, 10, 3);
    ctx.fillRect(78, 19, 4, 9);

    // Arms (sleeves)
    ctx.fillStyle = '#ffffff';
    // Left arm
    ctx.beginPath();
    ctx.moveTo(45, 110);
    ctx.quadraticCurveTo(28, 140, 32, 190);
    ctx.lineTo(44, 188);
    ctx.quadraticCurveTo(38, 140, 52, 114);
    ctx.closePath();
    ctx.fill();
    // Right arm
    ctx.beginPath();
    ctx.moveTo(115, 110);
    ctx.quadraticCurveTo(132, 140, 128, 190);
    ctx.lineTo(116, 188);
    ctx.quadraticCurveTo(122, 140, 108, 114);
    ctx.closePath();
    ctx.fill();

    // Hands
    ctx.fillStyle = '#f5d0b0';
    ctx.beginPath();
    ctx.ellipse(38, 192, 7, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(122, 192, 7, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    return c.toDataURL();
  }

  // ====== DAY END POPUP ======
  function showDayEndPopup() {
    dayEndPopupOpen = true;
    dayEndNumberEl.textContent = dayNumber;
    statServedEl.textContent = dayStats.patientsServed;
    statLostEl.textContent = dayStats.patientsLost;
    statEarnedEl.textContent = '$' + dayStats.moneyEarned;
    statSpentEl.textContent = '$' + dayStats.moneySpent;

    dayEndPopupEl.style.display = 'block';
    controls.unlock();
    updateTaskText();
  }

  function closeDayEndPopup() {
    dayEndPopupOpen = false;
    dayEndPopupEl.style.display = 'none';

    dayNumber++;

    if (Game.Patients && Game.Patients.clearAll) {
      Game.Patients.clearAll();
    }
    if (Game.Cashier && Game.Cashier.clearQueue) {
      Game.Cashier.clearQueue();
    }

    gameTime = 0;
    dayStats = { patientsServed: 0, patientsLost: 0, moneyEarned: 0, moneySpent: 0 };
    updateLostHUD();
    updateHUD();
    updateTaskText();
    updateSignTexture();

    controls.lock();
  }

  function updateLostHUD() {
    if (lostHudEl) lostHudEl.textContent = dayStats.patientsLost;
  }

  // ====== HUD UPDATE ======
  function updateHUD() {
    if (timeValueEl) timeValueEl.textContent = getFormattedTime();
    if (dayValueEl) dayValueEl.textContent = Game.Lang.t('hud.day', [dayNumber]);
  }

  // ====== CLICK HANDLER ======
  function onMouseDown(e) {
    if (e.button !== 0) return;
    if (!controls.isLocked) return;
    if (dayEndPopupOpen) return;

    // Check other popups
    if (Game.Patients && Game.Patients.isPopupOpen()) return;
    if (Game.Shop && Game.Shop.isOpen()) return;
    if (Game.Cashier && Game.Cashier.isPopupOpen()) return;

    onSignClick();
  }

  // ====== PUBLIC API ======
  window.Game.Shift = {
    setup: function(_THREE, _scene, _camera, _controls, collidables) {
      THREE = _THREE;
      scene = _scene;
      camera = _camera;
      controls = _controls;

      interactRay = new THREE.Raycaster();
      interactRay.far = 5;
      screenCenter = new THREE.Vector2(0, 0);

      // Cache UI
      timeValueEl = document.getElementById('time-value');
      dayValueEl = document.getElementById('day-value');
      taskTextEl = document.getElementById('task-text');
      taskMascotEl = document.getElementById('task-mascot');
      dayEndPopupEl = document.getElementById('day-end-popup');
      statServedEl = document.getElementById('stat-served');
      statLostEl = document.getElementById('stat-lost');
      statEarnedEl = document.getElementById('stat-earned');
      statSpentEl = document.getElementById('stat-spent');
      dayEndNumberEl = document.getElementById('day-end-number');
      lostHudEl = document.getElementById('lost-patients-value');

      // Draw mascot
      var mascotUrl = drawMascot();
      if (taskMascotEl) {
        taskMascotEl.style.backgroundImage = 'url(' + mascotUrl + ')';
      }

      // Create 3D sign
      createSign();

      // Next day button
      var nextBtn = document.getElementById('day-end-next');
      if (nextBtn) {
        nextBtn.addEventListener('click', function() {
          closeDayEndPopup();
        });
      }

      // Click handler
      document.addEventListener('mousedown', onMouseDown);

      // Register with central interaction system
      Game.Interaction.register('shift', function() {
        return signMeshes;
      }, false, 5);

      // Initial state
      updateHUD();
      updateTaskText();
    },

    update: function(delta) {
      var pauseScreen = document.getElementById('pause-screen');
      var isPauseVisible = pauseScreen && pauseScreen.style.display !== 'none';
      if (isPauseVisible) return;

      if (shiftOpen) {
        gameTime += delta;
        if (gameTime >= SHIFT_DURATION) {
          gameTime = SHIFT_DURATION;
          endShiftTime();
        }
        updateHUD();
      }

      // When shift ending, check if all patients are done
      if (shiftEnding && !dayEndPopupOpen) {
        if (getRemainingPatients() === 0) {
          finishDay();
        }
      }

      updateSignHover();
      updateTaskText();
    },

    isOpen: function() { return shiftOpen; },
    isPopupOpen: function() { return dayEndPopupOpen; },
    hasInteraction: function() { return hoveredSign; },
    getDayNumber: function() { return dayNumber; },
    getGameTime: function() { return gameTime; },

    trackEarning: function(amount) { dayStats.moneyEarned += amount; },
    trackSpending: function(amount) { dayStats.moneySpent += amount; },
    trackPatientServed: function() { dayStats.patientsServed++; },
    trackPatientLost: function() { dayStats.patientsLost++; updateLostHUD(); }
  };
})();
