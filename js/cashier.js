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
  var balance = 350;
  var cashierQueue = [];
  var currentPatient = null;
  var enteredAmount = '';
  var isOpen = false;
  var hoveredTerminal = false;
  var prevHovered = false;

  // Price map by severity key
  var BASE_PRICES = { mild: 35, medium: 50, severe: 70 };
  var DIAGNOSIS_BONUS = 15;
  var PRICE_VARIANCE = 5;
  var XP_BY_SEVERITY = { mild: 10, medium: 15, severe: 20 };
  var XP_DIAGNOSIS_BONUS = 5;

  function getPatientPrice(patient) {
    var base = BASE_PRICES[patient.severity.key] || 35;
    var variance = Math.floor(Math.random() * (PRICE_VARIANCE * 2 + 1)) - PRICE_VARIANCE;
    var treatment = base + variance;
    var diagBonus = patient.wasDiagnosed ? DIAGNOSIS_BONUS : 0;
    return { treatment: treatment, diagnosis: diagBonus, total: treatment + diagBonus };
  }

  // Raycaster for terminal interaction
  var interactRay;
  var screenCenter;

  // UI elements
  var popupEl, screenAmountEl, screenEnteredEl, applyBtn, balanceEl;
  var screenBreakdownEl, screenXpEl;

  function getQueuePosition(index) {
    return new THREE.Vector3(patientPos.x, 0, patientPos.z + index * 1.0);
  }

  function updateBalanceHUD() {
    if (balanceEl) {
      balanceEl.textContent = '$' + balance;
      balanceEl.style.color = balance < 0 ? '#ff4444' : '#4ade80';
      var hud = document.getElementById('balance-hud');
      if (hud) {
        hud.style.borderColor = balance < 0 ? 'rgba(255, 68, 68, 0.3)' : 'rgba(74, 222, 128, 0.3)';
      }
    }
  }

  function updateTerminalScreen() {
    if (!currentPatient) return;
    var info = currentPatient.paymentInfo;
    if (!info) return;
    var required = info.total;
    screenAmountEl.textContent = '$' + required;
    screenEnteredEl.textContent = enteredAmount || '0';

    // Show breakdown
    if (screenBreakdownEl) {
      var text = '$' + info.treatment + ' лечение';
      if (info.diagnosis > 0) text += ' + $' + info.diagnosis + ' диагностика';
      screenBreakdownEl.textContent = text;
    }

    // Show XP preview
    if (screenXpEl) {
      var xpBase = XP_BY_SEVERITY[currentPatient.severity.key] || 10;
      var xpDiag = currentPatient.wasDiagnosed ? XP_DIAGNOSIS_BONUS : 0;
      var xpText = '+' + xpBase + ' XP лечение';
      if (xpDiag > 0) xpText += ' + ' + xpDiag + ' XP диагностика';
      screenXpEl.textContent = xpText;
    }

    // Enable apply button only if entered amount matches exactly
    if (parseInt(enteredAmount, 10) === required) {
      applyBtn.disabled = false;
      applyBtn.classList.add('active');
    } else {
      applyBtn.disabled = true;
      applyBtn.classList.remove('active');
    }
  }

  function openTerminal() {
    if (!currentPatient || isOpen) return;
    if (Game.Staff && Game.Staff.isStaffCashierHired()) {
      Game.Inventory.showNotification('Кассир уже работает');
      return;
    }
    isOpen = true;
    enteredAmount = '';
    popupEl.style.display = 'block';
    controls.unlock();
    updateTerminalScreen();
  }

  function closeTerminal() {
    isOpen = false;
    popupEl.style.display = 'none';
    enteredAmount = '';
    if (screenBreakdownEl) screenBreakdownEl.textContent = '';
    if (screenXpEl) screenXpEl.textContent = '';
    controls.lock();
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

  function processPayment() {
    if (!currentPatient) return;
    var info = currentPatient.paymentInfo;
    if (!info) return;
    var required = info.total;
    if (parseInt(enteredAmount, 10) !== required) return;

    balance += required;
    if (Game.Shift) Game.Shift.trackEarning(required);
    updateBalanceHUD();
    awardPatientXP(currentPatient);
    closeTerminal();

    // Notify patient system about payment (spawns next patient on sequential levels)
    if (Game.Patients && Game.Patients.onPatientPaid) {
      Game.Patients.onPatientPaid();
    }

    // Signal patient to leave
    currentPatient.state = 'leaving';
    currentPatient.targetPos = new THREE.Vector3(0, 0, 1);
    currentPatient.leavePhase = 'toExit';
    currentPatient = null;

    // Move next patient in queue up
    if (cashierQueue.length > 0) {
      currentPatient = cashierQueue.shift();
      currentPatient.targetPos = patientPos.clone();
      // Update queue positions for remaining
      for (var i = 0; i < cashierQueue.length; i++) {
        cashierQueue[i].targetPos = getQueuePosition(i + 1);
      }
    }
  }

  function updateHoverDetection() {
    if (isOpen || !controls.isLocked) {
      hoveredTerminal = false;
      return;
    }
    if (Game.Furniture.isCarrying()) {
      hoveredTerminal = false;
      return;
    }

    interactRay.setFromCamera(screenCenter, camera);

    // Check terminal meshes
    var hitTerminal = interactRay.intersectObjects(terminalMeshes, false).length > 0;

    // Check current patient mesh (if at cashier)
    var hitPatient = false;
    if (!hitTerminal && currentPatient && currentPatient.state === 'atCashier') {
      var patientMeshes = [];
      currentPatient.mesh.traverse(function(child) {
        if (child.isMesh) patientMeshes.push(child);
      });
      hitPatient = interactRay.intersectObjects(patientMeshes, false).length > 0;
    }

    var hintEl = document.getElementById('interact-hint');

    var nowHovered = (hitTerminal || hitPatient) && currentPatient && currentPatient.state === 'atCashier';

    if (nowHovered && !prevHovered) {
      // Highlight terminal meshes
      for (var i = 0; i < terminalMeshes.length; i++) {
        var m = terminalMeshes[i];
        m.material = m.material.clone();
        m.material.emissive = new THREE.Color(0x00ff44);
        m.material.emissiveIntensity = 0.35;
      }
      // Highlight patient
      if (currentPatient && currentPatient.mesh.userData.bodyParts) {
        for (var j = 0; j < currentPatient.mesh.userData.bodyParts.length; j++) {
          var part = currentPatient.mesh.userData.bodyParts[j];
          part.material = part.material.clone();
          part.material.emissive = new THREE.Color(0x00ff44);
          part.material.emissiveIntensity = 0.35;
        }
      }
    } else if (!nowHovered && prevHovered) {
      // Unhighlight terminal meshes
      for (var i = 0; i < terminalMeshes.length; i++) {
        var m = terminalMeshes[i];
        m.material.emissive = new THREE.Color(0x000000);
        m.material.emissiveIntensity = 0;
      }
      // Unhighlight patient
      if (currentPatient && currentPatient.mesh.userData.bodyParts) {
        for (var j = 0; j < currentPatient.mesh.userData.bodyParts.length; j++) {
          var part = currentPatient.mesh.userData.bodyParts[j];
          part.material.emissive = new THREE.Color(0x000000);
          part.material.emissiveIntensity = 0;
        }
      }
    }

    hoveredTerminal = nowHovered;
    prevHovered = nowHovered;

    if (hoveredTerminal) {
      if (!Game.Patients.hasInteraction() && !Game.Consumables.hasInteraction() && !Game.Consumables.hasBoxInteraction() && !Game.Consumables.isHoldingBox() && !Game.Shelves.hasInteraction()) {
        hintEl.textContent = '\u041B\u041A\u041C \u2014 \u041E\u043F\u043B\u0430\u0442\u0430';
        hintEl.style.display = 'block';
      }
    }
  }

  window.Game.Cashier = {
    isPopupOpen: function() { return isOpen; },
    getBalance: function() { return balance; },
    spend: function(amount) {
      balance -= amount;
      if (Game.Shift) Game.Shift.trackSpending(amount);
      updateBalanceHUD();
    },

    hasInteraction: function() { return hoveredTerminal; },
    hasPatients: function() { return !!currentPatient || cashierQueue.length > 0; },

    // Staff APIs
    getCurrentPatient: function() { return currentPatient; },
    processPaymentAuto: function() {
      if (!currentPatient) return;
      if (!currentPatient.paymentInfo) {
        currentPatient.paymentInfo = getPatientPrice(currentPatient);
      }
      var required = currentPatient.paymentInfo.total;
      balance += required;
      if (Game.Shift) Game.Shift.trackEarning(required);
      updateBalanceHUD();
      awardPatientXP(currentPatient);
      if (isOpen) closeTerminal();

      // Notify patient system about payment
      if (Game.Patients && Game.Patients.onPatientPaid) {
        Game.Patients.onPatientPaid();
      }

      // Signal patient to leave
      currentPatient.state = 'leaving';
      currentPatient.targetPos = new THREE.Vector3(0, 0, 1);
      currentPatient.leavePhase = 'toExit';
      currentPatient = null;

      // Move next patient up
      if (cashierQueue.length > 0) {
        currentPatient = cashierQueue.shift();
        currentPatient.targetPos = patientPos.clone();
        for (var i = 0; i < cashierQueue.length; i++) {
          cashierQueue[i].targetPos = getQueuePosition(i + 1);
        }
      }
    },

    clearQueue: function() {
      // Remove all patients from cashier queue
      for (var i = 0; i < cashierQueue.length; i++) {
        var p = cashierQueue[i];
        if (p.mesh) scene.remove(p.mesh);
      }
      if (currentPatient && currentPatient.mesh) {
        scene.remove(currentPatient.mesh);
      }
      cashierQueue.length = 0;
      currentPatient = null;
      if (isOpen) closeTerminal();
    },

    addPatientToQueue: function(patient) {
      // Calculate payment once when entering queue
      patient.paymentInfo = getPatientPrice(patient);

      if (!currentPatient) {
        currentPatient = patient;
        patient.targetPos = patientPos.clone();
      } else {
        cashierQueue.push(patient);
        patient.targetPos = getQueuePosition(cashierQueue.length);
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

      // Store offset from desk center to patient position
      patientOffsetX = patientPos.x - cashierDeskGroup.position.x;
      patientOffsetZ = patientPos.z - cashierDeskGroup.position.z;

      interactRay = new THREE.Raycaster();
      interactRay.far = 3;
      screenCenter = new THREE.Vector2(0, 0);

      // Cache UI elements
      popupEl = document.getElementById('cashier-popup');
      screenAmountEl = document.getElementById('terminal-amount');
      screenEnteredEl = document.getElementById('terminal-entered');
      applyBtn = document.getElementById('terminal-apply');
      balanceEl = document.getElementById('balance-value');
      screenBreakdownEl = document.getElementById('terminal-breakdown');
      screenXpEl = document.getElementById('terminal-xp');

      updateBalanceHUD();

      // Keypad button handlers
      var keys = popupEl.querySelectorAll('.terminal-key');
      for (var i = 0; i < keys.length; i++) {
        (function(btn) {
          btn.addEventListener('click', function() {
            var val = btn.dataset.value;
            if (val === 'C') {
              enteredAmount = '';
            } else {
              if (enteredAmount.length < 4) {
                enteredAmount += val;
              }
            }
            updateTerminalScreen();
          });
        })(keys[i]);
      }

      // Apply button
      applyBtn.addEventListener('click', function() {
        if (!applyBtn.disabled) {
          processPayment();
        }
      });

      // Close on ESC-like behavior (handled by pointer lock)
      // Click to open terminal
      document.addEventListener('mousedown', function(e) {
        if (e.button !== 0 || !controls.isLocked) return;
        if (Game.Furniture.isCarrying()) return;
        if (isOpen) return;
        if (Game.Patients.isPopupOpen()) return;
        if (Game.Shop.isOpen()) return;
        if (Game.Levels && Game.Levels.isPopupOpen()) return;
        if (hoveredTerminal && currentPatient && currentPatient.state === 'atCashier') {
          openTerminal();
        }
      });

      // Close button
      var closeBtn = document.getElementById('terminal-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', function() {
          closeTerminal();
        });
      }

      // Register cashier desk as draggable fixture
      if (cashierDeskGroup && cashierCollisionBox) {
        Game.Furniture.registerFixture({
          type: 'cashierDesk',
          group: cashierDeskGroup,
          collisionBox: cashierCollisionBox,
          canPickUp: function() { return !currentPatient; },
          onMoved: function(pos) {
            // Update patient position relative to new desk position
            patientPos.set(pos.x + patientOffsetX, 0, pos.z + patientOffsetZ);
            // Update targets for queued patients
            if (currentPatient && (currentPatient.state === 'discharged' || currentPatient.state === 'atCashier')) {
              currentPatient.targetPos = patientPos.clone();
            }
            for (var qi = 0; qi < cashierQueue.length; qi++) {
              cashierQueue[qi].targetPos = getQueuePosition(qi + 1);
            }
          }
        });
      }
    },

    update: function(delta) {
      updateHoverDetection();

      // Check if current patient has arrived at cashier
      if (currentPatient && currentPatient.state === 'discharged') {
        var dx = currentPatient.mesh.position.x - patientPos.x;
        var dz = currentPatient.mesh.position.z - patientPos.z;
        if (dx * dx + dz * dz < 0.1) {
          currentPatient.state = 'atCashier';
          currentPatient.targetPos = null;
        }
      }
    }
  };
})();
