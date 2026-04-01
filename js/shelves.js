(function() {
  window.Game = window.Game || {};

  var INSTRUMENT_SHELF_SCALE = 2.8;

  var THREE, scene, camera, controls;
  var shelves = [];
  var hoveredShelf = null;
  var hoveredSlot = null; // specific slot being aimed at (for take mode)
  var shelfMode = null; // 'place' or 'take'
  var interactRay, screenCenter;
  var hintEl;
  var allShelfParts = []; // all meshes belonging to shelves (for raycasting)
  var allItemMeshes = []; // all item meshes on shelves (for raycasting in take mode)

  function createShelf(x, z, rotY, collidables) {
    var group = new THREE.Group();

    var woodMat = new THREE.MeshStandardMaterial({ color: 0x8B6F47, roughness: 0.6 });
    var sideMat = new THREE.MeshStandardMaterial({ color: 0x7A6040, roughness: 0.65 });

    // Back panel
    var back = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 0.05), woodMat);
    back.position.set(0, 0.75, -0.175);
    back.castShadow = true;
    group.add(back);

    // Side panels
    var sideL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.5, 0.4), sideMat);
    sideL.position.set(-0.58, 0.75, 0);
    sideL.castShadow = true;
    group.add(sideL);

    var sideR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.5, 0.4), sideMat);
    sideR.position.set(0.58, 0.75, 0);
    sideR.castShadow = true;
    group.add(sideR);

    // 3 shelf boards
    var boardYs = [0.3, 0.7, 1.1];
    for (var i = 0; i < boardYs.length; i++) {
      var board = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.4), woodMat);
      board.position.set(0, boardYs[i], 0);
      board.castShadow = true;
      group.add(board);
    }

    group.position.set(x, 0, z);
    group.rotation.y = rotY || 0;
    scene.add(group);

    // Store all meshes for raycasting
    group.traverse(function(child) {
      if (child.isMesh) {
        child.userData.shelfRef = shelves.length; // index into shelves array
        allShelfParts.push(child);
      }
    });

    // Collision box
    var box = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 1.5, 0.5),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    box.position.set(x, 0.75, z);
    box.rotation.y = rotY || 0;
    scene.add(box);
    collidables.push(box);

    // Shelf data with 9 slots (3 per board, 3 boards)
    var shelfData = {
      mesh: group,
      highlightParts: [],
      slots: []
    };

    // Collect highlightable parts
    group.traverse(function(child) {
      if (child.isMesh) shelfData.highlightParts.push(child);
    });

    // Compute slot world positions: 3 items per board (left, center, right)
    var slotXOffsets = [-0.35, 0, 0.35];
    for (var i = 0; i < boardYs.length; i++) {
      for (var j = 0; j < slotXOffsets.length; j++) {
        var localPos = new THREE.Vector3(slotXOffsets[j], boardYs[i] + 0.04, 0.05);
        var worldPos = localPos.clone();
        group.localToWorld(worldPos);
        shelfData.slots.push({ pos: worldPos, item: null, count: 0, itemMesh: null, countSprite: null });
      }
    }

    shelves.push(shelfData);
    return shelfData;
  }

  function highlightShelf(shelf) {
    for (var i = 0; i < shelf.highlightParts.length; i++) {
      var part = shelf.highlightParts[i];
      part.material = part.material.clone();
      part.material.emissive = new THREE.Color(0x00ff44);
      part.material.emissiveIntensity = 0.35;
    }
  }

  function unhighlightShelf(shelf) {
    for (var i = 0; i < shelf.highlightParts.length; i++) {
      var part = shelf.highlightParts[i];
      part.material.emissive = new THREE.Color(0x000000);
      part.material.emissiveIntensity = 0;
    }
  }

  function highlightItemMesh(mesh) {
    if (!mesh) return;
    mesh.traverse(function(child) {
      if (child.isMesh) {
        child.material = child.material.clone();
        child.material.emissive = new THREE.Color(0x00ff44);
        child.material.emissiveIntensity = 0.35;
      }
    });
  }

  function unhighlightItemMesh(mesh) {
    if (!mesh) return;
    mesh.traverse(function(child) {
      if (child.isMesh) {
        child.material.emissive = new THREE.Color(0x000000);
        child.material.emissiveIntensity = 0;
      }
    });
  }

  function getShelfFromMesh(mesh) {
    var current = mesh;
    while (current) {
      if (current.userData && current.userData.shelfRef !== undefined) {
        return shelves[current.userData.shelfRef];
      }
      current = current.parent;
    }
    return null;
  }

  var MAX_SHELF_STACK = 10;

  function hasAvailableSlot(shelf, type) {
    for (var i = 0; i < shelf.slots.length; i++) {
      if (shelf.slots[i].item === type && shelf.slots[i].count < MAX_SHELF_STACK) return true;
    }
    for (var i = 0; i < shelf.slots.length; i++) {
      if (!shelf.slots[i].item) return true;
    }
    return false;
  }

  function findSlotForType(shelf, type) {
    // First try to stack into existing slot with same type
    for (var i = 0; i < shelf.slots.length; i++) {
      if (shelf.slots[i].item === type && shelf.slots[i].count < MAX_SHELF_STACK) return shelf.slots[i];
    }
    // Then find empty slot
    for (var i = 0; i < shelf.slots.length; i++) {
      if (!shelf.slots[i].item) return shelf.slots[i];
    }
    return null;
  }

  function createCountSprite(count) {
    var canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    var ctx = canvas.getContext('2d');
    // Badge circle
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    // Number
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(count), 32, 34);

    var texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    var mat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
    var sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.15, 0.15, 1);
    return sprite;
  }

  function updateCountSprite(slot) {
    if (slot.count > 1) {
      if (slot.countSprite) {
        scene.remove(slot.countSprite);
        slot.countSprite.material.map.dispose();
        slot.countSprite.material.dispose();
      }
      var sprite = createCountSprite(slot.count);
      var info = getItemInfo(slot.item);
      var isInstrument = Game.Consumables.isInstrument(slot.item);
      var itemH = isInstrument ? info.size.y * INSTRUMENT_SHELF_SCALE : info.size.y;
      sprite.position.copy(slot.pos);
      sprite.position.y += itemH + 0.08;
      scene.add(sprite);
      slot.countSprite = sprite;
    } else if (slot.countSprite) {
      scene.remove(slot.countSprite);
      slot.countSprite.material.map.dispose();
      slot.countSprite.material.dispose();
      slot.countSprite = null;
    }
  }

  function getItemInfo(type) {
    return Game.Consumables.TYPES[type] || Game.Consumables.INSTRUMENT_TYPES[type];
  }

  function getSlotFromItemMesh(hitObject) {
    for (var s = 0; s < shelves.length; s++) {
      var slots = shelves[s].slots;
      for (var i = 0; i < slots.length; i++) {
        if (!slots[i].itemMesh) continue;
        var current = hitObject;
        while (current) {
          if (current === slots[i].itemMesh) return { shelf: shelves[s], slot: slots[i] };
          current = current.parent;
        }
      }
    }
    return null;
  }

  function registerItemMeshes(mesh) {
    mesh.traverse(function(child) {
      if (child.isMesh) allItemMeshes.push(child);
    });
  }

  function unregisterItemMeshes(mesh) {
    mesh.traverse(function(child) {
      if (child.isMesh) {
        var idx = allItemMeshes.indexOf(child);
        if (idx !== -1) allItemMeshes.splice(idx, 1);
      }
    });
  }

  function placeItemOnShelf(slot, type) {
    var info = getItemInfo(type);
    var isInstrument = Game.Consumables.isInstrument(type);
    if (!slot.item) {
      // Empty slot — create mesh
      var mesh = Game.Consumables.createMesh(type);
      if (isInstrument) {
        mesh.scale.set(INSTRUMENT_SHELF_SCALE, INSTRUMENT_SHELF_SCALE, INSTRUMENT_SHELF_SCALE);
      }
      mesh.position.copy(slot.pos);
      mesh.position.y += (isInstrument ? info.size.y * INSTRUMENT_SHELF_SCALE : info.size.y) / 2;
      scene.add(mesh);
      slot.item = type;
      slot.itemMesh = mesh;
      slot.count = 1;
      registerItemMeshes(mesh);
    } else {
      // Stacking — just increment count
      slot.count++;
    }
    updateCountSprite(slot);
  }

  function getNearestOccupiedSlot(shelf, point) {
    var best = null;
    var bestDist = Infinity;
    for (var i = 0; i < shelf.slots.length; i++) {
      if (!shelf.slots[i].item) continue;
      var d = shelf.slots[i].pos.distanceTo(point);
      if (d < bestDist) {
        bestDist = d;
        best = shelf.slots[i];
      }
    }
    return best;
  }

  function hasOccupiedSlot(shelf) {
    for (var i = 0; i < shelf.slots.length; i++) {
      if (shelf.slots[i].item) return true;
    }
    return false;
  }

  function getFirstOccupiedSlot(shelf) {
    for (var i = 0; i < shelf.slots.length; i++) {
      if (shelf.slots[i].item) return shelf.slots[i];
    }
    return null;
  }

  function takeItemFromShelf(slot) {
    var type = slot.item;
    slot.count--;
    if (slot.count <= 0) {
      unregisterItemMeshes(slot.itemMesh);
      scene.remove(slot.itemMesh);
      slot.item = null;
      slot.itemMesh = null;
      slot.count = 0;
    }
    updateCountSprite(slot);
    return type;
  }

  function updateInteraction() {
    if (!controls.isLocked || Game.Patients.isPopupOpen() || Game.Shop.isOpen()) {
      if (hoveredShelf && shelfMode === 'place') unhighlightShelf(hoveredShelf);
      if (hoveredSlot && shelfMode === 'take') unhighlightItemMesh(hoveredSlot.itemMesh);
      hoveredShelf = null; hoveredSlot = null; shelfMode = null;
      return false;
    }
    if (Game.Patients.hasInteraction() || Game.Consumables.hasInteraction() || Game.Consumables.hasBoxInteraction()) {
      if (hoveredShelf && shelfMode === 'place') unhighlightShelf(hoveredShelf);
      if (hoveredSlot && shelfMode === 'take') unhighlightItemMesh(hoveredSlot.itemMesh);
      hoveredShelf = null; hoveredSlot = null; shelfMode = null;
      return false;
    }
    if (Game.Consumables.isHoldingBox()) {
      if (hoveredShelf && shelfMode === 'place') unhighlightShelf(hoveredShelf);
      if (hoveredSlot && shelfMode === 'take') unhighlightItemMesh(hoveredSlot.itemMesh);
      hoveredShelf = null; hoveredSlot = null; shelfMode = null;
      return false;
    }

    var activeItem = Game.Inventory.getActive();

    interactRay.setFromCamera(screenCenter, camera);

    var newHovered = null;
    var newMode = null;
    var newHoveredSlot = null;

    // Try take mode first: raycast against item meshes on shelves
    if (!activeItem && allItemMeshes.length > 0) {
      var itemHits = interactRay.intersectObjects(allItemMeshes, false);
      if (itemHits.length > 0) {
        var result = getSlotFromItemMesh(itemHits[0].object);
        if (result) {
          newHovered = result.shelf;
          newMode = 'take';
          newHoveredSlot = result.slot;
        }
      }
    }

    // Place mode: raycast against shelf structure
    if (!newHovered && activeItem) {
      var hits = interactRay.intersectObjects(allShelfParts);
      if (hits.length > 0) {
        var shelf = getShelfFromMesh(hits[0].object);
        if (shelf && hasAvailableSlot(shelf, activeItem)) {
          newHovered = shelf;
          newMode = 'place';
        }
      }
    }

    // Update highlights
    if (newHovered !== hoveredShelf || newMode !== shelfMode || newHoveredSlot !== hoveredSlot) {
      // Clear old highlights
      if (hoveredShelf && shelfMode === 'place') unhighlightShelf(hoveredShelf);
      if (hoveredSlot && shelfMode === 'take') unhighlightItemMesh(hoveredSlot.itemMesh);
      // Apply new highlights
      if (newHovered && newMode === 'place') highlightShelf(newHovered);
      if (newHoveredSlot && newMode === 'take') highlightItemMesh(newHoveredSlot.itemMesh);
    }
    hoveredShelf = newHovered;
    shelfMode = newMode;
    hoveredSlot = newHoveredSlot;

    if (hoveredShelf) {
      if (shelfMode === 'take' && hoveredSlot) {
        var itemInfo = getItemInfo(hoveredSlot.item);
        hintEl.textContent = 'Взять ' + itemInfo.name + ' на ЛКМ';
      } else {
        hintEl.textContent = 'Положить на ЛКМ';
      }
      hintEl.style.display = 'block';
      return true;
    }
    return false;
  }

  window.Game.Shelves = {
    hasInteraction: function() { return !!hoveredShelf; },

    setup: function(_THREE, _scene, _camera, _controls, collidables) {
      THREE = _THREE;
      scene = _scene;
      camera = _camera;
      controls = _controls;

      interactRay = new THREE.Raycaster();
      interactRay.far = 5;
      screenCenter = new THREE.Vector2(0, 0);
      hintEl = document.getElementById('interact-hint');

      // Create 2 shelves next to each other near back wall, left of reception
      createShelf(-5.5, -11.5, 0, collidables);
      createShelf(-4.2, -11.5, 0, collidables);

      // Place/take item on shelf on click
      document.addEventListener('mousedown', function(e) {
        if (e.button !== 0 || !controls.isLocked) return;
        if (Game.Patients.isPopupOpen() || Game.Shop.isOpen()) return;
        if (Game.Patients.hasInteraction() || Game.Consumables.hasInteraction() || Game.Consumables.hasBoxInteraction()) return;
        if (Game.Consumables.isHoldingBox()) return;
        if (!hoveredShelf || !shelfMode) return;

        if (shelfMode === 'place') {
          var type = Game.Inventory.getActive();
          if (!type) return;
          var slot = findSlotForType(hoveredShelf, type);
          if (!slot) return;
          Game.Inventory.removeActive();
          placeItemOnShelf(slot, type);
        } else if (shelfMode === 'take') {
          if (!hoveredSlot) return;
          var type = hoveredSlot.item;
          if (Game.Inventory.addItem(type)) {
            takeItemFromShelf(hoveredSlot);
          } else {
            Game.Inventory.showNotification('Инвентарь полон');
          }
        }
      });
    },

    update: function(delta) {
      updateInteraction();
    }
  };
})();
