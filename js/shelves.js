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

    var woodMat = new THREE.MeshLambertMaterial({ color: 0x8B6F47 });
    var sideMat = new THREE.MeshLambertMaterial({ color: 0x7A6040 });

    // Back panel
    var back = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 0.05), woodMat);
    back.position.set(0, 0.75, -0.175);
    back.castShadow = true;
    group.add(back);

    // Side panels
    var sideL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.5, 0.35), sideMat);
    sideL.position.set(-0.58, 0.75, 0.025);
    sideL.castShadow = true;
    group.add(sideL);

    var sideR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.5, 0.35), sideMat);
    sideR.position.set(0.58, 0.75, 0.025);
    sideR.castShadow = true;
    group.add(sideR);

    // 3 shelf boards
    var boardYs = [0.3, 0.7, 1.1];
    for (var i = 0; i < boardYs.length; i++) {
      var board = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.04, 0.35), woodMat);
      board.position.set(0, boardYs[i], 0.025);
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
      collisionBox: box,
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
    Game.Outline.setHover([shelf.mesh]);
  }

  function unhighlightShelf(shelf) {
    Game.Outline.clearHover();
  }

  function highlightItemMesh(mesh) {
    if (!mesh) return;
    Game.Outline.setHover([mesh]);
  }

  function unhighlightItemMesh(mesh) {
    if (!mesh) return;
    Game.Outline.clearHover();
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

  function clearShelfHover() {
    if (hoveredShelf && shelfMode === 'place') unhighlightShelf(hoveredShelf);
    if (hoveredSlot && shelfMode === 'take') unhighlightItemMesh(hoveredSlot.itemMesh);
    hoveredShelf = null; hoveredSlot = null; shelfMode = null;
  }

  function updateInteraction() {
    if (!controls.isLocked || Game.Patients.isPopupOpen() || Game.Shop.isOpen()) {
      clearShelfHover();
      return false;
    }
    if (Game.Furniture.isCarrying()) {
      clearShelfHover();
      return false;
    }
    if (Game.Consumables.isHoldingBox()) {
      clearShelfHover();
      return false;
    }
    if (!Game.Interaction.isActive('shelvesItems') && !Game.Interaction.isActive('shelvesPlace')) {
      clearShelfHover();
      return false;
    }

    var activeItem = Game.Inventory.getActive();

    var newHovered = null;
    var newMode = null;
    var newHoveredSlot = null;

    // Try take mode first: use cached hits from shelvesItems
    if (!Game.Inventory.isFull()) {
      var itemHits = Game.Interaction.getHits('shelvesItems');
      if (itemHits) {
        var result = getSlotFromItemMesh(itemHits[0].object);
        if (result) {
          newHovered = result.shelf;
          newMode = 'take';
          newHoveredSlot = result.slot;
        }
      }
    }

    // Place mode: use cached hits from shelvesPlace
    if (!newHovered && activeItem && !Game.Consumables.isInstrument(activeItem)) {
      var placeHits = Game.Interaction.getHits('shelvesPlace');
      if (placeHits) {
        var shelf = getShelfFromMesh(placeHits[0].object);
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
      var hints = [];
      if (shelfMode === 'take' && hoveredSlot) {
        var itemInfo = getItemInfo(hoveredSlot.item);
        hints.push('Взять ' + itemInfo.name + ' на ЛКМ');
      }
      var activeItem = Game.Inventory.getActive();
      if (activeItem && hasAvailableSlot(hoveredShelf, activeItem)) {
        hints.push('Положить на E');
      }
      if (hints.length > 0) {
        hintEl.textContent = hints.join('  |  ');
        hintEl.style.display = 'block';
        return true;
      }
    }
    return false;
  }

  window.Game.Shelves = {
    hasInteraction: function() { return !!hoveredShelf; },

    // Staff APIs
    getShelves: function() { return shelves; },
    findSlotWithItem: function(type) {
      for (var s = 0; s < shelves.length; s++) {
        for (var i = 0; i < shelves[s].slots.length; i++) {
          if (shelves[s].slots[i].item === type && shelves[s].slots[i].count > 0) return shelves[s].slots[i];
        }
      }
      return null;
    },
    takeFromSlot: function(slot) {
      if (!slot || !slot.item) return null;
      return takeItemFromShelf(slot);
    },
    placeOnAnyShelf: function(type) {
      if (Game.Consumables.isInstrument(type)) return false;
      for (var s = 0; s < shelves.length; s++) {
        var slot = findSlotForType(shelves[s], type);
        if (slot) {
          placeItemOnShelf(slot, type);
          return true;
        }
      }
      return false;
    },

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

      // Shelves start empty — player buys consumables from the shop

      // Register shelves as draggable fixtures
      var boardYs = [0.3, 0.7, 1.1];
      var slotXOffsets = [-0.35, 0, 0.35];
      for (var si = 0; si < shelves.length; si++) {
        (function(shelfData) {
          Game.Furniture.registerFixture({
            type: 'shelf',
            group: shelfData.mesh,
            collisionBox: shelfData.collisionBox,
            onMoved: function(pos, rotY) {
              shelfData.mesh.updateMatrixWorld(true);
              var idx = 0;
              for (var bi = 0; bi < boardYs.length; bi++) {
                for (var sj = 0; sj < slotXOffsets.length; sj++) {
                  var localPos = new THREE.Vector3(slotXOffsets[sj], boardYs[bi] + 0.04, 0.05);
                  var worldPos = localPos.clone();
                  shelfData.mesh.localToWorld(worldPos);
                  shelfData.slots[idx].pos.copy(worldPos);
                  // Reposition item mesh if exists
                  if (shelfData.slots[idx].itemMesh) {
                    var info = getItemInfo(shelfData.slots[idx].item);
                    var isInstrument = Game.Consumables.isInstrument(shelfData.slots[idx].item);
                    var itemH = isInstrument ? info.size.y * INSTRUMENT_SHELF_SCALE : info.size.y;
                    shelfData.slots[idx].itemMesh.position.copy(worldPos);
                    shelfData.slots[idx].itemMesh.position.y += itemH / 2;
                  }
                  // Reposition count sprite
                  if (shelfData.slots[idx].countSprite) {
                    var info2 = getItemInfo(shelfData.slots[idx].item);
                    var isInst2 = Game.Consumables.isInstrument(shelfData.slots[idx].item);
                    var h2 = isInst2 ? info2.size.y * INSTRUMENT_SHELF_SCALE : info2.size.y;
                    shelfData.slots[idx].countSprite.position.copy(worldPos);
                    shelfData.slots[idx].countSprite.position.y += h2 + 0.08;
                  }
                  idx++;
                }
              }
            }
          });
        })(shelves[si]);
      }

      // Take item from shelf on LMB
      document.addEventListener('mousedown', function(e) {
        if (e.button !== 0 || !controls.isLocked) return;
        if (Game.Furniture.isCarrying()) return;
        if (Game.Patients.isPopupOpen() || Game.Shop.isOpen()) return;
        if (Game.Patients.hasInteraction() || Game.Consumables.hasInteraction() || Game.Consumables.hasBoxInteraction()) return;
        if (Game.Consumables.isHoldingBox()) return;
        if (Game.Tutorial && Game.Tutorial.isActive() && !Game.Tutorial.isAllowed('shelf_take')) return;
        if (!hoveredShelf || shelfMode !== 'take') return;

        if (!hoveredSlot) return;
        var type = hoveredSlot.item;
        if (Game.Inventory.addItem(type)) {
          takeItemFromShelf(hoveredSlot);
          if (Game.Tutorial && Game.Tutorial.isActive()) Game.Tutorial.onEvent('item_taken_from_shelf', type);
        } else {
          Game.Inventory.showNotification('Инвентарь полон');
        }
      });

      // Place item on shelf on E
      document.addEventListener('keydown', function(e) {
        if (e.code !== 'KeyE' || !controls.isLocked) return;
        if (Game.Furniture.isCarrying()) return;
        if (Game.Patients.isPopupOpen() || Game.Shop.isOpen()) return;
        if (Game.Patients.hasInteraction() || Game.Consumables.hasInteraction() || Game.Consumables.hasBoxInteraction()) return;
        if (Game.Consumables.isHoldingBox()) return;
        if (Game.Tutorial && Game.Tutorial.isActive() && !Game.Tutorial.isAllowed('shelf_place')) return;
        if (!hoveredShelf) return;

        var type = Game.Inventory.getActive();
        if (!type) return;
        if (Game.Consumables.isInstrument(type)) {
          Game.Inventory.showNotification('Инструменты вешайте на панель', 'rgba(200, 150, 50, 0.85)');
          return;
        }
        var slot = findSlotForType(hoveredShelf, type);
        if (!slot) return;
        Game.Inventory.removeActive();
        placeItemOnShelf(slot, type);
      });

      // Register with central interaction system
      Game.Interaction.register('shelvesItems', function() {
        return allItemMeshes;
      }, false, 5);

      Game.Interaction.register('shelvesPlace', function() {
        return allShelfParts;
      }, false, 5);
    },

    update: function(delta) {
      updateInteraction();
    }
  };
})();
