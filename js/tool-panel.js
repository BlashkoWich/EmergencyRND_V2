(function() {
  window.Game = window.Game || {};

  var PANEL_X = -3.0;
  var PANEL_Z = -11.85;
  var PANEL_Y_BOTTOM = 0.5;
  var PANEL_WIDTH = 1.0;
  var PANEL_HEIGHT = 1.2;
  var PANEL_DEPTH = 0.06;
  var INSTRUMENT_PANEL_SCALE = 2.5;

  var SLOT_DEFS = [
    { type: 'instrument_stethoscope', label: Game.Lang.t('item.instrument_stethoscope'), yOffset: 0.25 },
    { type: 'instrument_hammer',      label: Game.Lang.t('item.instrument_hammer'),      yOffset: 0.60 },
    { type: 'instrument_rhinoscope',  label: Game.Lang.t('item.instrument_rhinoscope'),  yOffset: 0.95 }
  ];

  var THREE, scene, camera, controls;
  var panelGroup = null;
  var panelCollisionBox = null;
  var slots = [];
  var hoveredSlot = null;
  var panelMode = null; // 'place' or 'take'
  var interactRay, screenCenter;
  var hintEl;
  var allPanelParts = [];
  var allPanelItemMeshes = [];

  function createPanel(collidables) {
    panelGroup = new THREE.Group();

    var boardMat = new THREE.MeshLambertMaterial({ color: 0x6B5B4F });
    var frameMat = new THREE.MeshLambertMaterial({ color: 0x4A3B30 });
    var hookMat = new THREE.MeshLambertMaterial({ color: 0x888899 });

    // Pegboard backing
    var board = new THREE.Mesh(new THREE.BoxGeometry(PANEL_WIDTH, PANEL_HEIGHT, PANEL_DEPTH), boardMat);
    board.position.set(0, PANEL_HEIGHT / 2, 0);
    board.castShadow = true;
    panelGroup.add(board);

    // Frame border (4 planks)
    var frameThick = 0.04;
    // Top
    var frameTop = new THREE.Mesh(new THREE.BoxGeometry(PANEL_WIDTH + frameThick * 2, frameThick, PANEL_DEPTH + 0.02), frameMat);
    frameTop.position.set(0, PANEL_HEIGHT + frameThick / 2, 0);
    frameTop.castShadow = true;
    panelGroup.add(frameTop);
    // Bottom
    var frameBot = new THREE.Mesh(new THREE.BoxGeometry(PANEL_WIDTH + frameThick * 2, frameThick, PANEL_DEPTH + 0.02), frameMat);
    frameBot.position.set(0, -frameThick / 2, 0);
    frameBot.castShadow = true;
    panelGroup.add(frameBot);
    // Left
    var frameL = new THREE.Mesh(new THREE.BoxGeometry(frameThick, PANEL_HEIGHT + frameThick * 2, PANEL_DEPTH + 0.02), frameMat);
    frameL.position.set(-PANEL_WIDTH / 2 - frameThick / 2, PANEL_HEIGHT / 2, 0);
    frameL.castShadow = true;
    panelGroup.add(frameL);
    // Right
    var frameR = new THREE.Mesh(new THREE.BoxGeometry(frameThick, PANEL_HEIGHT + frameThick * 2, PANEL_DEPTH + 0.02), frameMat);
    frameR.position.set(PANEL_WIDTH / 2 + frameThick / 2, PANEL_HEIGHT / 2, 0);
    frameR.castShadow = true;
    panelGroup.add(frameR);

    // Create hooks and label plates for each slot
    for (var i = 0; i < SLOT_DEFS.length; i++) {
      var def = SLOT_DEFS[i];
      var hookY = def.yOffset;

      // Hook peg (cylinder protruding forward)
      var hook = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8), hookMat);
      hook.rotation.x = Math.PI / 2;
      hook.position.set(0, hookY, PANEL_DEPTH / 2 + 0.06);
      hook.castShadow = true;
      panelGroup.add(hook);

      // Hook tip (small sphere)
      var hookTip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), hookMat);
      hookTip.position.set(0, hookY, PANEL_DEPTH / 2 + 0.12);
      panelGroup.add(hookTip);

      // Label plate under the hook
      var labelCanvas = document.createElement('canvas');
      labelCanvas.width = 256;
      labelCanvas.height = 64;
      var ctx = labelCanvas.getContext('2d');
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(0, 0, 256, 64);
      ctx.strokeStyle = '#4A3B30';
      ctx.lineWidth = 3;
      ctx.strokeRect(1, 1, 254, 62);
      ctx.fillStyle = '#333';
      ctx.font = 'bold 28px Segoe UI, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.label, 128, 32);

      var labelTex = new THREE.CanvasTexture(labelCanvas);
      labelTex.minFilter = THREE.LinearFilter;
      var labelMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.4, 0.1),
        new THREE.MeshLambertMaterial({ map: labelTex })
      );
      labelMesh.position.set(0, hookY - 0.12, PANEL_DEPTH / 2 + 0.005);
      panelGroup.add(labelMesh);

      // Slot world position (where instrument will hang)
      var worldPos = new THREE.Vector3(PANEL_X, PANEL_Y_BOTTOM + hookY, PANEL_Z + PANEL_DEPTH / 2 + 0.08);

      slots.push({
        type: def.type,
        pos: worldPos,
        item: null,
        itemMesh: null,
        hookMesh: hook
      });
    }

    panelGroup.position.set(PANEL_X, PANEL_Y_BOTTOM, PANEL_Z);
    scene.add(panelGroup);

    // Register all panel meshes for raycasting
    panelGroup.traverse(function(child) {
      if (child.isMesh) {
        child.userData.isToolPanel = true;
        allPanelParts.push(child);
      }
    });

    // Collision box
    panelCollisionBox = new THREE.Mesh(
      new THREE.BoxGeometry(PANEL_WIDTH + 0.1, PANEL_HEIGHT + 0.1, 0.3),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    panelCollisionBox.position.set(PANEL_X, PANEL_Y_BOTTOM + PANEL_HEIGHT / 2, PANEL_Z);
    scene.add(panelCollisionBox);
    collidables.push(panelCollisionBox);

    // Wall sign
    Game.Helpers.createSign(THREE, scene, Game.Lang.t('sign.instruments'), PANEL_X, PANEL_Y_BOTTOM + PANEL_HEIGHT + 0.25, -11.78, 0);
  }

  function highlightSlotItem(slot) {
    if (!slot || !slot.itemMesh) return;
    Game.Outline.setHover([slot.itemMesh]);
  }

  function unhighlightSlotItem(slot) {
    if (!slot || !slot.itemMesh) return;
    Game.Outline.clearHover();
  }

  function highlightPanel() {
    Game.Outline.setHover([panelGroup]);
  }

  function unhighlightPanel() {
    Game.Outline.clearHover();
  }

  function findSlotForType(type) {
    for (var i = 0; i < slots.length; i++) {
      if (slots[i].type === type) return slots[i];
    }
    return null;
  }

  function getSlotFromItemMesh(hitObject) {
    for (var i = 0; i < slots.length; i++) {
      if (!slots[i].itemMesh) continue;
      var current = hitObject;
      while (current) {
        if (current === slots[i].itemMesh) return slots[i];
        current = current.parent;
      }
    }
    return null;
  }

  function registerItemMeshes(mesh) {
    mesh.traverse(function(child) {
      if (child.isMesh) allPanelItemMeshes.push(child);
    });
  }

  function unregisterItemMeshes(mesh) {
    mesh.traverse(function(child) {
      if (child.isMesh) {
        var idx = allPanelItemMeshes.indexOf(child);
        if (idx !== -1) allPanelItemMeshes.splice(idx, 1);
      }
    });
  }

  function placeItemOnSlot(slot) {
    if (slot.item) return false; // already occupied
    var mesh = Game.Consumables.createMesh(slot.type);
    mesh.scale.set(INSTRUMENT_PANEL_SCALE, INSTRUMENT_PANEL_SCALE, INSTRUMENT_PANEL_SCALE);
    mesh.position.copy(slot.pos);
    // Slight tilt to look like hanging
    mesh.rotation.z = 0.15;
    scene.add(mesh);
    slot.item = slot.type;
    slot.itemMesh = mesh;
    registerItemMeshes(mesh);
    return true;
  }

  function takeItemFromSlot(slot) {
    if (!slot || !slot.item) return null;
    var type = slot.item;
    unregisterItemMeshes(slot.itemMesh);
    scene.remove(slot.itemMesh);
    slot.item = null;
    slot.itemMesh = null;
    return type;
  }

  function updateInteraction() {
    if (!controls.isLocked || Game.Patients.isPopupOpen() || Game.Shop.isOpen()) {
      clearInteraction();
      return false;
    }
    if (Game.Furniture.isCarrying()) {
      clearInteraction();
      return false;
    }
    if (Game.Consumables.isHoldingBox()) {
      clearInteraction();
      return false;
    }
    if (!Game.Interaction.isActive('toolPanelItems') && !Game.Interaction.isActive('toolPanelPlace')) {
      clearInteraction();
      return false;
    }

    var activeItem = Game.Inventory.getActive();

    var newHoveredSlot = null;
    var newMode = null;

    // Try take mode: use cached hits from toolPanelItems
    if (!Game.Inventory.isFull()) {
      var itemHits = Game.Interaction.getHits('toolPanelItems');
      if (itemHits) {
        var result = getSlotFromItemMesh(itemHits[0].object);
        if (result && result.item) {
          newHoveredSlot = result;
          newMode = 'take';
        }
      }
    }

    // Place mode: use cached hits from toolPanelPlace
    if (!newHoveredSlot && activeItem && Game.Consumables.isInstrument(activeItem)) {
      var placeHits = Game.Interaction.getHits('toolPanelPlace');
      if (placeHits) {
        var targetSlot = findSlotForType(activeItem);
        if (targetSlot && !targetSlot.item) {
          newHoveredSlot = targetSlot;
          newMode = 'place';
        }
      }
    }

    // Update highlights
    if (newHoveredSlot !== hoveredSlot || newMode !== panelMode) {
      if (hoveredSlot && panelMode === 'take') unhighlightSlotItem(hoveredSlot);
      if (panelMode === 'place') unhighlightPanel();
      if (newHoveredSlot && newMode === 'take') highlightSlotItem(newHoveredSlot);
      if (newMode === 'place') highlightPanel();
    }
    hoveredSlot = newHoveredSlot;
    panelMode = newMode;

    if (hoveredSlot) {
      var hints = [];
      if (panelMode === 'take') {
        var info = Game.Consumables.INSTRUMENT_TYPES[hoveredSlot.type];
        hints.push(Game.Lang.t('panel.hint.take', [info.name]));
      }
      if (panelMode === 'place') {
        hints.push(Game.Lang.t('panel.hint.hang'));
      }
      if (hints.length > 0) {
        hintEl.textContent = hints.join('  |  ');
        hintEl.style.display = 'block';
        return true;
      }
    }
    return false;
  }

  function clearInteraction() {
    if (hoveredSlot && panelMode === 'take') unhighlightSlotItem(hoveredSlot);
    if (panelMode === 'place') unhighlightPanel();
    hoveredSlot = null;
    panelMode = null;
  }

  window.Game.ToolPanel = {
    hasInteraction: function() { return !!hoveredSlot; },

    findSlot: function(type) {
      for (var i = 0; i < slots.length; i++) {
        if (slots[i].type === type && slots[i].item) return slots[i];
      }
      return null;
    },

    takeFromSlot: function(slot) {
      return takeItemFromSlot(slot);
    },

    placeItem: function(type) {
      var slot = findSlotForType(type);
      if (!slot || slot.item) return false;
      return placeItemOnSlot(slot);
    },

    getPosition: function() {
      return { x: PANEL_X, z: PANEL_Z };
    },

    getSlots: function() { return slots; },

    setup: function(_THREE, _scene, _camera, _controls, collidables) {
      THREE = _THREE;
      scene = _scene;
      camera = _camera;
      controls = _controls;

      interactRay = new THREE.Raycaster();
      interactRay.far = 5;
      screenCenter = new THREE.Vector2(0, 0);
      hintEl = document.getElementById('interact-hint');

      createPanel(collidables);

      // Panel starts empty — instruments are purchased from the shop

      // Register as draggable fixture
      Game.Furniture.registerFixture({
        type: 'toolPanel',
        group: panelGroup,
        collisionBox: panelCollisionBox,
        onMoved: function(pos, rotY) {
          PANEL_X = pos.x;
          PANEL_Z = pos.z;
          panelGroup.updateMatrixWorld(true);
          // Recompute slot world positions
          for (var si = 0; si < SLOT_DEFS.length; si++) {
            var def = SLOT_DEFS[si];
            var localPos = new THREE.Vector3(0, def.yOffset, PANEL_DEPTH / 2 + 0.08);
            var worldPos = localPos.clone();
            panelGroup.localToWorld(worldPos);
            slots[si].pos.copy(worldPos);
            // Reposition item mesh
            if (slots[si].itemMesh) {
              slots[si].itemMesh.position.copy(worldPos);
              slots[si].itemMesh.rotation.z = 0.15;
            }
          }
        }
      });

      // Take instrument from panel on LMB
      document.addEventListener('mousedown', function(e) {
        if (e.button !== 0 || !controls.isLocked) return;
        if (Game.Furniture.isCarrying()) return;
        if (Game.Patients.isPopupOpen() || Game.Shop.isOpen()) return;
        if (Game.Patients.hasInteraction() || Game.Consumables.hasInteraction() || Game.Consumables.hasBoxInteraction()) return;
        if (Game.Consumables.isHoldingBox()) return;
        if (!hoveredSlot || panelMode !== 'take') return;

        if (Game.Inventory.addItem(hoveredSlot.item)) {
          takeItemFromSlot(hoveredSlot);
          hoveredSlot = null;
          panelMode = null;
        } else {
          Game.Inventory.showNotification(Game.Lang.t('notify.inventoryFull'));
        }
      });

      // Place instrument on panel on E
      document.addEventListener('keydown', function(e) {
        if (e.code !== 'KeyE' || !controls.isLocked) return;
        if (Game.Furniture.isCarrying()) return;
        if (Game.Patients.isPopupOpen() || Game.Shop.isOpen()) return;
        if (Game.Patients.hasInteraction() || Game.Consumables.hasInteraction() || Game.Consumables.hasBoxInteraction()) return;
        if (Game.Consumables.isHoldingBox()) return;
        if (!hoveredSlot || panelMode !== 'place') return;

        var type = Game.Inventory.getActive();
        if (!type || !Game.Consumables.isInstrument(type)) return;
        if (hoveredSlot.type !== type) return;
        Game.Inventory.removeActive();
        placeItemOnSlot(hoveredSlot);
      });

      // Register with central interaction system
      Game.Interaction.register('toolPanelItems', function() {
        return allPanelItemMeshes;
      }, false, 5);

      Game.Interaction.register('toolPanelPlace', function() {
        return allPanelParts;
      }, false, 5);
    },

    update: function(delta) {
      updateInteraction();
    }
  };
})();
