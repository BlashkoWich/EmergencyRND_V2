(function() {
  window.Game = window.Game || {};

  var THREE, scene, camera, controls, collidables;
  var interactRay, screenCenter;
  var hintEl;

  var machineGroup;
  var machineCollision;
  var isHovered = false;

  var dirtyLinenCount = 0;
  var isWashing = false;
  var washTimer = 0;
  var WASH_DURATION = 20;
  var MAX_LOAD = 5;

  // Machine position
  var MACHINE_X = 5.5;
  var MACHINE_Z = -10.5;

  // Visual elements
  var drumMesh;
  var statusLight;
  var progressBg, progressFill;

  function createMachine() {
    machineGroup = new THREE.Group();

    // Main body — white box
    var bodyMat = new THREE.MeshLambertMaterial({ color: 0xdddddd });
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 0.7), bodyMat);
    body.position.y = 0.5;
    body.castShadow = true;
    machineGroup.add(body);

    // Top panel — slightly darker
    var topMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
    var top = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.7), topMat);
    top.position.y = 1.03;
    top.castShadow = true;
    machineGroup.add(top);

    // Door — dark circle on front face
    var doorMat = new THREE.MeshLambertMaterial({ color: 0x333344 });
    var doorGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.02, 24);
    drumMesh = new THREE.Mesh(doorGeo, doorMat);
    drumMesh.rotation.x = Math.PI / 2;
    drumMesh.position.set(0, 0.45, 0.36);
    machineGroup.add(drumMesh);

    // Door rim
    var rimMat = new THREE.MeshLambertMaterial({ color: 0x999999 });
    var rimGeo = new THREE.TorusGeometry(0.23, 0.02, 8, 24);
    var rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, 0.45, 0.36);
    machineGroup.add(rim);

    // Control panel area (above door)
    var panelMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
    var panel = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.02), panelMat);
    panel.position.set(0, 0.85, 0.36);
    machineGroup.add(panel);

    // Status light
    var lightMat = new THREE.MeshLambertMaterial({ color: 0x44cc44, emissive: 0x44cc44, emissiveIntensity: 0.5 });
    statusLight = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), lightMat);
    statusLight.position.set(0.2, 0.85, 0.37);
    machineGroup.add(statusLight);

    // Progress bar background (only visible during wash)
    var progBgMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    progressBg = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.02), progBgMat);
    progressBg.position.set(0, 1.15, 0.36);
    progressBg.visible = false;
    machineGroup.add(progressBg);

    // Progress bar fill
    var progFillMat = new THREE.MeshLambertMaterial({ color: 0x44cc44, emissive: 0x228822, emissiveIntensity: 0.3 });
    progressFill = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.04, 0.025), progFillMat);
    progressFill.position.set(0, 1.15, 0.365);
    progressFill.visible = false;
    machineGroup.add(progressFill);

    machineGroup.position.set(MACHINE_X, 0, MACHINE_Z);
    scene.add(machineGroup);

    // Collision box
    machineCollision = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 1.1, 0.8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    machineCollision.position.set(MACHINE_X, 0.55, MACHINE_Z);
    scene.add(machineCollision);
    collidables.push(machineCollision);

    // Sign on wall
    Game.Helpers.createSign(THREE, scene, '\u0421\u0422\u0418\u0420\u041A\u0410', MACHINE_X, 2.5, -11.78, 0);
  }

  function highlightMachine() {
    Game.Outline.setHover([machineGroup]);
  }

  function unhighlightMachine() {
    Game.Outline.clearHover();
  }

  function setStatusColor(color, intensity) {
    statusLight.material.color.setHex(color);
    statusLight.material.emissive.setHex(color);
    statusLight.material.emissiveIntensity = intensity || 0.5;
  }

  function updateInteraction() {
    if (!controls.isLocked || Game.Patients.isPopupOpen() || Game.Shop.isOpen()) {
      if (isHovered) { unhighlightMachine(); isHovered = false; }
      return;
    }
    if (Game.Furniture.isCarrying()) {
      if (isHovered) { unhighlightMachine(); isHovered = false; }
      return;
    }
    if (Game.Diagnostics && Game.Diagnostics.isActive()) {
      if (isHovered) { unhighlightMachine(); isHovered = false; }
      return;
    }
    if (Game.Cashier && Game.Cashier.isPopupOpen()) {
      if (isHovered) { unhighlightMachine(); isHovered = false; }
      return;
    }
    if (!Game.Interaction.isActive('washingMachine')) {
      if (isHovered) { unhighlightMachine(); isHovered = false; }
      return;
    }

    var hits = Game.Interaction.getHits('washingMachine');
    var nowHovered = hits !== null;

    if (nowHovered !== isHovered) {
      if (nowHovered) highlightMachine();
      else unhighlightMachine();
      isHovered = nowHovered;
    }

    if (isHovered) {
      var hasDirtyInInventory = Game.Inventory.countType('linen_dirty') > 0;

      if (isWashing) {
        var remaining = Math.ceil(WASH_DURATION - washTimer);
        hintEl.textContent = 'Стирка... ' + remaining + ' сек.';
      } else if (dirtyLinenCount === 0 && !hasDirtyInInventory) {
        hintEl.textContent = 'Загрузите грязное бельё (ЛКМ)';
      } else if (hasDirtyInInventory && dirtyLinenCount < MAX_LOAD && dirtyLinenCount > 0) {
        hintEl.textContent = 'ЛКМ — Загрузить бельё (' + dirtyLinenCount + '/' + MAX_LOAD + ')  |  E — Запустить стирку';
      } else if (hasDirtyInInventory && dirtyLinenCount < MAX_LOAD) {
        hintEl.textContent = 'ЛКМ — Загрузить бельё (' + dirtyLinenCount + '/' + MAX_LOAD + ')';
      } else if (hasDirtyInInventory && dirtyLinenCount >= MAX_LOAD && dirtyLinenCount > 0) {
        hintEl.textContent = 'Машинка полная (' + MAX_LOAD + '/' + MAX_LOAD + ')  |  E — Запустить стирку';
      } else if (dirtyLinenCount > 0) {
        hintEl.textContent = 'E — Запустить стирку (' + dirtyLinenCount + ' шт.)';
      }
      hintEl.style.display = 'block';
    }
  }

  function startWash() {
    isWashing = true;
    washTimer = 0;
    setStatusColor(0xcccc00, 0.6);
    progressBg.visible = true;
    progressFill.visible = true;
    progressFill.scale.x = 0.01;
    Game.Inventory.showNotification('Стирка запущена! (' + dirtyLinenCount + ' шт.)', 'rgba(34, 139, 34, 0.85)');
    if (Game.Tutorial && Game.Tutorial.isActive()) Game.Tutorial.onEvent('wash_started');
  }

  function finishWash() {
    var count = dirtyLinenCount;
    isWashing = false;
    dirtyLinenCount = 0;
    setStatusColor(0x44cc44, 0.5);
    progressBg.visible = false;
    progressFill.visible = false;

    // Add clean linen to clean basket
    Game.Staff.addToBasket('clean', 'linen_clean', count);

    Game.Inventory.showNotification('Стирка завершена! Заберите бельё.', 'rgba(34, 139, 34, 0.85)');
    if (Game.Tutorial && Game.Tutorial.isActive()) Game.Tutorial.onEvent('wash_finished');
  }

  function updateWashCycle(delta) {
    if (!isWashing) return;
    washTimer += delta;

    // Animate drum rotation
    drumMesh.rotation.z += delta * 4;

    // Update progress bar
    var progress = Math.min(1, washTimer / WASH_DURATION);
    progressFill.scale.x = Math.max(0.01, progress);
    progressFill.position.x = -(0.34 * (1 - progress));

    if (washTimer >= WASH_DURATION) {
      finishWash();
    }
  }

  // --- Event handlers ---

  function onMouseDown(e) {
    if (e.button !== 0 || !controls.isLocked) return;
    if (Game.Furniture.isCarrying()) return;
    if (!isHovered || isWashing) return;
    if (Game.Patients.isPopupOpen() || Game.Shop.isOpen()) return;
    if (Game.Cashier && Game.Cashier.isPopupOpen()) return;
    if (Game.Diagnostics && Game.Diagnostics.isActive()) return;
    if (Game.Tutorial && Game.Tutorial.isActive() && !Game.Tutorial.isAllowed('washing_machine')) return;

    if (!Game.Inventory.findAndActivate('linen_dirty')) return;

    if (dirtyLinenCount >= MAX_LOAD) {
      Game.Inventory.showNotification('Машинка полная (' + MAX_LOAD + '/' + MAX_LOAD + ')');
      return;
    }

    Game.Inventory.removeActive();
    dirtyLinenCount++;
    if (Game.Tutorial && Game.Tutorial.isActive()) Game.Tutorial.onEvent('linen_loaded');
    setStatusColor(0xcc8844, 0.5);
    Game.Inventory.showNotification('Загружено бельё (' + dirtyLinenCount + '/' + MAX_LOAD + ')', 'rgba(34, 139, 34, 0.85)');
  }

  function onKeyDown(e) {
    if (e.code !== 'KeyE') return;
    if (!controls.isLocked || !isHovered) return;
    if (Game.Furniture.isCarrying()) return;
    if (Game.Patients.isPopupOpen() || Game.Shop.isOpen()) return;
    if (Game.Cashier && Game.Cashier.isPopupOpen()) return;
    if (Game.Diagnostics && Game.Diagnostics.isActive()) return;
    if (Game.Tutorial && Game.Tutorial.isActive() && !Game.Tutorial.isAllowed('washing_machine')) return;

    if (isWashing) return;
    if (dirtyLinenCount <= 0) {
      Game.Inventory.showNotification('Сначала загрузите грязное бельё');
      return;
    }

    startWash();
  }

  // --- Public API ---

  window.Game.WashingMachine = {
    setup: function(_THREE, _scene, _camera, _controls, _collidables) {
      THREE = _THREE;
      scene = _scene;
      camera = _camera;
      controls = _controls;
      collidables = _collidables;

      interactRay = new THREE.Raycaster();
      interactRay.far = 5;
      screenCenter = new THREE.Vector2(0, 0);
      hintEl = document.getElementById('interact-hint');

      createMachine();

      document.addEventListener('mousedown', onMouseDown);
      document.addEventListener('keydown', onKeyDown);

      // Register with central interaction system
      Game.Interaction.register('washingMachine', function() {
        return machineGroup ? [machineGroup] : [];
      }, true, 5);

      // Register as draggable fixture
      Game.Furniture.registerFixture({
        type: 'washingMachine',
        group: machineGroup,
        collisionBox: machineCollision,
        canPickUp: function() { return !isWashing; },
        onMoved: function(pos) {
          MACHINE_X = pos.x;
          MACHINE_Z = pos.z;
        }
      });
    },

    update: function(delta) {
      updateInteraction();
      updateWashCycle(delta);
    },

    hasInteraction: function() { return isHovered; },
    isWashing: function() { return isWashing; },
    getLoadedCount: function() { return dirtyLinenCount; },

    // Staff APIs
    canLoad: function() { return !isWashing && dirtyLinenCount < MAX_LOAD; },
    loadOne: function() {
      if (isWashing || dirtyLinenCount >= MAX_LOAD) return false;
      dirtyLinenCount++;
      setStatusColor(0xcc8844, 0.5);
      return true;
    },
    isFull: function() { return dirtyLinenCount >= MAX_LOAD; },
    startWashAuto: function() {
      if (isWashing || dirtyLinenCount <= 0) return false;
      startWash();
      return true;
    }
  };
})();
