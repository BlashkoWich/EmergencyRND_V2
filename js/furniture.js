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

  // --- Bed HP constants ---
  var BED_MAX_HP = 10;
  var REPAIR_HOLD_DURATION = 3000; // ms — hold-E to fully repair a bed

  var FURNITURE_TYPES = {
    bed:            { name: Game.Lang.t('furniture.bed'),              price: 360, slotOffset: { x: 1, z: 0 }, boxSize: { x: 2.1, y: 1.0, z: 1.0 } },
    chair:          { name: Game.Lang.t('furniture.chair'),            price: 140, slotOffset: { x: -1, z: 0 }, boxSize: { x: 0.6, y: 1.0, z: 0.6 } },
    shelf:          { name: Game.Lang.t('furniture.shelf'),            boxSize: { x: 1.3, y: 1.5, z: 0.5 } },
    toolPanel:      { name: Game.Lang.t('furniture.toolPanel'),        boxSize: { x: 1.1, y: 1.3, z: 0.3 } },
    cashierDesk:    { name: Game.Lang.t('furniture.cashierDesk'),      boxSize: { x: 0.9, y: 0.8, z: 0.7 } }
  };

  var INDOOR_BOUNDS = { xMin: -7.8, xMax: 7.8, zMin: -11.8, zMax: -0.2 };

  var DELIVERY_ZONE = { cx: -10.5, cz: -10.3, hw: 1.5, hd: 1.0 };

  // Hold-E state
  var HOLD_DURATION = 600; // ms — default for furniture pick-up
  var eKeyHeld = false;
  var eHoldStartTime = 0;
  var eHoldTarget = null;
  var eHoldMode = null; // 'pickup' | 'repair'
  var eHoldDuration = HOLD_DURATION;
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

    return { group: g, collisionBox: box, frame: frame, rail: rail, frameMat: bedFrameMat };
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

  // --- Bed HP visuals ---

  function clearBedVisualExtras(item) {
    if (item.cracks) {
      for (var i = 0; i < item.cracks.length; i++) {
        item.group.remove(item.cracks[i]);
        item.cracks[i].geometry.dispose();
        item.cracks[i].material.dispose();
      }
      item.cracks = null;
    }
    if (item.brokenDebris) {
      for (var j = 0; j < item.brokenDebris.length; j++) {
        item.group.remove(item.brokenDebris[j]);
        item.brokenDebris[j].geometry.dispose();
        item.brokenDebris[j].material.dispose();
      }
      item.brokenDebris = null;
    }
  }

  function addCracks(item) {
    // Dark, clearly visible cracks on the VERTICAL faces of the bed frame.
    // Frame is BoxGeometry(2.0, 0.5, 0.9) centered at y=0.25, so its faces are at:
    //   front: z = +0.45, back: z = -0.45, left: x = -1.0, right: x = +1.0
    // y range of frame = 0..0.5
    var crackMat = new THREE.MeshLambertMaterial({ color: 0x101010 });
    var patchMat = new THREE.MeshLambertMaterial({ color: 0x3a2a22 }); // rust/grime patch
    item.cracks = [];

    // Helper to add a crack mesh
    function addMesh(geo, px, py, pz, rx, ry, rz, mat) {
      var m = new THREE.Mesh(geo, mat || crackMat);
      m.position.set(px, py, pz);
      m.rotation.set(rx || 0, ry || 0, rz || 0);
      item.group.add(m);
      item.cracks.push(m);
    }

    // FRONT face (z = +0.45) — 3 angled cracks, slightly in front to avoid z-fight
    var fz = 0.455;
    addMesh(new THREE.BoxGeometry(0.9, 0.04, 0.008), -0.35, 0.32, fz, 0, 0,  0.35);
    addMesh(new THREE.BoxGeometry(0.7, 0.035, 0.008),  0.45, 0.18, fz, 0, 0, -0.28);
    addMesh(new THREE.BoxGeometry(0.5, 0.03, 0.008),   0.75, 0.35, fz, 0, 0,  0.6);
    // Branching cracks
    addMesh(new THREE.BoxGeometry(0.25, 0.025, 0.008), -0.55, 0.42, fz, 0, 0, -0.9);
    addMesh(new THREE.BoxGeometry(0.2, 0.02, 0.008),   -0.1, 0.1, fz,   0, 0, 0.7);

    // BACK face (z = -0.45)
    var bz = -0.455;
    addMesh(new THREE.BoxGeometry(0.8, 0.035, 0.008), -0.2, 0.28, bz, 0, 0, -0.25);
    addMesh(new THREE.BoxGeometry(0.5, 0.03, 0.008),   0.5, 0.12, bz, 0, 0,  0.4);

    // LEFT end (x = -1.0)
    addMesh(new THREE.BoxGeometry(0.008, 0.035, 0.6), -1.005, 0.3, 0.05, 0.3, 0, 0);
    // RIGHT end (x = +1.0)
    addMesh(new THREE.BoxGeometry(0.008, 0.035, 0.5),  1.005, 0.22, -0.1, -0.35, 0, 0);

    // Dark rust/grime patches on front face (larger, for unmistakable damage)
    addMesh(new THREE.BoxGeometry(0.25, 0.12, 0.006),  -0.2, 0.12, fz + 0.001, 0, 0, 0.2, patchMat);
    addMesh(new THREE.BoxGeometry(0.18, 0.09, 0.006),   0.6, 0.3, fz + 0.001, 0, 0, -0.15, patchMat);

    // Chipped corners — small dark cubes protruding from the top-front edge
    addMesh(new THREE.BoxGeometry(0.12, 0.08, 0.06), -0.85, 0.48, 0.46, 0, 0, 0.4);
    addMesh(new THREE.BoxGeometry(0.1, 0.06, 0.05),   0.9, 0.49, 0.44, 0, 0, -0.3);
  }

  function addBrokenDebris(item) {
    var debrisMat = new THREE.MeshLambertMaterial({ color: 0x555544 });
    item.brokenDebris = [];
    // Rail-like piece lying on the floor beside the bed
    var fallen = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.12), debrisMat);
    fallen.position.set(0.6, 0.03, 0.55);
    fallen.rotation.y = 0.4;
    fallen.rotation.z = 0.15;
    item.group.add(fallen);
    item.brokenDebris.push(fallen);
    // Small broken chunk
    var chunk = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.1), debrisMat);
    chunk.position.set(-0.3, 0.05, 0.55);
    chunk.rotation.y = 0.9;
    item.group.add(chunk);
    item.brokenDebris.push(chunk);
  }

  // --- Bed HP bar (visible when wrench is equipped) ---

  function createBedHpBar(item) {
    var canvas = document.createElement('canvas');
    canvas.width = 220; canvas.height = 28;
    var texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    var mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    var sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.1, 0.14, 1);
    sprite.visible = false;
    scene.add(sprite);
    item.hpBar = sprite;
    item.hpBarCanvas = canvas;
    item.hpBarTexture = texture;
    item._hpBarLastHp = -1;
    updateBedHpBarTexture(item);
  }

  function updateBedHpBarTexture(item) {
    if (!item.hpBar) return;
    var hp = typeof item.hp === 'number' ? item.hp : BED_MAX_HP;
    if (hp === item._hpBarLastHp) return;
    item._hpBarLastHp = hp;

    var canvas = item.hpBarCanvas;
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 6);
    ctx.fill();

    // 10 segments with gaps
    var segCount = BED_MAX_HP;
    var pad = 4;
    var gap = 2;
    var totalGap = gap * (segCount - 1);
    var segW = (W - pad * 2 - totalGap) / segCount;
    var segY = 4;
    var segH = H - 8;

    // Colour by HP ratio
    var ratio = hp / BED_MAX_HP;
    var fill;
    if (hp <= 0)        fill = 'rgb(120, 30, 30)';    // broken = dark red
    else if (hp <= 3)   fill = 'rgb(220, 60, 40)';    // critical = red
    else if (hp <= 5)   fill = 'rgb(240, 180, 40)';   // low = yellow
    else                fill = 'rgb(60, 200, 90)';    // ok = green

    for (var i = 0; i < segCount; i++) {
      var sx = pad + i * (segW + gap);
      ctx.fillStyle = (i < hp) ? fill : 'rgba(255, 255, 255, 0.10)';
      ctx.beginPath();
      ctx.roundRect(sx, segY, segW, segH, 3);
      ctx.fill();
    }

    item.hpBarTexture.needsUpdate = true;
  }

  function updateBedHpBarPosition(item) {
    if (!item.hpBar || !item.group) return;
    item.hpBar.position.set(
      item.group.position.x,
      1.4,
      item.group.position.z
    );
  }

  function applyBedVisual(item) {
    if (item.type !== 'bed') return;
    if (typeof item.hp !== 'number') item.hp = BED_MAX_HP;

    // Reset extras; we rebuild per-state
    clearBedVisualExtras(item);

    // Reset group tilt (always baseline)
    if (item._baseRotX === undefined) item._baseRotX = item.group.rotation.x;
    if (item._baseRotZ === undefined) item._baseRotZ = item.group.rotation.z;
    item.group.rotation.x = item._baseRotX;
    item.group.rotation.z = item._baseRotZ;

    // Reset frame color from cached base
    if (item.frameMat && item._baseFrameColor === undefined) {
      item._baseFrameColor = item.frameMat.color.getHex();
    }
    if (item.frameMat && item._baseFrameColor !== undefined) {
      item.frameMat.color.setHex(item._baseFrameColor);
    }

    // Restore rail visibility
    if (item.rail) item.rail.visible = true;

    if (item.hp >= 6) {
      // Normal — nothing else to do
      return;
    }

    if (item.hp >= 1) {
      // Worn — cracks + slightly darker frame
      addCracks(item);
      if (item.frameMat) {
        var darker = new THREE.Color(item._baseFrameColor).multiplyScalar(0.78);
        item.frameMat.color.copy(darker);
      }
      return;
    }

    // Broken (hp === 0) — frame dark, rail gone, debris, slight tilt
    addCracks(item);
    addBrokenDebris(item);
    if (item.rail) item.rail.visible = false;
    if (item.frameMat) {
      var veryDark = new THREE.Color(item._baseFrameColor).multiplyScalar(0.55);
      item.frameMat.color.copy(veryDark);
    }
    item.group.rotation.z = item._baseRotZ + 0.06; // ~3.4° tilt
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
    { type: 'v', val: -8,  min: -9.6,  max: 0 },      // West wall (south of side door)
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

  // --- Wall-mount placement position (snaps to nearest wall) ---

  function getWallPlacementPosition() {
    var basePos = getPlacementPosition();
    var info = FURNITURE_TYPES[carriedFurniture.type];
    var halfWidth = info ? info.boxSize.x / 2 : 0.5;
    var halfDepth = info ? info.boxSize.z / 2 : 0.15;
    var wallOffset = halfDepth + WALL_HALF_THICKNESS + 0.01;

    var bestWall = null;
    var bestDist = Infinity;

    for (var i = 0; i < WALL_SEGMENTS.length; i++) {
      var w = WALL_SEGMENTS[i];
      var dist, along;
      if (w.type === 'h') {
        dist = Math.abs(basePos.z - w.val);
        along = basePos.x;
      } else {
        dist = Math.abs(basePos.x - w.val);
        along = basePos.z;
      }
      if (along >= w.min + halfWidth && along <= w.max - halfWidth && dist < bestDist) {
        bestDist = dist;
        bestWall = w;
      }
    }

    if (!bestWall) return { pos: basePos, rotY: 0, onWall: false };

    var result = basePos.clone();
    var rotY = 0;

    if (bestWall.type === 'h') {
      // Horizontal wall (constant z)
      if (basePos.z > bestWall.val) {
        // South side of wall — front (+z) faces into room
        result.z = bestWall.val + wallOffset;
        rotY = 0;
      } else {
        // North side of wall — front must face -z (into room)
        result.z = bestWall.val - wallOffset;
        rotY = Math.PI;
      }
      result.x = Math.max(bestWall.min + halfWidth, Math.min(bestWall.max - halfWidth, result.x));
    } else {
      // Vertical wall (constant x)
      if (basePos.x > bestWall.val) {
        // East side of wall — panel faces east (+x)
        result.x = bestWall.val + wallOffset;
        rotY = -Math.PI / 2;
      } else {
        // West side of wall — panel faces west (-x)
        result.x = bestWall.val - wallOffset;
        rotY = Math.PI / 2;
      }
      result.z = Math.max(bestWall.min + halfWidth, Math.min(bestWall.max - halfWidth, result.z));
    }

    result.y = 0;
    return { pos: result, rotY: rotY, onWall: true };
  }

  // --- Carried furniture update ---

  var canPlaceCurrent = false;

  function updateCarriedFurniture() {
    if (!carriedFurniture) return;

    if (carriedFurniture.wallMount) {
      var wallResult = getWallPlacementPosition();
      var pos = wallResult.pos;
      carriedFurniture.group.position.set(pos.x, carriedOriginY, pos.z);
      carriedFurniture.group.rotation.y = wallResult.rotY;
      carriedFurniture.collisionBox.position.set(pos.x, carriedBoxY, pos.z);
      carriedFurniture.collisionBox.rotation.y = wallResult.rotY;
      canPlaceCurrent = wallResult.onWall && canPlaceAt(pos, carriedFurniture.type);
    } else {
      var pos = getPlacementPosition();
      carriedFurniture.group.position.set(pos.x, carriedOriginY, pos.z);
      carriedFurniture.collisionBox.position.set(pos.x, carriedBoxY, pos.z);
      canPlaceCurrent = canPlaceAt(pos, carriedFurniture.type);
    }

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
    var isFurnitureActive = Game.Interaction.isActive('furniture');

    // When shelf/panel module is active but has no meaningful interaction,
    // fall through to regular furniture handling so shelves/panels can be dragged
    var activeModName = Game.Interaction.getActive();
    var shelfPanelFallback = !isFurnitureActive && (
      ((activeModName === 'shelvesPlace' || activeModName === 'shelvesItems') &&
       !(Game.Shelves && Game.Shelves.hasInteraction()))
    );

    if (!isFurnitureActive && !shelfPanelFallback) {
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
      var wrenchEquipped = Game.Wrench && Game.Wrench.isEquipped && Game.Wrench.isEquipped();
      if (hoveredFurniture.type === 'bed' && wrenchEquipped) {
        var hp = (typeof hoveredFurniture.hp === 'number') ? hoveredFurniture.hp : BED_MAX_HP;
        if (hp <= 0) {
          hintEl.textContent = Game.Lang.t('wrench.hint.broken', [hp, BED_MAX_HP]);
        } else {
          hintEl.textContent = Game.Lang.t('wrench.hint.bedHp', [hp, BED_MAX_HP]);
        }
      } else {
        var typeName = FURNITURE_TYPES[hoveredFurniture.type] ? FURNITURE_TYPES[hoveredFurniture.type].name : '';
        hintEl.textContent = Game.Lang.t('furniture.hint.move', [typeName.toLowerCase()]);
      }
      hintEl.style.display = 'block';
    }
  }

  // --- Pick up ---

  function pickUpFurniture(item) {
    // Check canPickUp callback
    if (item.canPickUp && !item.canPickUp()) {
      Game.Inventory.showNotification(Game.Lang.t('notify.cannotMove'));
      return;
    }
    // Check slot occupied (only for types with patient slots)
    if (item.slot && item.slot.occupied) {
      Game.Inventory.showNotification(Game.Lang.t('notify.cannotMoveOccupied'));
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
      Game.Inventory.showNotification(Game.Lang.t('notify.cannotPlaceHere'));
      return;
    }

    var item = carriedFurniture;
    var targetPos;
    if (item.wallMount) {
      var wallResult = getWallPlacementPosition();
      targetPos = wallResult.pos;
      item.group.rotation.y = wallResult.rotY;
    } else {
      targetPos = getPlacementPosition();
    }

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
      Game.Inventory.showNotification(Game.Lang.t('notify.furnitureOutdoor', [name.toLowerCase()]), 'rgba(200, 150, 50, 0.85)');
    }

    carriedFurniture = null;
  }

  // --- Bed repair ---

  function completeBedRepair(item) {
    if (!item || item.type !== 'bed') return;
    item.hp = BED_MAX_HP;
    applyBedVisual(item);
    updateBedHpBarTexture(item);
    Game.Inventory.showNotification(Game.Lang.t('notify.bedRepaired'), 'rgba(34, 139, 34, 0.85)');
  }

  // --- Hold cancel ---

  function cancelHold() {
    eKeyHeld = false;
    eHoldTarget = null;
    eHoldMode = null;
    eHoldStartTime = 0;
    eHoldDuration = HOLD_DURATION;
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
    if (Game.Tutorial && Game.Tutorial.isActive() && !Game.Tutorial.isAllowed('furniture_interact')) return;

    if (carriedFurniture) {
      placeFurniture();
      return;
    }

    // Don't pickup if a module-specific interaction is active
    if (Game.Shelves && Game.Shelves.hasInteraction()) return;

    if (hoveredFurniture) {
      // Wrench + bed → repair hold
      var wrenchEquipped = Game.Wrench && Game.Wrench.isEquipped && Game.Wrench.isEquipped();
      if (wrenchEquipped && hoveredFurniture.type === 'bed') {
        eKeyHeld = true;
        eHoldStartTime = performance.now();
        eHoldTarget = hoveredFurniture;
        eHoldMode = 'repair';
        eHoldDuration = REPAIR_HOLD_DURATION;
        if (holdProgressEl) {
          holdProgressEl.style.strokeDashoffset = String(HOLD_CIRCUMFERENCE);
          holdProgressEl.parentElement.style.display = 'block';
        }
        return;
      }

      // Default: pickup hold
      eKeyHeld = true;
      eHoldStartTime = performance.now();
      eHoldTarget = hoveredFurniture;
      eHoldMode = 'pickup';
      eHoldDuration = HOLD_DURATION;
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
    if (carriedFurniture.wallMount) return; // rotation determined by wall
    e.preventDefault();
    var rotStep = Math.PI / 12; // 15 degrees per tick
    carriedFurniture.group.rotation.y += e.deltaY > 0 ? rotStep : -rotStep;
  }

  // --- Public API ---

  window.Game.Furniture = {
    TYPES: FURNITURE_TYPES,
    BED_MAX_HP: BED_MAX_HP,
    updateCarried: updateCarriedFurniture,

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
          frame: bm.frame || null,
          rail: bm.rail || null,
          frameMat: bm.frameMat || null,
          slot: { pos: new THREE.Vector3(), occupied: false },
          isIndoors: true,
          hp: BED_MAX_HP,
          cracks: null,
          brokenDebris: null,
          hpBar: null
        };
        updateSlotPosition(item);
        applyBedVisual(item);
        createBedHpBar(item);
        updateBedHpBarPosition(item);
        furnitureItems.push(item);
      }
      for (var j = 0; j < chairMeshes.length; j++) {
        var cm = chairMeshes[j];
        var chairItem = {
          type: 'chair',
          group: cm.group,
          collisionBox: cm.collisionBox,
          slot: { pos: new THREE.Vector3(), occupied: false },
          isIndoors: true
        };
        updateSlotPosition(chairItem);
        furnitureItems.push(chairItem);
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
        canPickUp: opts.canPickUp || null,
        wallMount: opts.wallMount || false
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
        frame: meshData.frame || null,
        rail: meshData.rail || null,
        frameMat: meshData.frameMat || null,
        slot: { pos: new THREE.Vector3(), occupied: false },
        isIndoors: false,
        hp: type === 'bed' ? BED_MAX_HP : undefined,
        cracks: null,
        brokenDebris: null,
        hpBar: null
      };
      updateSlotPosition(item);
      if (type === 'bed') {
        applyBedVisual(item);
        createBedHpBar(item);
        updateBedHpBarPosition(item);
      }
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
          var progress = Math.min((performance.now() - eHoldStartTime) / eHoldDuration, 1.0);
          if (holdProgressEl) {
            holdProgressEl.style.strokeDashoffset = String(HOLD_CIRCUMFERENCE * (1 - progress));
          }
          if (progress >= 1.0) {
            var target = eHoldTarget;
            var mode = eHoldMode;
            cancelHold();
            eWaitForRelease = true;
            if (mode === 'repair') {
              completeBedRepair(target);
            } else {
              pickUpFurniture(target);
            }
          }
        }
      }

      updateFurnitureInteraction();

      // Bed HP bars: visible only when wrench is equipped and controls are locked
      var wrenchOn = !!(Game.Wrench && Game.Wrench.isEquipped && Game.Wrench.isEquipped()) && controls.isLocked;
      for (var bi = 0; bi < furnitureItems.length; bi++) {
        var it = furnitureItems[bi];
        if (it.type !== 'bed' || !it.hpBar) continue;
        if (wrenchOn && it.isIndoors && it !== carriedFurniture) {
          updateBedHpBarPosition(it);
          it.hpBar.visible = true;
        } else {
          it.hpBar.visible = false;
        }
      }

      // Show carry hint
      if (carriedFurniture && controls.isLocked) {
        var typeName = FURNITURE_TYPES[carriedFurniture.type] ? FURNITURE_TYPES[carriedFurniture.type].name : '';
        hintEl.textContent = Game.Lang.t('furniture.hint.place', [typeName.toLowerCase()]);
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

    // --- Bed HP API ---

    decrementBedHp: function(slot) {
      var item = getBedItemBySlot(slot);
      if (!item) return;
      item.hp = Math.max(0, (typeof item.hp === 'number' ? item.hp : BED_MAX_HP) - 1);
      applyBedVisual(item);
      updateBedHpBarTexture(item);
    },

    repairBed: function(slot) {
      var item = getBedItemBySlot(slot);
      if (!item) return;
      item.hp = BED_MAX_HP;
      applyBedVisual(item);
      updateBedHpBarTexture(item);
    },

    isBedBroken: function(slot) {
      var item = getBedItemBySlot(slot);
      if (!item) return false;
      return (typeof item.hp === 'number' ? item.hp : BED_MAX_HP) <= 0;
    },

    getBedHp: function(slot) {
      var item = getBedItemBySlot(slot);
      if (!item) return BED_MAX_HP;
      return typeof item.hp === 'number' ? item.hp : BED_MAX_HP;
    },

    getBrokenBedCount: function() {
      var count = 0;
      for (var i = 0; i < furnitureItems.length; i++) {
        var it = furnitureItems[i];
        if (it.type === 'bed' && it.isIndoors && typeof it.hp === 'number' && it.hp <= 0) count++;
      }
      return count;
    },

    getBrokenBeds: function() {
      var result = [];
      for (var i = 0; i < furnitureItems.length; i++) {
        var it = furnitureItems[i];
        if (it.type === 'bed' && it.isIndoors && typeof it.hp === 'number' && it.hp <= 0) {
          result.push(it.slot);
        }
      }
      return result;
    }
  };
})();
