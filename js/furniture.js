(function() {
  window.Game = window.Game || {};

  var THREE, scene, camera, controls, collidables;
  var interactRay, screenCenter;
  var hintEl;

  var furnitureItems = [];
  var carriedFurniture = null;
  var carriedOriginY = 0; // original Y of carried group
  var carriedBoxY = 0.5; // original Y of carried collision box
  var hoveredFurniture = null;

  var FURNITURE_TYPES = {
    bed:            { name: 'Кровать',              price: 360, slotOffset: { x: 1, z: 0 }, boxSize: { x: 2.1, y: 1.0, z: 1.0 } },
    chair:          { name: 'Стул',                 price: 140, slotOffset: { x: -1, z: 0 }, boxSize: { x: 0.6, y: 1.0, z: 0.6 } },
    washingMachine: { name: 'Стиральная машина',    boxSize: { x: 1.0, y: 1.1, z: 0.8 } },
    basketClean:    { name: 'Корзина (чистое)',     boxSize: { x: 0.8, y: 0.6, z: 0.6 } },
    basketDirty:    { name: 'Корзина (грязное)',    boxSize: { x: 0.8, y: 0.6, z: 0.6 } },
    shelf:          { name: 'Стеллаж',              boxSize: { x: 1.3, y: 1.5, z: 0.5 } },
    toolPanel:      { name: 'Панель инструментов',  boxSize: { x: 1.1, y: 1.3, z: 0.3 } },
    cashierDesk:    { name: 'Кассовый стол',        boxSize: { x: 0.9, y: 0.8, z: 0.7 } }
  };

  var INDOOR_BOUNDS = { xMin: -7.8, xMax: 7.8, zMin: -11.8, zMax: -0.2 };

  var DELIVERY_ZONE = { cx: 0, cz: 5, hw: 1.5, hd: 1.0 };

  // Hold-E state
  var HOLD_DURATION = 600; // ms
  var eKeyHeld = false;
  var eHoldStartTime = 0;
  var eHoldTarget = null;
  var holdProgressEl = null;
  var HOLD_CIRCUMFERENCE = 100.53; // 2 * PI * 16
  var eWaitForRelease = false; // block E until key is physically released

  // Floor plane for raycast placement
  var floorPlane = null;
  var placementRay = null;

  // --- Mesh creation (mirrors world.js) ---

  function createBedMesh(x, z, rotY) {
    var bedFrameMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
    var mattressMat = new THREE.MeshLambertMaterial({ color: 0x88bbaa });
    var pillowMat = new THREE.MeshLambertMaterial({ color: 0xddeedd });

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
    var chairMat = new THREE.MeshLambertMaterial({ color: 0x3366aa });
    var chairLegMat = new THREE.MeshLambertMaterial({ color: 0x888888 });

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
    var typeInfo = FURNITURE_TYPES[item.type];
    if (!typeInfo || !typeInfo.slotOffset) return;
    var offset = typeInfo.slotOffset;
    item.slot.pos.set(
      item.group.position.x + offset.x,
      0,
      item.group.position.z + offset.z
    );
  }

  // --- Highlight ---

  function highlightGroup(group) {
    Game.Outline.setHover([group]);
  }

  function unhighlightGroup(group) {
    Game.Outline.clearHover();
  }

  var lastCarryColor = null; // 'green' | 'red' | null

  function setCarryOutline(group, color) {
    // color: 'green' or 'red'
    if (color === lastCarryColor) return;
    lastCarryColor = color;
    var outlineColor = color === 'green' ? 0x00ff44 : 0xff2222;
    Game.Outline.setHover([group], outlineColor);
  }

  function clearCarryOutline(group) {
    if (lastCarryColor === null) return;
    lastCarryColor = null;
    Game.Outline.clearHover();
  }

  // --- Dirty bed overlay ---

  function createDirtyOverlay(item) {
    var overlayMat = new THREE.MeshLambertMaterial({
      color: 0xaa8844, transparent: true, opacity: 0.5
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

  // --- Wall segments for 2D line intersection (axis-aligned) ---
  // type: 'h' = horizontal (constant z, x range), 'v' = vertical (constant x, z range)
  var WALL_SEGMENTS = [
    { type: 'h', val: -12, min: -8.1, max: 8.1 },   // North wall
    { type: 'v', val: -8,  min: -12,  max: 0 },      // West wall
    { type: 'v', val:  8,  min: -12,  max: 0 },      // East wall
    { type: 'h', val:  0,  min: -8.1, max: -1.2 },   // South wall left
    { type: 'h', val:  0,  min:  1.2, max:  8.1 }    // South wall right
  ];
  var WALL_HALF_THICKNESS = 0.1;

  // Returns the closest wall intersection parameter t (0..1) along line from (px,pz) to (tx,tz), or 1 if no wall hit
  function wallClampT(px, pz, tx, tz) {
    var bestT = 1;
    var lx = tx - px, lz = tz - pz;
    for (var i = 0; i < WALL_SEGMENTS.length; i++) {
      var w = WALL_SEGMENTS[i];
      var t, cross;
      if (w.type === 'h') {
        // horizontal wall: constant z = w.val
        if (Math.abs(lz) < 0.0001) continue; // parallel
        t = (w.val - pz) / lz;
        if (t <= 0 || t >= bestT) continue;
        cross = px + lx * t;
        if (cross >= w.min && cross <= w.max) bestT = t;
      } else {
        // vertical wall: constant x = w.val
        if (Math.abs(lx) < 0.0001) continue; // parallel
        t = (w.val - px) / lx;
        if (t <= 0 || t >= bestT) continue;
        cross = pz + lz * t;
        if (cross >= w.min && cross <= w.max) bestT = t;
      }
    }
    return bestT;
  }

  // --- Collision check for placement ---

  function canPlaceAt(position, type) {
    var info = FURNITURE_TYPES[type];
    var sizeX = info ? info.boxSize.x : 1.0;
    var sizeY = info ? info.boxSize.y : 1.0;
    var sizeZ = info ? info.boxSize.z : 1.0;
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

  // --- Floor raycast placement position ---

  function getPlacementPosition() {
    placementRay.setFromCamera(screenCenter, camera);
    var target = new THREE.Vector3();
    var hit = placementRay.ray.intersectPlane(floorPlane, target);
    if (!hit) {
      // Fallback: 3 units forward
      var forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0; forward.normalize();
      target = camera.position.clone().add(forward.multiplyScalar(3));
    }
    // Clamp distance from player
    var dx = target.x - camera.position.x;
    var dz = target.z - camera.position.z;
    var dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > 6) {
      var scale = 6 / dist;
      target.x = camera.position.x + dx * scale;
      target.z = camera.position.z + dz * scale;
    }
    // Minimum distance so object doesn't clip into player
    if (dist < 1.5) {
      var forward2 = new THREE.Vector3();
      camera.getWorldDirection(forward2);
      forward2.y = 0; forward2.normalize();
      target.x = camera.position.x + forward2.x * 1.5;
      target.z = camera.position.z + forward2.z * 1.5;
    }
    // --- Wall clamping: prevent placement through walls ---
    if (carriedFurniture) {
      var px = camera.position.x, pz = camera.position.z;
      var t = wallClampT(px, pz, target.x, target.z);
      if (t < 1) {
        var info = FURNITURE_TYPES[carriedFurniture.type];
        var furOffset = info ? Math.max(info.boxSize.x, info.boxSize.z) / 2 + WALL_HALF_THICKNESS + 0.05 : 0.65;
        var fullDist = Math.sqrt((target.x - px) * (target.x - px) + (target.z - pz) * (target.z - pz));
        var clampDist = Math.max(0, t * fullDist - furOffset);
        target.x = px + (target.x - px) * (clampDist / fullDist);
        target.z = pz + (target.z - pz) * (clampDist / fullDist);
      }
    }

    target.y = 0;
    return target;
  }

  // --- Carried furniture update ---

  var canPlaceCurrent = false;

  function updateCarriedFurniture() {
    if (!carriedFurniture) return;

    var pos = getPlacementPosition();

    carriedFurniture.group.position.set(pos.x, carriedOriginY, pos.z);
    carriedFurniture.collisionBox.position.set(pos.x, carriedBoxY, pos.z);

    // Check placement validity and update outline color
    canPlaceCurrent = canPlaceAt(pos, carriedFurniture.type);
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
    if (Game.Diagnostics && Game.Diagnostics.isActive()) {
      if (hoveredFurniture) { unhighlightGroup(hoveredFurniture.group); hoveredFurniture = null; }
      return;
    }
    if (!Game.Interaction.isActive('furniture')) {
      // When cashier module is active, allow E-hold on the cashier desk
      if (Game.Interaction.isActive('cashier') && Game.Cashier && Game.Cashier.isDeskHovered()) {
        var cashierDeskItem = null;
        for (var fi = 0; fi < furnitureItems.length; fi++) {
          if (furnitureItems[fi].type === 'cashierDesk') { cashierDeskItem = furnitureItems[fi]; break; }
        }
        if (cashierDeskItem && cashierDeskItem !== hoveredFurniture) {
          if (hoveredFurniture) unhighlightGroup(hoveredFurniture.group);
          hoveredFurniture = cashierDeskItem;
        } else if (!cashierDeskItem && hoveredFurniture) {
          unhighlightGroup(hoveredFurniture.group); hoveredFurniture = null;
        }
        // Don't show furniture hint — cashier.js already shows the combined hint
        return;
      }
      if (hoveredFurniture) { unhighlightGroup(hoveredFurniture.group); hoveredFurniture = null; }
      return;
    }

    var hits = Game.Interaction.getHits('furniture');
    var newHovered = hits ? getFurnitureFromMesh(hits[0].object) : null;

    if (newHovered !== hoveredFurniture) {
      if (hoveredFurniture) unhighlightGroup(hoveredFurniture.group);
      if (newHovered) highlightGroup(newHovered.group);
      hoveredFurniture = newHovered;
    }

    if (hoveredFurniture) {
      if (hoveredFurniture.isDirty && Game.Inventory.countType('linen_clean') > 0) {
        hintEl.textContent = 'ЛКМ — Заменить бельё';
      } else if (hoveredFurniture.isDirty) {
        hintEl.textContent = 'Нужно чистое бельё для замены';
      } else {
        var typeName = FURNITURE_TYPES[hoveredFurniture.type] ? FURNITURE_TYPES[hoveredFurniture.type].name : '';
        hintEl.textContent = 'Зажми E — Переместить ' + typeName.toLowerCase();
      }
      hintEl.style.display = 'block';
    }
  }

  // --- Pick up ---

  function pickUpFurniture(item) {
    // Check canPickUp callback
    if (item.canPickUp && !item.canPickUp()) {
      Game.Inventory.showNotification('Сейчас нельзя переместить');
      return;
    }
    // Check slot occupied (only for types with patient slots)
    if (item.slot && item.slot.occupied) {
      Game.Inventory.showNotification('Нельзя переместить — предмет занят');
      return;
    }
    carriedFurniture = item;
    carriedOriginY = item.group.position.y;
    carriedBoxY = item.collisionBox.position.y;
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

    var targetPos = getPlacementPosition();

    var item = carriedFurniture;
    clearCarryOutline(item.group);
    item.group.position.set(targetPos.x, carriedOriginY, targetPos.z);
    item.collisionBox.position.set(targetPos.x, carriedBoxY, targetPos.z);
    item.collisionBox.rotation.y = item.group.rotation.y;

    // Add collision box back
    collidables.push(item.collisionBox);

    // Update slot and indoor status
    updateSlotPosition(item);
    item.isIndoors = checkIndoors(item.group.position);

    // Call onMoved callback if defined
    if (item.onMoved) {
      item.onMoved(item.group.position, item.group.rotation.y);
    }

    if (!item.isIndoors && FURNITURE_TYPES[item.type] && FURNITURE_TYPES[item.type].slotOffset) {
      var name = FURNITURE_TYPES[item.type].name;
      Game.Inventory.showNotification('Пока ' + name.toLowerCase() + ' на улице — её нельзя использовать', 'rgba(200, 150, 50, 0.85)');
    }

    carriedFurniture = null;
  }

  // --- Linen replacement (LMB on dirty bed) ---

  function tryLinenReplace() {
    if (!hoveredFurniture || !hoveredFurniture.isDirty) return false;
    if (!Game.Inventory.findAndActivate('linen_clean')) return false;
    if (!controls.isLocked) return false;
    if (Game.Patients.isPopupOpen() || Game.Shop.isOpen()) return false;
    if (Game.Cashier && Game.Cashier.isPopupOpen()) return false;
    if (Game.Diagnostics && Game.Diagnostics.isActive()) return false;
    if (Game.Tutorial && Game.Tutorial.isActive() && !Game.Tutorial.isAllowed('linen_replace')) return false;

    // Remove clean linen from inventory
    Game.Inventory.removeActive();
    // Make bed clean
    setDirty(hoveredFurniture, false);
    // Add dirty linen to inventory (or drop on floor)
    if (!Game.Inventory.addItem('linen_dirty')) {
      Game.Consumables.dropFromPlayer('linen_dirty');
    }
    Game.Inventory.showNotification('Бельё заменено!', 'rgba(34, 139, 34, 0.85)');
    if (Game.Tutorial && Game.Tutorial.isActive()) Game.Tutorial.onEvent('linen_replaced');
    return true;
  }

  // --- Hold cancel ---

  function cancelHold() {
    eKeyHeld = false;
    eHoldTarget = null;
    eHoldStartTime = 0;
    if (holdProgressEl) {
      holdProgressEl.parentElement.style.display = 'none';
      holdProgressEl.style.strokeDashoffset = String(HOLD_CIRCUMFERENCE);
    }
  }

  // --- E key handler ---

  function onKeyDown(e) {
    if (e.code !== 'KeyE') return;
    if (eKeyHeld || eWaitForRelease) return; // filter auto-repeat and post-hold
    if (!controls.isLocked) return;
    if (Game.Patients.isPopupOpen() || Game.Shop.isOpen()) return;
    if (Game.Cashier && Game.Cashier.isPopupOpen()) return;
    if (Game.Diagnostics && Game.Diagnostics.isActive()) return;
    if (Game.WashingMachine && Game.WashingMachine.hasInteraction()) return;
    if (Game.Tutorial && Game.Tutorial.isActive() && !Game.Tutorial.isAllowed('furniture_interact')) return;

    if (carriedFurniture) {
      placeFurniture();
      return;
    }

    // Don't pickup if a module-specific interaction is active
    if (Game.Shelves && Game.Shelves.hasInteraction()) return;
    if (Game.ToolPanel && Game.ToolPanel.hasInteraction()) return;
    if (Game.Staff && Game.Staff.hasBasketInteraction && Game.Staff.hasBasketInteraction()) return;

    if (hoveredFurniture) {
      // Start hold
      eKeyHeld = true;
      eHoldStartTime = performance.now();
      eHoldTarget = hoveredFurniture;
      if (holdProgressEl) {
        holdProgressEl.style.strokeDashoffset = String(HOLD_CIRCUMFERENCE);
        holdProgressEl.parentElement.style.display = 'block';
      }
      return;
    }
  }

  function onKeyUp(e) {
    if (e.code !== 'KeyE') return;
    if (eKeyHeld) cancelHold();
    eWaitForRelease = false;
  }

  // --- Mouse wheel rotation ---

  function onWheel(e) {
    if (!carriedFurniture) return;
    if (!controls.isLocked) return;
    e.preventDefault();
    var rotStep = Math.PI / 12; // 15 degrees per tick
    carriedFurniture.group.rotation.y += e.deltaY > 0 ? rotStep : -rotStep;
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

      // Floor plane for raycast placement
      floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      placementRay = new THREE.Raycaster();

      holdProgressEl = document.getElementById('hold-progress-arc');

      document.addEventListener('keydown', onKeyDown);
      document.addEventListener('keyup', onKeyUp);
      document.addEventListener('wheel', onWheel, { passive: false });

      // Register with central interaction system
      Game.Interaction.register('furniture', function() {
        var meshes = [];
        for (var i = 0; i < furnitureItems.length; i++) {
          if (furnitureItems[i] !== carriedFurniture) {
            meshes.push(furnitureItems[i].group);
          }
        }
        return meshes;
      }, true, 5);
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

    registerFixture: function(opts) {
      var item = {
        type: opts.type,
        group: opts.group,
        collisionBox: opts.collisionBox,
        slot: opts.slot || { pos: new THREE.Vector3(), occupied: false },
        isIndoors: checkIndoors(opts.group.position),
        onMoved: opts.onMoved || null,
        canPickUp: opts.canPickUp || null
      };
      furnitureItems.push(item);
      return item;
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
      // Hold-E progress
      if (eKeyHeld && eHoldTarget) {
        // Cancel if target no longer valid
        if (eHoldTarget !== hoveredFurniture || carriedFurniture || !controls.isLocked ||
            Game.Patients.isPopupOpen() || Game.Shop.isOpen()) {
          cancelHold();
        } else {
          var progress = Math.min((performance.now() - eHoldStartTime) / HOLD_DURATION, 1.0);
          if (holdProgressEl) {
            holdProgressEl.style.strokeDashoffset = String(HOLD_CIRCUMFERENCE * (1 - progress));
          }
          if (progress >= 1.0) {
            var target = eHoldTarget;
            cancelHold();
            eWaitForRelease = true;
            pickUpFurniture(target);
          }
        }
      }

      updateCarriedFurniture();
      updateFurnitureInteraction();

      // Show carry hint
      if (carriedFurniture && controls.isLocked) {
        var typeName = FURNITURE_TYPES[carriedFurniture.type] ? FURNITURE_TYPES[carriedFurniture.type].name : '';
        hintEl.textContent = 'E — Поставить ' + typeName.toLowerCase() + '  |  Колёсико — Поворот';
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
