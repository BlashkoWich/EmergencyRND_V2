(function() {
  window.Game = window.Game || {};

  var active = false;
  var step = 0;
  var controls;
  var camera, THREE, scene;

  // DOM refs
  var overlayEl, spotlightEl, panelEl, stepNumEl, textEl, nextBtn;

  // 3D arrow
  var arrowGroup = null;
  var arrowTarget = null;
  var arrowTime = 0;

  // Track the tutorial patient (first spawned)
  var tutorialPatient = null;

  // ====== STEP DEFINITIONS ======
  var STEPS = [
    // 0: Welcome
    {
      text: Game.Lang.t('tutorial.step0'),
      trigger: 'next_button',
      allowed: [],
      pauseTime: true,
      position: 'center'
    },
    // 1: Open shift
    {
      text: Game.Lang.t('tutorial.step1'),
      trigger: 'shift_opened',
      allowed: ['movement', 'camera', 'sign_click'],
      pauseTime: true,
      position: 'top-right',
      needsPointerLock: true,
      arrow3D: { x: 2.5, y: 1.2, z: -0.08 }
    },
    // 2: Patient arrives
    {
      text: Game.Lang.t('tutorial.step2'),
      trigger: 'popup_opened',
      allowed: ['movement', 'camera', 'patient_click'],
      pauseTime: true,
      position: 'top-right',
      needsPointerLock: true,
      arrowTrackPatient: true,
      arrowOffsetY: 2.2
    },
    // 3: Explain popup (popup visible)
    {
      text: Game.Lang.t('tutorial.step3'),
      trigger: 'next_button',
      allowed: [],
      pauseTime: true,
      position: 'left',
      spotlight: '#patient-popup',
      onEnter: function() {
        lockPopupButtons();
      }
    },
    // 4: Send to bed
    {
      text: Game.Lang.t('tutorial.step4'),
      trigger: 'patient_sent_to_bed',
      allowed: ['btn_bed'],
      pauseTime: true,
      position: 'left',
      spotlight: '#btn-bed',
      onEnter: function() {
        var btnBed = document.getElementById('btn-bed');
        var btnWait = document.getElementById('btn-wait');
        var btnDismiss = document.getElementById('btn-dismiss');
        if (btnBed) { btnBed.classList.remove('tutorial-locked'); btnBed.disabled = false; btnBed.style.opacity = '1'; }
        if (btnWait) { btnWait.classList.add('tutorial-locked'); }
        if (btnDismiss) { btnDismiss.classList.add('tutorial-locked'); }
      }
    },
    // 5: Open shop
    {
      text: '', // filled in onEnter
      trigger: 'shop_opened',
      allowed: ['movement', 'camera', 'shop_open'],
      pauseTime: true,
      position: 'center',
      needsPointerLock: true,
      onEnter: function() {
        var name = getRequiredConsumableName();
        var colorHex = getRequiredConsumableColor();
        var colorSpan = '<span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:' + colorHex + ';vertical-align:middle;margin-right:6px;"></span>';
        textEl.innerHTML = Game.Lang.t('tutorial.step5html', [colorSpan, name]);
      }
    },
    // 6: Buy the required medication (shop visible)
    {
      text: '', // filled in onEnter
      trigger: 'shop_item_bought',
      allowed: ['shop_buy', 'shop_close'],
      pauseTime: true,
      position: 'left',
      spotlight: '#shop-tab-consumables',
      onEnter: function() {
        var name = getRequiredConsumableName();
        var colorHex = getRequiredConsumableColor();
        var colorSpan = '<span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:' + colorHex + ';vertical-align:middle;margin-right:6px;"></span>';
        textEl.innerHTML = Game.Lang.t('tutorial.step6html', [colorSpan, name]);
        lockShopBuyButtonsExcept(getRequiredConsumableType());
      },
      onExit: function() {
        unlockShopBuyButtons();
      }
    },
    // 7: Close shop
    {
      text: Game.Lang.t('tutorial.step7'),
      trigger: 'shop_closed',
      allowed: ['shop_close'],
      pauseTime: true,
      position: 'left',
      spotlight: '#shop-popup',
      onEnter: function() {
        lockShopBuyButtons();
      },
      onExit: function() {
        unlockShopBuyButtons();
      }
    },
    // 8: Pick up from delivery box
    {
      text: Game.Lang.t('tutorial.step8'),
      trigger: 'item_picked_up',
      allowed: ['movement', 'camera', 'pickup_item'],
      pauseTime: true,
      position: 'top-right',
      needsPointerLock: true,
      arrow3D: { x: -10.5, y: 0.5, z: -10.3 }
    },
    // 9: Apply medication
    {
      text: Game.Lang.t('tutorial.step9'),
      trigger: 'patient_treated',
      allowed: ['movement', 'camera', 'treat_patient'],
      pauseTime: true,
      position: 'top-right',
      needsPointerLock: true,
      arrowTrackPatient: true,
      arrowOffsetY: 1.5
    },
    // 10: Recovery info
    {
      text: Game.Lang.t('tutorial.step10'),
      trigger: 'next_button',
      allowed: [],
      pauseTime: false,
      position: 'center'
    },
    // 11: Go to cashier
    {
      text: Game.Lang.t('tutorial.step11'),
      trigger: 'terminal_opened',
      allowed: ['movement', 'camera', 'cashier_click'],
      pauseTime: false,
      position: 'top-right',
      needsPointerLock: true,
      arrow3D: { x: 3.5, y: 0.5, z: -9.5 }
    },
    // 12: Payment
    {
      text: Game.Lang.t('tutorial.step12'),
      trigger: 'payment_done',
      allowed: ['terminal_keys', 'terminal_ok'],
      pauseTime: false,
      position: 'left',
      spotlight: '#cashier-popup'
    },
    // 13: Dirty bed notice
    {
      text: Game.Lang.t('tutorial.step13'),
      trigger: 'next_button',
      allowed: [],
      pauseTime: true,
      position: 'center'
    },
    // 14: Open shop to buy linen
    {
      text: Game.Lang.t('tutorial.step14'),
      trigger: 'shop_opened',
      allowed: ['movement', 'camera', 'shop_open'],
      pauseTime: true,
      position: 'center',
      needsPointerLock: true
    },
    // 15: Buy linen (shop visible)
    {
      text: '', // filled in onEnter
      trigger: 'shop_item_bought',
      allowed: ['shop_buy', 'shop_close'],
      pauseTime: true,
      position: 'left',
      spotlight: '#shop-tab-consumables',
      onEnter: function() {
        textEl.innerHTML = Game.Lang.t('tutorial.step15html', [Game.Lang.t('item.linen_clean')]);
        lockShopBuyButtonsExcept('linen_clean');
      },
      onExit: function() {
        unlockShopBuyButtons();
      }
    },
    // 16: Close shop
    {
      text: Game.Lang.t('tutorial.step16'),
      trigger: 'shop_closed',
      allowed: ['shop_close'],
      pauseTime: true,
      position: 'left',
      spotlight: '#shop-popup',
      onEnter: function() {
        lockShopBuyButtons();
      },
      onExit: function() {
        unlockShopBuyButtons();
      }
    },
    // 17: Pick up linen from box
    {
      text: Game.Lang.t('tutorial.step17'),
      trigger: 'item_picked_up',
      allowed: ['movement', 'camera', 'pickup_item'],
      pauseTime: true,
      position: 'top-right',
      needsPointerLock: true,
      arrow3D: { x: -10.5, y: 0.5, z: -10.3 }
    },
    // 18: Replace linen on dirty bed
    {
      text: Game.Lang.t('tutorial.step18'),
      trigger: 'linen_replaced',
      allowed: ['movement', 'camera', 'linen_replace'],
      pauseTime: true,
      position: 'top-right',
      needsPointerLock: true,
      arrowTrackBed: true // follows dirty bed
    },
    // 19: Washing intro
    {
      text: Game.Lang.t('tutorial.step19'),
      trigger: 'next_button',
      allowed: [],
      pauseTime: true,
      position: 'center'
    },
    // 20: Load dirty linen into washing machine
    {
      text: Game.Lang.t('tutorial.step20'),
      trigger: 'linen_loaded',
      allowed: ['movement', 'camera', 'washing_machine'],
      pauseTime: true,
      position: 'top-right',
      needsPointerLock: true,
      arrow3D: { x: 5.5, y: 0.8, z: -10.5 }
    },
    // 21: Start wash (press E)
    {
      text: Game.Lang.t('tutorial.step21'),
      trigger: 'wash_started',
      allowed: ['movement', 'camera', 'washing_machine'],
      pauseTime: true,
      position: 'top-right',
      needsPointerLock: true,
      arrow3D: { x: 5.5, y: 0.8, z: -10.5 }
    },
    // 22: Wait for wash to finish
    {
      text: Game.Lang.t('tutorial.step22'),
      trigger: 'wash_finished',
      allowed: ['movement', 'camera'],
      pauseTime: false, // time must pass for wash cycle
      position: 'top-right',
      arrow3D: { x: 5.5, y: 0.8, z: -10.5 }
    },
    // 23: Pick up clean linen
    {
      text: Game.Lang.t('tutorial.step23'),
      trigger: 'item_picked_up',
      allowed: ['movement', 'camera', 'pickup_item'],
      pauseTime: true,
      position: 'top-right',
      needsPointerLock: true,
      arrow3D: { x: 4.2, y: 0.5, z: -10.5 }
    },
    // 24: Done!
    {
      text: Game.Lang.t('tutorial.step24'),
      trigger: 'next_button',
      allowed: [],
      pauseTime: true,
      position: 'center',
      isFinal: true
    }
  ];

  // ====== HELPERS ======
  function getRequiredConsumableType() {
    if (!tutorialPatient) return null;
    return tutorialPatient.requiredConsumable || (tutorialPatient.pendingConsumables && tutorialPatient.pendingConsumables[0]) || null;
  }

  function getRequiredConsumableName() {
    var type = getRequiredConsumableType();
    if (!type) return Game.Lang.t('tutorial.defaultMedicine');
    var info = Game.Consumables.TYPES[type];
    return info ? info.name : Game.Lang.t('tutorial.defaultMedicine');
  }

  function getRequiredConsumableColor() {
    var type = getRequiredConsumableType();
    if (!type) return '#888';
    var info = Game.Consumables.TYPES[type];
    if (!info) return '#888';
    var c = info.color;
    var r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function getDirtyBedPos() {
    // Check tutorial patient's bed first
    if (tutorialPatient && tutorialPatient.destination) {
      var slot = tutorialPatient.destination;
      if (Game.Furniture && Game.Furniture.isBedDirty && Game.Furniture.isBedDirty(slot)) {
        return slot.pos;
      }
    }
    // Search all dirty beds
    if (Game.Furniture && Game.Furniture.getIndoorBeds) {
      var beds = Game.Furniture.getIndoorBeds();
      for (var i = 0; i < beds.length; i++) {
        if (Game.Furniture.isBedDirty(beds[i])) return beds[i].pos;
      }
    }
    return null;
  }

  function lockPopupButtons() {
    var btnBed = document.getElementById('btn-bed');
    var btnWait = document.getElementById('btn-wait');
    var btnDismiss = document.getElementById('btn-dismiss');
    if (btnBed) btnBed.classList.add('tutorial-locked');
    if (btnWait) btnWait.classList.add('tutorial-locked');
    if (btnDismiss) btnDismiss.classList.add('tutorial-locked');
  }

  function unlockPopupButtons() {
    var btnBed = document.getElementById('btn-bed');
    var btnWait = document.getElementById('btn-wait');
    var btnDismiss = document.getElementById('btn-dismiss');
    if (btnBed) btnBed.classList.remove('tutorial-locked');
    if (btnWait) btnWait.classList.remove('tutorial-locked');
    if (btnDismiss) btnDismiss.classList.remove('tutorial-locked');
  }

  function lockShopBuyButtons() {
    var btns = document.querySelectorAll('#shop-popup .shop-buy-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.add('tutorial-locked');
    }
  }

  function unlockShopBuyButtons() {
    var btns = document.querySelectorAll('#shop-popup .shop-buy-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.remove('tutorial-locked');
    }
  }

  function lockShopBuyButtonsExcept(allowedType) {
    var items = document.querySelectorAll('#shop-tab-consumables .shop-item');
    for (var i = 0; i < items.length; i++) {
      var type = items[i].dataset.type;
      var btn = items[i].querySelector('.shop-buy-btn');
      if (!btn) continue;
      if (type === allowedType) {
        btn.classList.remove('tutorial-locked');
      } else {
        btn.classList.add('tutorial-locked');
      }
    }
    var otherBtns = document.querySelectorAll('#shop-tab-instruments .shop-buy-btn, #shop-tab-furniture .shop-buy-btn, #shop-tab-upgrades .shop-buy-btn, .staff-hire-btn');
    for (var j = 0; j < otherBtns.length; j++) {
      otherBtns[j].classList.add('tutorial-locked');
    }
    var tabs = document.querySelectorAll('#shop-tabs .shop-tab');
    for (var k = 0; k < tabs.length; k++) {
      if (tabs[k].dataset.tab !== 'consumables') {
        tabs[k].classList.add('tutorial-locked');
      }
    }
  }

  // ====== 3D ARROW ======
  function createArrow() {
    if (arrowGroup) return;
    arrowGroup = new THREE.Group();

    var bodyGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8);
    var bodyMat = new THREE.MeshBasicMaterial({ color: 0x44bbff, transparent: true, opacity: 0.9 });
    var body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.35;
    arrowGroup.add(body);

    var headGeo = new THREE.ConeGeometry(0.15, 0.3, 8);
    var headMat = new THREE.MeshBasicMaterial({ color: 0x44bbff, transparent: true, opacity: 0.9 });
    var head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0;
    head.rotation.x = Math.PI;
    arrowGroup.add(head);

    var ringGeo = new THREE.RingGeometry(0.2, 0.35, 16);
    var ringMat = new THREE.MeshBasicMaterial({ color: 0x44bbff, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    var ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.05;
    arrowGroup.add(ring);

    arrowGroup.visible = false;
    scene.add(arrowGroup);
  }

  function showArrowAt(worldPos, offsetY) {
    if (!arrowGroup) createArrow();
    var oY = (offsetY !== undefined) ? offsetY : 1.0;
    arrowTarget = { x: worldPos.x, y: worldPos.y, z: worldPos.z, _offsetY: oY };
    arrowGroup.position.set(worldPos.x, worldPos.y + oY, worldPos.z);
    arrowGroup.visible = true;
  }

  function hideArrow() {
    if (arrowGroup) arrowGroup.visible = false;
    arrowTarget = null;
  }

  function updateArrowAnimation(delta) {
    if (!arrowGroup || !arrowGroup.visible || !arrowTarget) return;
    arrowTime += delta;
    var oY = arrowTarget._offsetY || 1.0;
    arrowGroup.position.y = arrowTarget.y + oY + Math.sin(arrowTime * 3) * 0.12;
    arrowGroup.rotation.y += delta * 1.5;
  }

  // ====== STEP MANAGEMENT ======
  function goToStep(idx) {
    if (step < STEPS.length && STEPS[step].onExit) {
      STEPS[step].onExit();
    }

    step = idx;

    if (step >= STEPS.length) {
      finish();
      return;
    }

    var s = STEPS[step];

    stepNumEl.textContent = Game.Lang.t('tutorial.stepOf', [step + 1, STEPS.length]);
    if (s.text) {
      textEl.textContent = s.text;
    }

    if (s.trigger === 'next_button') {
      nextBtn.style.display = 'block';
      nextBtn.textContent = s.isFinal ? Game.Lang.t('tutorial.start') : Game.Lang.t('tutorial.next');
    } else {
      nextBtn.style.display = 'none';
    }

    positionPanel(s.position);

    if (s.spotlight) {
      var target = document.querySelector(s.spotlight);
      if (target) {
        positionSpotlight(target);
        spotlightEl.style.display = 'block';
      } else {
        spotlightEl.style.display = 'none';
      }
      overlayEl.style.background = 'none';
      overlayEl.style.pointerEvents = 'none';
    } else if (s.trigger === 'next_button') {
      spotlightEl.style.display = 'none';
      overlayEl.style.background = 'rgba(0, 0, 0, 0.55)';
      overlayEl.style.pointerEvents = 'auto';
    } else {
      spotlightEl.style.display = 'none';
      overlayEl.style.background = 'none';
      overlayEl.style.pointerEvents = 'none';
    }

    // 3D Arrow
    if (s.arrow3D) {
      showArrowAt(new THREE.Vector3(s.arrow3D.x, s.arrow3D.y, s.arrow3D.z));
    } else if (s.arrowTrackPatient && tutorialPatient && tutorialPatient.mesh) {
      var oY = s.arrowOffsetY || 1.0;
      showArrowAt(tutorialPatient.mesh.position, oY);
    } else if (s.arrowTrackBed) {
      var bedPos = getDirtyBedPos();
      if (bedPos) {
        showArrowAt(bedPos, 1.2);
      }
    } else {
      hideArrow();
    }

    overlayEl.style.display = 'block';

    if (s.trigger === 'next_button') {
      // Always ensure pointer is free for clicking UI buttons
      controls.unlock();
      document.exitPointerLock();
    }
    if (s.trigger !== 'next_button' && s.needsPointerLock && !controls.isLocked) {
      controls.lock();
    }

    if (s.onEnter) s.onEnter();
  }

  function positionPanel(pos) {
    panelEl.style.top = '';
    panelEl.style.bottom = '';
    panelEl.style.left = '';
    panelEl.style.right = '';
    panelEl.style.transform = '';

    switch (pos) {
      case 'center':
        panelEl.style.top = '50%';
        panelEl.style.left = '50%';
        panelEl.style.transform = 'translate(-50%, -50%)';
        break;
      case 'left':
        panelEl.style.top = '50%';
        panelEl.style.left = '24px';
        panelEl.style.transform = 'translateY(-50%)';
        break;
      case 'right':
        panelEl.style.top = '50%';
        panelEl.style.right = '24px';
        panelEl.style.transform = 'translateY(-50%)';
        break;
      case 'top-right':
        panelEl.style.top = '80px';
        panelEl.style.right = '24px';
        break;
      case 'top-left':
        panelEl.style.top = '80px';
        panelEl.style.left = '24px';
        break;
      default:
        panelEl.style.top = '50%';
        panelEl.style.left = '50%';
        panelEl.style.transform = 'translate(-50%, -50%)';
    }
  }

  function positionSpotlight(target) {
    var rect = target.getBoundingClientRect();
    var pad = 12;
    spotlightEl.style.top = (rect.top - pad) + 'px';
    spotlightEl.style.left = (rect.left - pad) + 'px';
    spotlightEl.style.width = (rect.width + pad * 2) + 'px';
    spotlightEl.style.height = (rect.height + pad * 2) + 'px';
  }

  function finish() {
    active = false;
    overlayEl.style.display = 'none';
    spotlightEl.style.display = 'none';
    hideArrow();
    unlockPopupButtons();
    unlockShopBuyButtons();
    var tabs = document.querySelectorAll('#shop-tabs .shop-tab');
    for (var k = 0; k < tabs.length; k++) {
      tabs[k].classList.remove('tutorial-locked');
    }

    if (controls && !controls.isLocked) {
      controls.lock();
    }

    // Check for any deferred level-ups now that tutorial overlay is gone
    if (Game.Levels && Game.Levels.checkDeferredLevelUp) {
      Game.Levels.checkDeferredLevelUp();
    }

    // Spawn first patient after tutorial ends
    if (Game.Patients && Game.Patients.spawnFirstPatient) {
      Game.Patients.spawnFirstPatient();
    }
  }

  // ====== PUBLIC API ======
  window.Game.Tutorial = {
    setup: function(_controls, _THREE, _camera, _scene) {
      controls = _controls;
      THREE = _THREE;
      camera = _camera;
      scene = _scene;

      overlayEl = document.getElementById('tutorial-overlay');
      spotlightEl = document.getElementById('tutorial-spotlight');
      panelEl = document.getElementById('tutorial-panel');
      stepNumEl = document.getElementById('tutorial-step-num');
      textEl = document.getElementById('tutorial-text');
      nextBtn = document.getElementById('tutorial-next');

      if (nextBtn) {
        nextBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          if (!active) return;
          var s = STEPS[step];
          if (s.trigger === 'next_button') {
            if (s.isFinal) {
              goToStep(STEPS.length);
            } else {
              goToStep(step + 1);
            }
          }
        });
      }
    },

    checkStart: function() {
      if (active) return;
      var level = Game.Levels ? Game.Levels.getLevel() : 1;
      if (level !== 1) return;


      active = true;
      step = 0;

      var started = false;
      var onLock = function() {
        if (started) return;
        started = true;
        controls.removeEventListener('lock', onLock);
        setTimeout(function() {
          goToStep(0);
        }, 300);
      };
      controls.addEventListener('lock', onLock);
    },

    isActive: function() { return active; },

    isPaused: function() {
      if (!active) return false;
      if (step >= STEPS.length) return false;
      return !!STEPS[step].pauseTime;
    },

    isAllowed: function(actionId) {
      if (!active) return true;
      if (step >= STEPS.length) return true;
      var s = STEPS[step];
      if (actionId === 'movement' || actionId === 'camera') {
        return s.allowed.indexOf('movement') !== -1 || s.allowed.indexOf('camera') !== -1;
      }
      return s.allowed.indexOf(actionId) !== -1;
    },

    onEvent: function(eventName, data) {
      if (!active) return;
      if (step >= STEPS.length) return;
      var s = STEPS[step];

      // Validate correct medication on shelf take
      if (s.trigger === 'correct_item_taken' && eventName === 'item_taken_from_shelf') {
        var requiredType = getRequiredConsumableType();
        if (data === requiredType) {
          goToStep(step + 1);
        } else {
          var correctName = getRequiredConsumableName();
          Game.Inventory.showNotification(Game.Lang.t('notify.wrongItem', [correctName]), 'rgba(200, 50, 50, 0.85)');
        }
        return;
      }

      // Validate correct item bought in shop
      if (s.trigger === 'shop_item_bought' && eventName === 'shop_item_bought') {
        // Step 6: require the medication type
        // Step 15: require linen_clean
        var requiredType = getRequiredConsumableType();
        // Detect if this is the linen step by checking step index
        if (step === 15) {
          // Linen step
          if (data === 'linen_clean') {
            goToStep(step + 1);
          }
        } else {
          if (data === requiredType) {
            goToStep(step + 1);
          }
        }
        return;
      }

      // Item picked up from box
      if (s.trigger === 'item_picked_up' && eventName === 'item_picked_up') {
        goToStep(step + 1);
        return;
      }

      // Linen replaced
      if (s.trigger === 'linen_replaced' && eventName === 'linen_replaced') {
        goToStep(step + 1);
        return;
      }

      if (s.trigger === eventName) {
        goToStep(step + 1);
      }
    },

    setTutorialPatient: function(patient) {
      tutorialPatient = patient;
    },

    getTutorialPatient: function() {
      return tutorialPatient;
    },

    update: function(delta) {
      if (!active) return;
      if (step >= STEPS.length) return;

      var s = STEPS[step];
      if (s.arrowTrackPatient && tutorialPatient && tutorialPatient.mesh && arrowGroup && arrowGroup.visible) {
        var oY = s.arrowOffsetY || 1.0;
        arrowTarget = { x: tutorialPatient.mesh.position.x, y: tutorialPatient.mesh.position.y, z: tutorialPatient.mesh.position.z, _offsetY: oY };
        arrowGroup.position.x = arrowTarget.x;
        arrowGroup.position.z = arrowTarget.z;
      }

      if (s.arrowTrackBed && arrowGroup && arrowGroup.visible) {
        var bedPos = getDirtyBedPos();
        if (bedPos) {
          arrowTarget = { x: bedPos.x, y: bedPos.y, z: bedPos.z, _offsetY: 1.2 };
          arrowGroup.position.x = bedPos.x;
          arrowGroup.position.z = bedPos.z;
        }
      }

      updateArrowAnimation(delta);
    },

    updateSpotlight: function() {
      if (!active || step >= STEPS.length) return;
      var s = STEPS[step];
      if (s.spotlight) {
        var target = document.querySelector(s.spotlight);
        if (target && target.style.display !== 'none') {
          positionSpotlight(target);
        }
      }
    }
  };
})();
