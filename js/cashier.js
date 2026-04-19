(function() {
  window.Game = window.Game || {};

  var THREE, scene, camera, controls;
  var terminalMeshes = [];
  var patientPos;
  var cashierDeskGroup = null;
  var cashierCollisionBox = null;
  // Offset from desk center to patient position (computed in setup)
  var patientOffsetX = 0;
  var patientOffsetZ = 0;

  // Player balance (separate from register balance)
  var balance = 350;

  // Register (money accumulated in the self-checkout, not yet withdrawn)
  var registerBalance = 0;

  // Queue of patients waiting to check out
  var registerQueue = [];
  var currentPatient = null;
  var checkoutTimer = 0;

  // Withdraw state
  var isDraining = false;
  var drainInitial = 0;
  var drainRemoved = 0;
  var shakeTimer = 0;
  var baseGroupX = 0;
  var baseGroupZ = 0;

  // Hover
  var hoveredRegister = false;
  var prevHovered = false;

  // Indicator sprite above the register
  var indicatorSprite = null;
  var indicatorCanvas = null;
  var indicatorTexture = null;
  var indicatorTier = -1; // -1 = unset to force initial draw

  // Suction particles during withdraw
  var suctionParticles = [];
  var suctionTexture = null;
  var suctionSpawnTimer = 0;

  // Tutorial fired flags
  var firedAtRegister = false;

  // Pricing is now computed in patients.js and passed via patient.paymentInfo
  var XP_BY_SEVERITY = { mild: 10, medium: 15, severe: 20 };
  var XP_DIAGNOSIS_BONUS = 5;

  var CHECKOUT_TIME = 10.0;   // seconds per patient
  var WITHDRAW_RATE = 25;     // $/sec = 4 sec / $100
  var SUCTION_SPAWN_INTERVAL = 0.08;

  var balanceEl;


  function getQueuePosition(index) {
    // Queue extends backwards into the building (more negative z)
    return new THREE.Vector3(patientPos.x, 0, patientPos.z - index * 1.0);
  }

  function updateBalanceHUD() {
    if (balanceEl) {
      balanceEl.textContent = '$' + Math.floor(balance);
      balanceEl.style.color = balance < 0 ? '#ff4444' : '#4ade80';
      var hud = document.getElementById('balance-hud');
      if (hud) {
        hud.style.borderColor = balance < 0 ? 'rgba(255, 68, 68, 0.3)' : 'rgba(74, 222, 128, 0.3)';
      }
    }
  }

  function awardPatientXP(patient) {
    if (!Game.Levels) return;
    var xpBase = XP_BY_SEVERITY[patient.severity.key] || 10;
    var xpDiag = patient.wasDiagnosed ? XP_DIAGNOSIS_BONUS : 0;
    Game.Levels.awardXP(xpBase + xpDiag, {
      treatment: xpBase,
      diagnosis: xpDiag
    });
  }

  // ====== INDICATOR ICONS ======

  function drawIndicatorTier(tier) {
    var ctx = indicatorCanvas.getContext('2d');
    ctx.clearRect(0, 0, indicatorCanvas.width, indicatorCanvas.height);
    if (tier <= 0) { indicatorTexture.needsUpdate = true; return; }

    var cx = indicatorCanvas.width / 2;
    var cy = indicatorCanvas.height / 2;

    if (tier === 1) {
      // Tier 1: small coin stack
      for (var i = 0; i < 3; i++) {
        var y = cy + 18 - i * 8;
        ctx.fillStyle = '#ffcc33';
        ctx.strokeStyle = '#8a6a10';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(cx, y, 18, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#a8820c';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', cx, y);
      }
    } else if (tier === 2) {
      // Tier 2: money bag
      // Bag body
      ctx.fillStyle = '#8b6a3a';
      ctx.strokeStyle = '#4a3a1e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 10, 28, 26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Tied top (cinched)
      ctx.fillStyle = '#6b4e28';
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy - 18);
      ctx.lineTo(cx + 12, cy - 18);
      ctx.lineTo(cx + 14, cy - 10);
      ctx.lineTo(cx - 14, cy - 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // $ symbol on bag
      ctx.fillStyle = '#ffe07a';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', cx, cy + 12);
    } else {
      // Tier 3: big sack with overflowing bills
      // Bills sticking up (back layer)
      ctx.fillStyle = '#3da86a';
      ctx.strokeStyle = '#1a5a33';
      ctx.lineWidth = 1.5;
      var bills = [{ x: cx - 10, rot: -0.3 }, { x: cx + 8, rot: 0.25 }, { x: cx - 2, rot: 0.0 }];
      for (var b = 0; b < bills.length; b++) {
        ctx.save();
        ctx.translate(bills[b].x, cy - 16);
        ctx.rotate(bills[b].rot);
        ctx.fillRect(-10, -14, 20, 18);
        ctx.strokeRect(-10, -14, 20, 18);
        ctx.restore();
      }
      // Bag body (bigger)
      ctx.fillStyle = '#7a5a2e';
      ctx.strokeStyle = '#3a2a14';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 14, 34, 30, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Tied top
      ctx.fillStyle = '#5c4422';
      ctx.beginPath();
      ctx.moveTo(cx - 14, cy - 10);
      ctx.lineTo(cx + 14, cy - 10);
      ctx.lineTo(cx + 16, cy - 2);
      ctx.lineTo(cx - 16, cy - 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // $ symbol on bag
      ctx.fillStyle = '#ffe07a';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', cx, cy + 16);
    }

    indicatorTexture.needsUpdate = true;
  }

  function updateIndicator() {
    var t;
    if (registerBalance <= 0) t = 0;
    else if (registerBalance < 50) t = 1;
    else if (registerBalance < 150) t = 2;
    else t = 3;
    if (t !== indicatorTier) {
      indicatorTier = t;
      drawIndicatorTier(t);
      if (indicatorSprite) indicatorSprite.visible = t > 0;
    }
  }

  function createIndicator() {
    indicatorCanvas = document.createElement('canvas');
    indicatorCanvas.width = 96;
    indicatorCanvas.height = 96;
    indicatorTexture = new THREE.CanvasTexture(indicatorCanvas);
    indicatorTexture.minFilter = THREE.LinearFilter;
    var mat = new THREE.SpriteMaterial({ map: indicatorTexture, transparent: true, depthTest: false });
    indicatorSprite = new THREE.Sprite(mat);
    indicatorSprite.scale.set(0.5, 0.5, 1);
    indicatorSprite.visible = false;
    scene.add(indicatorSprite);
  }

  function updateIndicatorPosition() {
    if (!indicatorSprite || !cashierDeskGroup) return;
    indicatorSprite.position.set(
      cashierDeskGroup.position.x,
      1.95,
      cashierDeskGroup.position.z
    );
  }

  // ====== SUCTION PARTICLES ======

  function getSuctionTexture() {
    if (suctionTexture) return suctionTexture;
    var c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    var ctx = c.getContext('2d');
    // Green glow
    var grad = ctx.createRadialGradient(16, 16, 2, 16, 16, 15);
    grad.addColorStop(0, 'rgba(130, 220, 120, 0.95)');
    grad.addColorStop(0.6, 'rgba(80, 160, 80, 0.5)');
    grad.addColorStop(1, 'rgba(40, 90, 40, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    // $ symbol
    ctx.fillStyle = 'rgba(240, 255, 200, 0.95)';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 16, 17);
    suctionTexture = new THREE.CanvasTexture(c);
    suctionTexture.minFilter = THREE.LinearFilter;
    return suctionTexture;
  }

  function spawnSuctionParticle() {
    var mat = new THREE.SpriteMaterial({
      map: getSuctionTexture(),
      transparent: true,
      depthTest: false
    });
    var sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.18, 0.18, 1);
    // Emerge from screen area of register
    sprite.position.set(
      cashierDeskGroup.position.x + (Math.random() - 0.5) * 0.25,
      1.15 + (Math.random() - 0.5) * 0.15,
      cashierDeskGroup.position.z + 0.05
    );
    scene.add(sprite);
    suctionParticles.push({
      sprite: sprite,
      life: 0.4,
      maxLife: 0.4,
      startPos: sprite.position.clone()
    });
  }

  function updateSuctionParticles(delta) {
    for (var i = suctionParticles.length - 1; i >= 0; i--) {
      var p = suctionParticles[i];
      p.life -= delta;
      if (p.life <= 0) {
        scene.remove(p.sprite);
        if (p.sprite.material.map) {
          // shared texture — don't dispose
        }
        p.sprite.material.dispose();
        suctionParticles.splice(i, 1);
        continue;
      }
      // Interpolate toward camera
      var t = 1 - (p.life / p.maxLife);
      var camPos = camera.position;
      p.sprite.position.x = p.startPos.x + (camPos.x - p.startPos.x) * t;
      p.sprite.position.y = p.startPos.y + (camPos.y - p.startPos.y) * t;
      p.sprite.position.z = p.startPos.z + (camPos.z - p.startPos.z) * t;
      var alpha = p.life / p.maxLife;
      p.sprite.material.opacity = alpha;
      var s = 0.18 * (0.5 + 0.5 * alpha);
      p.sprite.scale.set(s, s, 1);
    }
  }

  function clearSuctionParticles() {
    for (var i = 0; i < suctionParticles.length; i++) {
      scene.remove(suctionParticles[i].sprite);
      suctionParticles[i].sprite.material.dispose();
    }
    suctionParticles.length = 0;
  }

  // ====== WITHDRAW ======

  function startWithdraw() {
    if (isDraining || registerBalance <= 0) return;
    isDraining = true;
    drainInitial = registerBalance;
    drainRemoved = 0;
    shakeTimer = 0;
    suctionSpawnTimer = 0;
    baseGroupX = cashierDeskGroup.position.x;
    baseGroupZ = cashierDeskGroup.position.z;
  }

  function tickWithdraw(delta) {
    if (!isDraining) return;
    if (registerBalance <= 0) { stopWithdraw(); return; }

    var amount = Math.min(WITHDRAW_RATE * delta, registerBalance);
    registerBalance -= amount;
    drainRemoved += amount;
    balance += amount;
    updateBalanceHUD();
    updateIndicator();

    // Shake register
    shakeTimer += delta;
    var sx = Math.sin(shakeTimer * 40) * 0.025;
    var sz = Math.cos(shakeTimer * 37) * 0.025;
    cashierDeskGroup.position.x = baseGroupX + sx;
    cashierDeskGroup.position.z = baseGroupZ + sz;

    // Spawn particles
    suctionSpawnTimer += delta;
    while (suctionSpawnTimer >= SUCTION_SPAWN_INTERVAL) {
      suctionSpawnTimer -= SUCTION_SPAWN_INTERVAL;
      spawnSuctionParticle();
    }
  }

  function stopWithdraw() {
    if (!isDraining) return;
    isDraining = false;
    // Restore register position
    if (cashierDeskGroup) {
      cashierDeskGroup.position.x = baseGroupX;
      cashierDeskGroup.position.z = baseGroupZ;
    }
    // Notify tutorial
    if (drainRemoved > 0 && Game.Tutorial && Game.Tutorial.isActive()) {
      Game.Tutorial.onEvent('register_withdrawn');
    }
    drainRemoved = 0;
    drainInitial = 0;
  }

  function getWithdrawProgress() {
    if (!isDraining || drainInitial <= 0) return 0;
    return Math.min(drainRemoved / drainInitial, 1);
  }

  // ====== HOVER ======

  function clearHighlight() { Game.Outline.clearHover(); }

  function updateHoverDetection() {
    if (!controls.isLocked) {
      if (prevHovered) clearHighlight();
      hoveredRegister = false;
      prevHovered = false;
      return;
    }
    if (Game.Furniture.isCarrying()) {
      if (prevHovered) clearHighlight();
      hoveredRegister = false;
      prevHovered = false;
      return;
    }
    if (!Game.Interaction.isActive('cashier')) {
      if (prevHovered) clearHighlight();
      hoveredRegister = false;
      prevHovered = false;
      return;
    }

    var cachedHits = Game.Interaction.getHits('cashier');
    var nowHovered = !!cachedHits;

    if (nowHovered && !prevHovered) {
      var outlineObjects = [];
      cashierDeskGroup.traverse(function(child) {
        if (child.isMesh) outlineObjects.push(child);
      });
      Game.Outline.setHover(outlineObjects);
    } else if (!nowHovered && prevHovered) {
      clearHighlight();
    }

    hoveredRegister = nowHovered;
    prevHovered = nowHovered;

    var hintEl = document.getElementById('interact-hint');
    if (nowHovered) {
      var hint;
      if (registerBalance > 0) {
        hint = Game.Lang.t('register.hint.withdraw');
      } else if (currentPatient) {
        hint = Game.Lang.t('register.hint.busy');
      } else {
        hint = Game.Lang.t('register.hint.move');
      }
      hintEl.textContent = hint;
      hintEl.style.display = 'block';
    }
  }

  window.Game.Cashier = {
    // Backward-compat popup flag — never opens anything
    isPopupOpen: function() { return false; },
    getBalance: function() { return balance; },
    spend: function(amount) {
      balance -= amount;
      if (Game.Shift) Game.Shift.trackSpending(amount);
      updateBalanceHUD();
    },
    earn: function(amount) {
      balance += amount;
      updateBalanceHUD();
    },

    hasInteraction: function() { return hoveredRegister && registerBalance > 0; },
    isDeskHovered: function() { return prevHovered; },
    hasPatients: function() { return !!currentPatient || registerQueue.length > 0; },

    // Register state
    getRegisterBalance: function() { return registerBalance; },
    hasMoney: function() { return registerBalance > 0; },
    isWithdrawing: function() { return isDraining; },

    // Withdraw control (driven by furniture.js hold-E system)
    startWithdraw: startWithdraw,
    tickWithdraw: tickWithdraw,
    stopWithdraw: stopWithdraw,
    getWithdrawProgress: getWithdrawProgress,

    clearQueue: function() {
      for (var i = 0; i < registerQueue.length; i++) {
        var p = registerQueue[i];
        if (p.mesh) scene.remove(p.mesh);
      }
      if (currentPatient && currentPatient.mesh) {
        scene.remove(currentPatient.mesh);
      }
      registerQueue.length = 0;
      currentPatient = null;
      checkoutTimer = 0;
      firedAtRegister = false;
    },

    addPatientToQueue: function(patient) {
      // paymentInfo must be set by patients.js prior to this call
      if (!patient.paymentInfo) {
        patient.paymentInfo = { procedure: 0, treatment: 0, total: 0, reason: 'unknown' };
      }
      if (!currentPatient) {
        currentPatient = patient;
        patient.targetPos = patientPos.clone();
      } else {
        registerQueue.push(patient);
        patient.targetPos = getQueuePosition(registerQueue.length);
      }
      patient.state = 'discharged';
    },

    setup: function(_THREE, _scene, _camera, _controls, cashierDesk) {
      THREE = _THREE;
      scene = _scene;
      camera = _camera;
      controls = _controls;
      terminalMeshes = cashierDesk.terminalMeshes;
      patientPos = cashierDesk.patientPos;
      cashierDeskGroup = cashierDesk.group;
      cashierCollisionBox = cashierDesk.collisionBox;

      patientOffsetX = patientPos.x - cashierDeskGroup.position.x;
      patientOffsetZ = patientPos.z - cashierDeskGroup.position.z;

      balanceEl = document.getElementById('balance-value');
      updateBalanceHUD();

      createIndicator();
      updateIndicator();
      updateIndicatorPosition();

      // Register draggable fixture
      if (cashierDeskGroup && cashierCollisionBox) {
        Game.Furniture.registerFixture({
          type: 'cashierDesk',
          group: cashierDeskGroup,
          collisionBox: cashierCollisionBox,
          canPickUp: function() {
            return !currentPatient && registerQueue.length === 0 && !isDraining;
          },
          onMoved: function(pos) {
            patientPos.set(pos.x + patientOffsetX, 0, pos.z + patientOffsetZ);
            if (currentPatient && (currentPatient.state === 'discharged' || currentPatient.state === 'atRegister')) {
              currentPatient.targetPos = patientPos.clone();
            }
            for (var qi = 0; qi < registerQueue.length; qi++) {
              registerQueue[qi].targetPos = getQueuePosition(qi + 1);
            }
            updateIndicatorPosition();
          }
        });
      }

      // Register with interaction system — hit any part of the register group
      Game.Interaction.register('cashier', function() {
        var meshes = [];
        cashierDeskGroup.traverse(function(child) {
          if (child.isMesh) meshes.push(child);
        });
        return meshes;
      }, false, 3);
    },

    update: function(delta) {
      updateHoverDetection();
      updateIndicatorPosition();

      // Patient arrival at register
      if (currentPatient && currentPatient.state === 'discharged') {
        var dx = currentPatient.mesh.position.x - patientPos.x;
        var dz = currentPatient.mesh.position.z - patientPos.z;
        if (dx * dx + dz * dz < 0.1) {
          currentPatient.state = 'atRegister';
          currentPatient.targetPos = null;
          checkoutTimer = 0;
          if (!firedAtRegister && Game.Tutorial && Game.Tutorial.isActive()) {
            Game.Tutorial.onEvent('patient_at_register');
            firedAtRegister = true;
          }
        }
      }

      // Checkout countdown
      if (currentPatient && currentPatient.state === 'atRegister') {
        checkoutTimer += delta;
        if (checkoutTimer >= CHECKOUT_TIME) {
          var info = currentPatient.paymentInfo;
          var paidPatient = currentPatient;
          if (info) {
            registerBalance += info.total;
            if (Game.Shift) Game.Shift.trackEarning(info.total);
            updateIndicator();
          }

          // Send patient to exit
          currentPatient.state = 'leaving';
          currentPatient.targetPos = new THREE.Vector3(0, 0, 1);
          currentPatient.leavePhase = 'toExit';
          currentPatient = null;
          checkoutTimer = 0;

          // Advance queue
          if (registerQueue.length > 0) {
            currentPatient = registerQueue.shift();
            currentPatient.targetPos = patientPos.clone();
            for (var i = 0; i < registerQueue.length; i++) {
              registerQueue[i].targetPos = getQueuePosition(i + 1);
            }
          }
          firedAtRegister = false;

          // Notify patient system (spawns next)
          if (Game.Patients && Game.Patients.onPatientPaid) {
            Game.Patients.onPatientPaid();
          }

          // XP
          awardPatientXP(paidPatient);
        }
      }

      // Suction particles (always update so spawned ones complete even after release)
      updateSuctionParticles(delta);
    }
  };
})();
