(function() {
  window.Game = window.Game || {};

  var THREE, scene, camera, controls;
  var terminalMeshes = [];
  var patientPos;
  var balance = 100;
  var cashierQueue = [];
  var currentPatient = null;
  var enteredAmount = '';
  var isOpen = false;
  var hoveredTerminal = false;
  var prevHovered = false;

  // Price map by severity key
  var PRICES = { mild: 30, medium: 50, severe: 80 };

  // Raycaster for terminal interaction
  var interactRay;
  var screenCenter;

  // UI elements
  var popupEl, screenAmountEl, screenEnteredEl, applyBtn, balanceEl;

  function getQueuePosition(index) {
    return new THREE.Vector3(3.5, 0, -8.0 + index * 1.0);
  }

  function updateBalanceHUD() {
    if (balanceEl) {
      balanceEl.textContent = '$' + balance;
    }
  }

  function updateTerminalScreen() {
    if (!currentPatient) return;
    var required = PRICES[currentPatient.severity.key] || 0;
    screenAmountEl.textContent = '$' + required;
    screenEnteredEl.textContent = enteredAmount || '0';

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
    controls.lock();
  }

  function processPayment() {
    if (!currentPatient) return;
    var required = PRICES[currentPatient.severity.key] || 0;
    if (parseInt(enteredAmount, 10) !== required) return;

    balance += required;
    updateBalanceHUD();
    closeTerminal();

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
      if (!Game.Patients.hasInteraction() && !Game.Consumables.hasInteraction() && !Game.Shelves.hasInteraction()) {
        hintEl.textContent = '\u041B\u041A\u041C \u2014 \u041E\u043F\u043B\u0430\u0442\u0430';
        hintEl.style.display = 'block';
      }
    }
  }

  window.Game.Cashier = {
    isPopupOpen: function() { return isOpen; },
    getBalance: function() { return balance; },

    hasInteraction: function() { return hoveredTerminal; },

    addPatientToQueue: function(patient) {
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

      interactRay = new THREE.Raycaster();
      interactRay.far = 3;
      screenCenter = new THREE.Vector2(0, 0);

      // Cache UI elements
      popupEl = document.getElementById('cashier-popup');
      screenAmountEl = document.getElementById('terminal-amount');
      screenEnteredEl = document.getElementById('terminal-entered');
      applyBtn = document.getElementById('terminal-apply');
      balanceEl = document.getElementById('balance-value');

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
        if (isOpen) return;
        if (Game.Patients.isPopupOpen()) return;
        if (Game.Shop.isOpen()) return;
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
