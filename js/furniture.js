(function() {
  window.Game = window.Game || {};

  var THREE, scene, camera, controls, collidables;
  var interactRay, screenCenter;
  var hintEl;

  var furnitureItems = [];
  var carriedFurniture = null;
  var hoveredFurniture = null;

  var FURNITURE_TYPES = {
    bed:   { name: 'Кровать', price: 360, slotOffset: { x: 1, z: 0 } },
    chair: { name: 'Стул',    price: 140, slotOffset: { x: -1, z: 0 } }
  };

  var INDOOR_BOUNDS = { xMin: -7.8, xMax: 7.8, zMin: -11.8, zMax: -0.2 };

  var DELIVERY_ZONE = { cx: 0, cz: 5, hw: 1.5, hd: 1.0 };

  // --- Mesh creation (mirrors world.js) ---

  function createBedMesh(x, z, rotY) {
    var bedFrameMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.3, metalness: 0.4 });
    var mattressMat = new THREE.MeshStandardMaterial({ color: 0x88bbaa, roughness: 0.7 });
    var pillowMat = new THREE.MeshStandardMaterial({ color: 0xddeedd, roughness: 0.8 });

    var g = new THREE.Group();
    var frame = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 0.9), bedFrameMat);
    frame.position.y = 0.25; frame.castShadow = true; g.add(frame);
    var matt = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.8), mattressMat);
    matt.position.y = 0.56; matt.castShadow = true; g.add(matt);
    var pillow = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.1, 0.55), pillowMat);
    pillow.position.set(-0.7, 0.65, 0); g.add(pillow);
    var rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.9), bedFrameMat);
    rail.position.set(-1.0, 0.7, 0); g.add(rail);
    g.position.set(x, 0, z);
    g.rotation.y = rotY || 0;
    scene.add(g);

    var box = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.0, 1.0), new THREE.MeshBasicMaterial({ visible: false }));
    box.position.set(x, 0.5, z);
    scene.add(box);
    collidables.push(box);

    return { group: g, collisionBox: box };
  }

  function createChairMesh(x, z, rotY) {
    var chairMat = new THREE.MeshStandardMaterial({ color: 0x3366aa, roughness: 0.6 });
    var chairLegMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3, metalness: 0.5 });

    var g = new THREE.Group();
    var seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), chairMat);
    seat.position.y = 0.45; seat.castShadow = true; g.add(seat);
    var back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.06), chairMat);
    back.position.set(0, 0.73, -0.22); back.castShadow = true; g.add(back);
    var legGeo = new THREE.BoxGeometry(0.04, 0.45, 0.04);
    var legPositions = [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]];
    for (var i = 0; i < legPositions.length; i++) {
      var leg = new THREE.Mesh(legGeo, chairLegMat);
      leg.position.set(legPositions[i][0], 0.225, legPositions[i][1]); g.add(leg);
    }
    g.position.set(x, 0, z);
    g.rotation.y = rotY || 0;
    scene.add(g);

    var box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, 0.6), new THREE.MeshBasicMaterial({ visible: false }));
    box.position.set(x, 0.5, z);
    scene.add(box);
    collidables.push(box);

    return { group: g, collisionBox: box };
  }

  // --- Indoor check ---

  function checkIndoors(pos) {
    return pos.x >= INDOOR_BOUNDS.xMin && pos.x <= INDOOR_BOUNDS.xMax &&
           pos.z >= INDOOR_BOUNDS.zMin && pos.z <= INDOOR_BOUNDS.zMax;
  }

  // --- Slot position update ---

  function updateSlotPosition(item) {
    var offset = FURNITURE_TYPES[item.type].slotOffset;
    item.slot.pos.set(
      item.group.position.x + offset.x,
      0,
      item.group.position.z + offset.z
    );
  }

  // --- Highlight ---

  function highlightGroup(group) {
    group.traverse(function(child) {
      if (child.isMesh) {
        child.material = child.material.clone();
        child.material.emissive = new THREE.Color(0x00ff44);
        child.material.emissiveIntensity = 0.35;
      }
    });
  }

  function unhighlightGroup(group) {
    group.traverse(function(child) {
      if (child.isMesh && child.material.emissive) {
        child.material.emissive = new THREE.Color(0x000000);
        child.material.emissiveIntensity = 0;
      }
    });
  }

  var lastCarryColor = null; // 'green' | 'red' | null

  function setCarryOutline(group, color) {
    // color: 'green' or 'red'
    if (color === lastCarryColor) return;
    lastCarryColor = color;
    var emissiveColor = color === 'green' ? new THREE.Color(0x00ff44) : new THREE.Color(0xff2222);
    group.traverse(function(child) {
      if (child.isMesh) {
        if (!child.userData._origMaterial) {
          child.material = child.material.clone();
          child.userData._origMaterial = true;
        }
        child.material.emissive = emissiveColor;
        child.material.emissiveIntensity = 0.45;
      }
    });
  }

  function clearCarryOutline(group) {
    if (lastCarryColor === null) return;
    lastCarryColor = null;
    group.traverse(function(child) {
      if (child.isMesh) {
        child.material.emissive = new THREE.Color(0x000000);
        child.material.emissiveIntensity = 0;
      }
    });
  }

  // --- Dirty bed overlay ---

  function createDirtyOverlay(item) {
    var overlayMat = new THREE.MeshStandardMaterial({
      color: 0xaa8844, transparent: true, opacity: 0.5, roughness: 0.9
    });
    var overlay = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.02, 0.8), overlayMat);
    overlay.position.y = 0.63;
    item.group.add(overlay);
    item.dirtyOverlay = overlay;
  }

  function setDirty(item, dirty) {
    if (dirty) {
      item.isDirty = true;
      if (!item.dirtyOverlay) createDirtyOverlay(item);
    } else {
      item.isDirty = false;
      if (item.dirtyOverlay) {
        item.group.remove(item.dirtyOverlay);
        item.dirtyOverlay.geometry.dispose();
        item.dirtyOverlay.material.dispose();
        item.dirtyOverlay = null;
      }
    }
  }

  function getBedItemBySlot(slot) {
    for (var i = 0; i < furnitureItems.length; i++) {
      if (furnitureItems[i].type === 'bed' && furnitureItems[i].slot === slot) return furnitureItems[i];
    }
    return null;
  }

  // --- Lookup ---

  function getFurnitureFromMesh(hitObject) {
    for (var i = 0; i < furnitureItems.length; i++) {
      var item = furnitureItems[i];
      if (item === carriedFurniture) continue;
      var current = hitObject;
      while (current) {
        if (current === item.group) return item;
        current = current.parent;
      }
    }
    return null;
  }

  // --- Collision check for placement ---

  function canPlaceAt(position, type) {
    var sizeX = type === 'bed' ? 2.1 : 0.6;
    var sizeY = 1.0;
    var sizeZ = type === 'bed' ? 1.0 : 0.6;
    var hx = sizeX / 2, hy = sizeY / 2, hz = sizeZ / 2;

    var min = new THREE.Vector3(position.x - hx, position.y - hy + 0.5, position.z - hz);
    var max = new THREE.Vector3(position.x + hx, position.y + hy + 0.5, position.z + hz);
    var testBox = new THREE.Box3(min, max);

    for (var i = 0; i < collidables.length; i++) {
      var obj = collidables[i];
      // Skip own collision box
      if (carriedFurniture && obj === carriedFurniture.collisionBox) continue;
      // Skip floor-like objects (thin, at ground level)
      if (obj.position.y < 0.1 && obj.geometry && obj.geometry.parameters &&
          obj.geometry.parameters.height <= 0.1) continue;
      // Skip ceiling
      if (obj.position.y > 2.5) continue;

      var objBox = new THREE.Box3().setFromObject(obj);
      if (testBox.intersectsBox(objBox)) return false;
    }
    return true;
  }

  // --- Carried furniture update ---

  var canPlaceCurrent = false;

  function updateCarriedFurniture() {
    if (!carriedFurniture) return;
    var forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    var pos = camera.position.clone();
    pos.add(forward.clone().multiplyScalar(3.0));
    pos.y = 0.3;

    carriedFurniture.group.position.copy(pos);
    carriedFurniture.collisionBox.position.set(pos.x, 0.5, pos.z);

    // Check placement validity and update outline color
    var placePos = pos.clone();
    placePos.y = 0;
    canPlaceCurrent = canPlaceAt(placePos, carriedFurniture.type);
    setCarryOutline(carriedFurniture.group, canPlaceCurrent ? 'green' : 'red');
  }

  // --- Interaction update ---

  function updateFurnitureInteraction() {
    if (!controls.isLocked || Game.Patients.isPopupOpen() || Game.Shop.isOpen()) {
      if (hoveredFurniture) { unhighlightGroup(hoveredFurniture.group); hoveredFurniture = null; }
      return;
    }
    if (carriedFurniture) {
      if (hoveredFurniture) { unhighlightGroup(hoveredFurniture.group); hoveredFurniture = null; }
      return;
    }
    if (Game.Patients.hasInteraction()) {
      if (hoveredFurniture) { unhighlightGroup(hoveredFurniture.group); hoveredFurniture = null; }
      return;
    }
    if (Game.Diagnostics && Game.Diagnostics.isActive()) {
      if (hoveredFurniture) { unhighlightGroup(hoveredFurniture.group); hoveredFurniture = null; }
      return;
    }
    if (Game.WashingMachine && Game.WashingMachine.hasInteraction()) {
      if (hoveredFurniture) { unhighlightGroup(hoveredFurniture.group); hoveredFurniture = null; }
      return;
    }

    interactRay.setFromCamera(screenCenter, camera);
    var meshes = [];
    for (var i = 0; i < furnitureItems.length; i++) {
      if (furnitureItems[i] !== carriedFurniture) {
        meshes.push(furnitureItems[i].group);
      }
    }

    var hits = interactRay.intersectObjects(meshes, true);
    var newHovered = hits.length > 0 ? getFurnitureFromMesh(hits[0].object) : null;

    if (newHovered !== hoveredFurniture) {
      if (hoveredFurniture) unhighlightGroup(hoveredFurniture.group);
      if (newHovered) highlightGroup(newHovered.group);
      hoveredFurniture = newHovered;
    }

    if (hoveredFurniture) {
      if (hoveredFurniture.isDirty && Game.Inventory.getActive() === 'linen_clean') {
        hintEl.textContent = 'ЛКМ — Заменить бельё';
      } else if (hoveredFurniture.isDirty) {
        hintEl.textContent = 'Нужно чистое бельё для замены';
      } else {
        hintEl.textContent = 'Нажми E чтобы переместить';
      }
      hintEl.style.display = 'block';
    }
  }

  // --- Pick up ---

  function pickUpFurniture(item) {
    if (item.slot.occupied) {
      Game.Inventory.showNotification('Нельзя переместить — предмет занят');
      return;
    }
    carriedFurniture = item;
    lastCarryColor = null; // Reset so outline gets applied on first frame
    // Remove collision box from collidables
    var idx = collidables.indexOf(item.collisionBox);
    if (idx !== -1) collidables.splice(idx, 1);
    unhighlightGroup(item.group);
    hoveredFurniture = null;
  }

  // --- Place down ---

  function placeFurniture() {
    if (!canPlaceCurrent) {
      Game.Inventory.showNotification('Нельзя разместить здесь');
      return;
    }

    var forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    var targetPos = camera.position.clone();
    targetPos.add(forward.clone().multiplyScalar(3.0));
    targetPos.y = 0;

    var item = carriedFurniture;
    clearCarryOutline(item.group);
    item.group.position.set(targetPos.x, 0, targetPos.z);
    item.collisionBox.position.set(targetPos.x, 0.5, targetPos.z);

    // Add collision box back
    collidables.push(item.collisionBox);

    // Update slot and indoor status
    updateSlotPosition(item);
    item.isIndoors = checkIndoors(item.group.position);

    if (!item.isIndoors) {
      var name = FURNITURE_TYPES[item.type].name;
      Game.Inventory.showNotification('Пока ' + name.toLowerCase() + ' на улице — её нельзя использовать', 'rgba(200, 150, 50, 0.85)');
    }

    carriedFurniture = null;
  }

  // --- Linen replacement (LMB on dirty bed) ---

  function tryLinenReplace() {
    if (!hoveredFurniture || !hoveredFurniture.isDirty) return false;
    if (Game.Inventory.getActive() !== 'linen_clean') return false;
    if (!controls.isLocked) return false;
    if (Game.Patients.isPopupOpen() || Game.Shop.isOpen()) return false;
    if (Game.Cashier && Game.Cashier.isPopupOpen()) return false;
    if (Game.Diagnostics && Game.Diagnostics.isActive()) return false;

    // Remove clean linen from inventory
    Game.Inventory.removeActive();
    // Make bed clean
    setDirty(hoveredFurniture, false);
    // Add dirty linen to inventory (or drop on floor)
    if (!Game.Inventory.addItem('linen_dirty')) {
      Game.Consumables.dropFromPlayer('linen_dirty');
    }
    Game.Inventory.showNotification('Бельё заменено!', 'rgba(34, 139, 34, 0.85)');
    return true;
  }

  // --- E key handler ---

  function onKeyDown(e) {
    if (e.code !== 'KeyE') return;
    if (!controls.isLocked) return;
    if (Game.Patients.isPopupOpen() || Game.Shop.isOpen()) return;
    if (Game.Cashier && Game.Cashier.isPopupOpen()) return;
    if (Game.Diagnostics && Game.Diagnostics.isActive()) return;
    if (Game.WashingMachine && Game.WashingMachine.hasInteraction()) return;

    if (carriedFurniture) {
      placeFurniture();
      return;
    }

    if (hoveredFurniture) {
      pickUpFurniture(hoveredFurniture);
      return;
    }
  }

  // --- Public API ---

  window.Game.Furniture = {
    TYPES: FURNITURE_TYPES,

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

      document.addEventListener('keydown', onKeyDown);
    },

    registerExisting: function(bedMeshes, chairMeshes) {
      for (var i = 0; i < bedMeshes.length; i++) {
        var bm = bedMeshes[i];
        var item = {
          type: 'bed',
          group: bm.group,
          collisionBox: bm.collisionBox,
          slot: { pos: new THREE.Vector3(), occupied: false },
          isIndoors: true,
          isDirty: false,
          dirtyOverlay: null
        };
        updateSlotPosition(item);
        furnitureItems.push(item);
      }
      for (var i = 0; i < chairMeshes.length; i++) {
        var cm = chairMeshes[i];
        var item = {
          type: 'chair',
          group: cm.group,
          collisionBox: cm.collisionBox,
          slot: { pos: new THREE.Vector3(), occupied: false },
          isIndoors: true
        };
        updateSlotPosition(item);
        furnitureItems.push(item);
      }
    },

    spawnFurniture: function(type) {
      var x = DELIVERY_ZONE.cx + (Math.random() - 0.5) * 2 * DELIVERY_ZONE.hw;
      var z = DELIVERY_ZONE.cz + (Math.random() - 0.5) * 2 * DELIVERY_ZONE.hd;

      var meshData;
      if (type === 'bed') {
        meshData = createBedMesh(x, z, 0);
      } else {
        meshData = createChairMesh(x, z, -Math.PI / 2);
      }

      var item = {
        type: type,
        group: meshData.group,
        collisionBox: meshData.collisionBox,
        slot: { pos: new THREE.Vector3(), occupied: false },
        isIndoors: false,
        isDirty: false,
        dirtyOverlay: null
      };
      updateSlotPosition(item);
      furnitureItems.push(item);
    },

    update: function(delta) {
      updateCarriedFurniture();
      updateFurnitureInteraction();

      // Show carry hint
      if (carriedFurniture && controls.isLocked) {
        hintEl.textContent = 'E — Поставить ' + FURNITURE_TYPES[carriedFurniture.type].name.toLowerCase();
        hintEl.style.display = 'block';
      }
    },

    getIndoorBeds: function() {
      var result = [];
      for (var i = 0; i < furnitureItems.length; i++) {
        if (furnitureItems[i].type === 'bed' && furnitureItems[i].isIndoors) {
          result.push(furnitureItems[i].slot);
        }
      }
      return result;
    },

    getIndoorChairs: function() {
      var result = [];
      for (var i = 0; i < furnitureItems.length; i++) {
        if (furnitureItems[i].type === 'chair' && furnitureItems[i].isIndoors) {
          result.push(furnitureItems[i].slot);
        }
      }
      return result;
    },

    getAllBeds: function() {
      var result = [];
      for (var i = 0; i < furnitureItems.length; i++) {
        if (furnitureItems[i].type === 'bed') result.push(furnitureItems[i].slot);
      }
      return result;
    },

    getAllChairs: function() {
      var result = [];
      for (var i = 0; i < furnitureItems.length; i++) {
        if (furnitureItems[i].type === 'chair') result.push(furnitureItems[i].slot);
      }
      return result;
    },

    getOutdoorBedCount: function() {
      var count = 0;
      for (var i = 0; i < furnitureItems.length; i++) {
        if (furnitureItems[i].type === 'bed' && !furnitureItems[i].isIndoors) count++;
      }
      return count;
    },

    getOutdoorChairCount: function() {
      var count = 0;
      for (var i = 0; i < furnitureItems.length; i++) {
        if (furnitureItems[i].type === 'chair' && !furnitureItems[i].isIndoors) count++;
      }
      return count;
    },

    isBedSlot: function(slot) {
      for (var i = 0; i < furnitureItems.length; i++) {
        if (furnitureItems[i].type === 'bed' && furnitureItems[i].slot === slot) return true;
      }
      return false;
    },

    hasInteraction: function() { return !!hoveredFurniture; },
    isCarrying: function() { return !!carriedFurniture; },

    markBedDirty: function(slot) {
      var item = getBedItemBySlot(slot);
      if (item) setDirty(item, true);
    },

    markBedClean: function(slot) {
      var item = getBedItemBySlot(slot);
      if (item) setDirty(item, false);
    },

    isBedDirty: function(slot) {
      var item = getBedItemBySlot(slot);
      return item ? item.isDirty : false;
    },

    getDirtyBeds: function() {
      var result = [];
      for (var i = 0; i < furnitureItems.length; i++) {
        if (furnitureItems[i].type === 'bed' && furnitureItems[i].isIndoors && furnitureItems[i].isDirty) {
          result.push(furnitureItems[i].slot);
        }
      }
      return result;
    },

    getDirtyBedCount: function() {
      var count = 0;
      for (var i = 0; i < furnitureItems.length; i++) {
        if (furnitureItems[i].type === 'bed' && furnitureItems[i].isIndoors && furnitureItems[i].isDirty) count++;
      }
      return count;
    },

    tryLinenReplace: function() { return tryLinenReplace(); }
  };
})();
