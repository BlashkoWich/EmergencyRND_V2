(function() {
  window.Game = window.Game || {};

  window.Game.World = {
    setup: function(THREE, scene, collidables) {
      var H = Game.Helpers;

      // === BUILDING: 22 wide (x: -11..11), 24 deep (z: -24..0) ===
      // South half houses reception + cashier + waiting chairs.
      // North half houses the 6 wards (14 beds total).
      var BW = 22, BD = 24;
      var BX1 = -BW / 2, BX2 = BW / 2; // -11, 11
      var BZ1 = -BD, BZ2 = 0;           // -24, 0

      // --- Indoor floor (tile) ---
      var indoorFloor = new THREE.Mesh(
        new THREE.BoxGeometry(BW, 0.1, BD),
        new THREE.MeshLambertMaterial({ map: H.createTileTexture(THREE) })
      );
      indoorFloor.position.set(0, -0.05, -BD / 2);
      indoorFloor.receiveShadow = true;
      scene.add(indoorFloor);
      collidables.push(indoorFloor);

      // --- Outdoor ground: asphalt sidewalk ---
      var sidewalk = new THREE.Mesh(
        new THREE.BoxGeometry(60, 0.1, 60),
        new THREE.MeshLambertMaterial({ map: H.createAsphaltTexture(THREE) })
      );
      sidewalk.position.set(0, -0.06, 24);
      sidewalk.receiveShadow = true;
      scene.add(sidewalk);
      collidables.push(sidewalk);

      // --- Grass areas ---
      var grassMat = new THREE.MeshLambertMaterial({ map: H.createGrassTexture(THREE) });
      var grassL = new THREE.Mesh(new THREE.BoxGeometry(20, 0.1, 40), grassMat);
      grassL.position.set(-22, -0.04, 20); grassL.receiveShadow = true; scene.add(grassL); collidables.push(grassL);
      var grassR = new THREE.Mesh(new THREE.BoxGeometry(20, 0.1, 40), grassMat);
      grassR.position.set(22, -0.04, 20); grassR.receiveShadow = true; scene.add(grassR); collidables.push(grassR);
      // Back of the building (z < -24)
      var grassBack = new THREE.Mesh(new THREE.BoxGeometry(60, 0.1, 24), grassMat);
      grassBack.position.set(0, -0.04, -36); grassBack.receiveShadow = true; scene.add(grassBack); collidables.push(grassBack);
      // Strip along west side of building (south portion, outside delivery pad)
      var grassWestSide = new THREE.Mesh(new THREE.BoxGeometry(9, 0.1, 7.3), grassMat);
      grassWestSide.position.set(-15.5, -0.04, -3.65); grassWestSide.receiveShadow = true; scene.add(grassWestSide); collidables.push(grassWestSide);
      // Strip along east side of building
      var grassEastSide = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 24), grassMat);
      grassEastSide.position.set(12, -0.04, -12); grassEastSide.receiveShadow = true; scene.add(grassEastSide); collidables.push(grassEastSide);
      // Fill west gap between grassL and delivery zone
      var grassWestMid = new THREE.Mesh(new THREE.BoxGeometry(14, 0.1, 12), grassMat);
      grassWestMid.position.set(-26, -0.04, -6); grassWestMid.receiveShadow = true; scene.add(grassWestMid); collidables.push(grassWestMid);
      // Fill west mid-north strip (between delivery pad and back grass)
      var grassWestNorth = new THREE.Mesh(new THREE.BoxGeometry(22, 0.1, 10), grassMat);
      grassWestNorth.position.set(-22, -0.04, -19); grassWestNorth.receiveShadow = true; scene.add(grassWestNorth); collidables.push(grassWestNorth);
      // Fill east gap between grassR and building strip
      var grassEastMid = new THREE.Mesh(new THREE.BoxGeometry(20, 0.1, 24), grassMat);
      grassEastMid.position.set(23, -0.04, -12); grassEastMid.receiveShadow = true; scene.add(grassEastMid); collidables.push(grassEastMid);

      // --- Ceiling (only over building) ---
      var ceilMesh = new THREE.Mesh(
        new THREE.BoxGeometry(BW, 0.1, BD),
        new THREE.MeshLambertMaterial({ color: 0xf5f5f5 })
      );
      ceilMesh.position.set(0, 3.05, -BD / 2);
      ceilMesh.receiveShadow = true;
      scene.add(ceilMesh);
      collidables.push(ceilMesh);

      // --- Building walls (with window openings cut out) ---
      var T = 0.2;
      var WIN_W = 1.4, WIN_H = 1.0, WIN_Y = 1.7;
      var winBottomH = WIN_Y - WIN_H / 2;
      var winTopH = 3.0 - (WIN_Y + WIN_H / 2);
      function createWallSegments(isHorizontal, axisVal, min, max, windows) {
        var fullLen = max - min;
        var fullCenter = (min + max) / 2;
        if (isHorizontal) {
          H.createWall(THREE, scene, collidables, fullCenter, axisVal, fullLen, T, { h: winBottomH, y: winBottomH / 2 });
        } else {
          H.createWall(THREE, scene, collidables, axisVal, fullCenter, T, fullLen, { h: winBottomH, y: winBottomH / 2 });
        }
        if (isHorizontal) {
          H.createWall(THREE, scene, collidables, fullCenter, axisVal, fullLen, T, { h: winTopH, y: 3.0 - winTopH / 2 });
        } else {
          H.createWall(THREE, scene, collidables, axisVal, fullCenter, T, fullLen, { h: winTopH, y: 3.0 - winTopH / 2 });
        }
        var sorted = windows.slice().sort(function(a, b) { return a.center - b.center; });
        var cursor = min;
        for (var i = 0; i < sorted.length; i++) {
          var wStart = sorted[i].center - sorted[i].width / 2;
          var wEnd = sorted[i].center + sorted[i].width / 2;
          if (wStart > cursor + 0.001) {
            var segLen = wStart - cursor;
            var segCenter = (cursor + wStart) / 2;
            if (isHorizontal) {
              H.createWall(THREE, scene, collidables, segCenter, axisVal, segLen, T, { h: WIN_H, y: WIN_Y });
            } else {
              H.createWall(THREE, scene, collidables, axisVal, segCenter, T, segLen, { h: WIN_H, y: WIN_Y });
            }
          }
          cursor = wEnd;
        }
        if (max > cursor + 0.001) {
          var tailLen = max - cursor;
          var tailCenter = (cursor + max) / 2;
          if (isHorizontal) {
            H.createWall(THREE, scene, collidables, tailCenter, axisVal, tailLen, T, { h: WIN_H, y: WIN_Y });
          } else {
            H.createWall(THREE, scene, collidables, axisVal, tailCenter, T, tailLen, { h: WIN_H, y: WIN_Y });
          }
        }
      }
      // North wall (z=-24, x: -11..11) — 3 windows
      createWallSegments(true, BZ1, BX1 - T / 2, BX2 + T / 2, [
        { center: -6, width: WIN_W },
        { center: 0, width: WIN_W },
        { center: 6, width: WIN_W }
      ]);
      // West wall — side door at z: -12..-9.6
      var westDoorZ1 = -12;
      var westDoorZ2 = -9.6;
      // North segment (z: -24..-12) — 2 windows
      createWallSegments(false, BX1, BZ1, westDoorZ1, [
        { center: -20, width: WIN_W },
        { center: -15, width: WIN_W }
      ]);
      // South segment (z: -9.6..0) — 2 windows
      createWallSegments(false, BX1, westDoorZ2, BZ2, [
        { center: -8, width: WIN_W },
        { center: -4, width: WIN_W }
      ]);
      // Lintel above side door
      var westDoorWidth = Math.abs(westDoorZ1 - westDoorZ2);
      H.createWall(THREE, scene, collidables, BX1, (westDoorZ1 + westDoorZ2) / 2, T, westDoorWidth, { h: 0.5, y: 2.75 });
      // Side door frame posts
      var westFrameMat = new THREE.MeshLambertMaterial({ color: 0x99a8b8 });
      var westPostN = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3, 0.08), westFrameMat);
      westPostN.position.set(BX1, 1.5, westDoorZ1); scene.add(westPostN); collidables.push(westPostN);
      var westPostS = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3, 0.08), westFrameMat);
      westPostS.position.set(BX1, 1.5, westDoorZ2); scene.add(westPostS); collidables.push(westPostS);
      // East wall (x=11) — 4 windows
      createWallSegments(false, BX2, BZ1, BZ2, [
        { center: -20, width: WIN_W },
        { center: -15, width: WIN_W },
        { center: -10, width: WIN_W },
        { center: -5, width: WIN_W }
      ]);
      // South wall — entrance gap (x: -1.2..1.2), 1 window each side
      var doorHalf = 1.2;
      createWallSegments(true, BZ2, BX1, -doorHalf, [{ center: -6, width: WIN_W }]);
      createWallSegments(true, BZ2, doorHalf, BX2, [{ center: 6, width: WIN_W }]);
      H.createWall(THREE, scene, collidables, 0, BZ2, doorHalf * 2, T, { h: 0.5, y: 2.75 });

      // Door frame posts
      var frameMat = new THREE.MeshLambertMaterial({ color: 0x99a8b8 });
      for (var i = 0; i < 2; i++) {
        var dx = i === 0 ? -doorHalf : doorHalf;
        var post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3, 0.25), frameMat);
        post.position.set(dx, 1.5, BZ2); scene.add(post); collidables.push(post);
      }

      // --- Entrance sign ---
      H.createSign(THREE, scene, Game.Lang.t('sign.clinic'), 0, 2.3, BZ2 + 0.15, 0);

      // === FURNITURE — SOUTH HALF (reception + waiting + cashier) ===

      // --- Reception desk ---
      var deskMat = new THREE.MeshLambertMaterial({ color: 0x6688aa });
      var deskPanelMat = new THREE.MeshLambertMaterial({ color: 0x557799 });

      var deskTop = new THREE.Mesh(new THREE.BoxGeometry(3, 0.08, 1.0), deskMat);
      deskTop.position.set(0, 1.0, -9.0); deskTop.castShadow = true; scene.add(deskTop); collidables.push(deskTop);

      var deskFront = new THREE.Mesh(new THREE.BoxGeometry(3, 1.0, 0.08), deskPanelMat);
      deskFront.position.set(0, 0.5, -8.5); deskFront.castShadow = true; scene.add(deskFront); collidables.push(deskFront);

      var deskBack = new THREE.Mesh(new THREE.BoxGeometry(3, 1.0, 0.08), deskPanelMat);
      deskBack.position.set(0, 0.5, -9.5); deskBack.castShadow = true; scene.add(deskBack); collidables.push(deskBack);

      var deskSide1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 1.0), deskPanelMat);
      deskSide1.position.set(-1.5, 0.5, -9.0); scene.add(deskSide1); collidables.push(deskSide1);
      var deskSide2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 1.0), deskPanelMat);
      deskSide2.position.set(1.5, 0.5, -9.0); scene.add(deskSide2); collidables.push(deskSide2);

      // --- 3 Waiting Chairs (east side) ---
      var chairMat = new THREE.MeshLambertMaterial({ color: 0x3366aa });
      var chairLegMat = new THREE.MeshLambertMaterial({ color: 0x888888 });

      var chairMeshes = [];
      function createChair(x, z, rotY, skipRegister) {
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
        box.position.set(x, 0.5, z); scene.add(box); collidables.push(box);
        if (!skipRegister) {
          chairMeshes.push({ group: g, collisionBox: box });
        }
        return { group: g, collisionBox: box };
      }

      createChair(9.5, -2, -Math.PI / 2);
      createChair(9.5, -3.2, -Math.PI / 2);
      createChair(9.5, -4.4, -Math.PI / 2);

      H.createSign(THREE, scene, Game.Lang.t('sign.waitingArea'), 10.88, 2.5, -3.2, -Math.PI / 2);

      // === WARDS — NORTH HALF (14 beds across 6 wards) ===

      // Medical bed constructor (body 2.0 wide on X, 0.9 deep on Z).
      var mattressMat = new THREE.MeshLambertMaterial({ color: 0x88bbaa });
      var pillowMat = new THREE.MeshLambertMaterial({ color: 0xddeedd });
      function createBed(x, z, rotY) {
        var frameMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
        var g = new THREE.Group();
        var frame = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 0.9), frameMat);
        frame.position.y = 0.25; frame.castShadow = true; g.add(frame);
        var matt = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.8), mattressMat);
        matt.position.y = 0.56; matt.castShadow = true; g.add(matt);
        var pillow = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.1, 0.55), pillowMat);
        pillow.position.set(-0.7, 0.65, 0); g.add(pillow);
        var rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.9), frameMat);
        rail.position.set(-1.0, 0.7, 0); g.add(rail);
        g.position.set(x, 0, z);
        g.rotation.y = rotY || 0;
        scene.add(g);
        var box = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.0, 1.0), new THREE.MeshBasicMaterial({ visible: false }));
        box.position.set(x, 0.5, z); scene.add(box); collidables.push(box);
        return { group: g, collisionBox: box, frame: frame, rail: rail, frameMat: frameMat };
      }

      // Floor-tile zone (coloured overlay) — slight y offset, no collision.
      function createWardFloor(xMin, xMax, zMin, zMax, color) {
        var w = xMax - xMin, d = zMax - zMin;
        var mat = new THREE.MeshLambertMaterial({ color: color, transparent: true, opacity: 0.55 });
        var tile = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), mat);
        tile.position.set((xMin + xMax) / 2, 0.01, (zMin + zMax) / 2);
        tile.receiveShadow = true;
        scene.add(tile);
        return tile;
      }

      // Ward zone colours (subtle tint so they read as distinct rooms).
      var WARD_COLORS = {
        easy:     0x88cc88, // green
        easyPlus: 0x66bb99,
        medium:   0xccbb55, // amber
        hard:     0xcc6666, // red
        hardPlus: 0xbb5599,
        vip:      0xd4af37  // gold
      };

      // Helper: beds built with rotY=0 → headboard (rail) at bed.x-1, patient at bed.x+1.
      // Beds built with rotY=π → headboard at bed.x+1, patient at bed.x-1.
      var wards = {
        easy: { slots: [] },
        easyPlus: { slots: [] },
        medium: { slots: [] },
        hard: { slots: [] },
        hardPlus: { slots: [] },
        vip: { slots: [] }
      };

      // West column: easy (north 3 beds) + easyPlus (south 2 beds), rotY=0 (head west).
      createWardFloor(-10.5, -6, -23, -17, WARD_COLORS.easy);
      createBed(-9, -22, 0); wards.easy.slots.push({ pos: new THREE.Vector3(-8, 0, -22), occupied: false });
      createBed(-9, -20, 0); wards.easy.slots.push({ pos: new THREE.Vector3(-8, 0, -20), occupied: false });
      createBed(-9, -18, 0); wards.easy.slots.push({ pos: new THREE.Vector3(-8, 0, -18), occupied: false });

      createWardFloor(-10.5, -6, -17, -12.5, WARD_COLORS.easyPlus);
      createBed(-9, -16, 0); wards.easyPlus.slots.push({ pos: new THREE.Vector3(-8, 0, -16), occupied: false });
      createBed(-9, -14, 0); wards.easyPlus.slots.push({ pos: new THREE.Vector3(-8, 0, -14), occupied: false });

      // Center column: medium (north 3 beds) + vip (south 1 bed), rotY=0.
      createWardFloor(-3.5, 1, -23, -17, WARD_COLORS.medium);
      createBed(-2, -22, 0); wards.medium.slots.push({ pos: new THREE.Vector3(-1, 0, -22), occupied: false });
      createBed(-2, -20, 0); wards.medium.slots.push({ pos: new THREE.Vector3(-1, 0, -20), occupied: false });
      createBed(-2, -18, 0); wards.medium.slots.push({ pos: new THREE.Vector3(-1, 0, -18), occupied: false });

      createWardFloor(-3.5, 1, -16, -12.5, WARD_COLORS.vip);
      createBed(-2, -14, 0); wards.vip.slots.push({ pos: new THREE.Vector3(-1, 0, -14), occupied: false });

      // East column: hard (north 3 beds) + hardPlus (south 2 beds), rotY=π (head east).
      createWardFloor(5.5, 10.5, -23, -17, WARD_COLORS.hard);
      createBed(9, -22, Math.PI); wards.hard.slots.push({ pos: new THREE.Vector3(8, 0, -22), occupied: false });
      createBed(9, -20, Math.PI); wards.hard.slots.push({ pos: new THREE.Vector3(8, 0, -20), occupied: false });
      createBed(9, -18, Math.PI); wards.hard.slots.push({ pos: new THREE.Vector3(8, 0, -18), occupied: false });

      createWardFloor(5.5, 10.5, -17, -12.5, WARD_COLORS.hardPlus);
      createBed(9, -16, Math.PI); wards.hardPlus.slots.push({ pos: new THREE.Vector3(8, 0, -16), occupied: false });
      createBed(9, -14, Math.PI); wards.hardPlus.slots.push({ pos: new THREE.Vector3(8, 0, -14), occupied: false });

      // --- Ward signs (mounted on walls, per memory: signs_on_walls) ---
      // West wall (x=-11), facing east (into the hall): easy (z=-20), easyPlus (z=-15).
      H.createSign(THREE, scene, Game.Lang.t('sign.ward.easy'), BX1 + 0.12, 2.5, -20, Math.PI / 2);
      H.createSign(THREE, scene, Game.Lang.t('sign.ward.easyPlus'), BX1 + 0.12, 2.5, -15, Math.PI / 2);

      // East wall (x=11), facing west: hard (z=-20), hardPlus (z=-16), vip (z=-14).
      H.createSign(THREE, scene, Game.Lang.t('sign.ward.hard'), BX2 - 0.12, 2.5, -20, -Math.PI / 2);
      H.createSign(THREE, scene, Game.Lang.t('sign.ward.hardPlus'), BX2 - 0.12, 2.5, -16, -Math.PI / 2);

      // North wall (z=-24): medium sign (above medium zone).
      H.createSign(THREE, scene, Game.Lang.t('sign.ward.medium'), -1, 2.5, BZ1 + 0.12, 0);

      // VIP decorative divider stub wall (x=2, z=-16..-12.5) — houses VIP sign facing west.
      var vipDivMat = new THREE.MeshLambertMaterial({ color: 0xd4af37 });
      var vipDividerH = 1.8;
      var vipDivider = new THREE.Mesh(new THREE.BoxGeometry(0.12, vipDividerH, 3.5), vipDivMat);
      vipDivider.position.set(2, vipDividerH / 2, -14.25); vipDivider.castShadow = true;
      scene.add(vipDivider); collidables.push(vipDivider);
      H.createSign(THREE, scene, Game.Lang.t('sign.ward.vip'), 2 - 0.08, 2.5, -14.25, -Math.PI / 2);

      // --- Reception & delivery-zone signs ---
      H.createSign(THREE, scene, Game.Lang.t('sign.deliveryZone'), BX1 + 0.12, 2.5, -10.8, Math.PI / 2);

      // === OUTDOOR ENVIRONMENT ===

      // --- Asphalt pad outside west side door (for delivery zone) ---
      var westPad = new THREE.Mesh(
        new THREE.BoxGeometry(8, 0.1, 6),
        new THREE.MeshLambertMaterial({ map: H.createAsphaltTexture(THREE) })
      );
      westPad.position.set(-15, -0.055, -10.3);
      westPad.receiveShadow = true;
      scene.add(westPad);
      collidables.push(westPad);

      // --- Trees ---
      var trunkMat = new THREE.MeshLambertMaterial({ color: 0x8B5A2B });
      var leafMat = new THREE.MeshLambertMaterial({ color: 0x3a7a2a });
      function createTree(x, z) {
        var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 2.5, 8), trunkMat);
        trunk.position.set(x, 1.25, z); trunk.castShadow = true; scene.add(trunk);
        var crown = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 10), leafMat);
        crown.position.set(x, 3.5, z); crown.castShadow = true; scene.add(crown);
        var col = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.5, 8), new THREE.MeshBasicMaterial({ visible: false }));
        col.position.set(x, 1.25, z); scene.add(col); collidables.push(col);
      }
      createTree(-7, 4);
      createTree(7, 4);
      createTree(-14, 8);
      createTree(14, 8);
      createTree(-10, 15);
      createTree(10, 15);
      // Behind the building (north wall now at z=-24)
      createTree(-8, -30);
      createTree(8, -30);
      createTree(-16, -30);
      createTree(16, -30);
      // East side
      createTree(16, -4);
      createTree(17, -16);
      // West side
      createTree(-22, -4);

      // --- Benches ---
      var benchMat = new THREE.MeshLambertMaterial({ color: 0x8B6F47 });
      var benchLegMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
      function createBench(x, z, rotY) {
        var g = new THREE.Group();
        var seat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.45), benchMat);
        seat.position.y = 0.45; seat.castShadow = true; g.add(seat);
        var back = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 0.06), benchMat);
        back.position.set(0, 0.73, -0.2); back.castShadow = true; g.add(back);
        for (var i = 0; i < 2; i++) {
          var lx = i === 0 ? -0.6 : 0.6;
          var leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.45), benchLegMat);
          leg.position.set(lx, 0.225, 0); g.add(leg);
        }
        g.position.set(x, 0, z);
        g.rotation.y = rotY || 0;
        scene.add(g);
        var box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.6), new THREE.MeshBasicMaterial({ visible: false }));
        box.position.set(x, 0.5, z); scene.add(box); collidables.push(box);
      }
      createBench(4, 2, 0);
      createBench(-4, 2, 0);

      // --- Windows (decorative panes) ---
      var windowFrameMat = new THREE.MeshLambertMaterial({ color: 0x556677 });
      var windowGlassMat = new THREE.MeshLambertMaterial({
        color: 0xaaccee,
        emissive: 0x334466,
        emissiveIntensity: 0.15,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide
      });
      function createWindow(x, y, z, rotY) {
        var w = 1.4, h = 1.0;
        var g = new THREE.Group();
        var top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.08, 0.28), windowFrameMat);
        top.position.set(0, h / 2, 0); g.add(top);
        var sill = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.06, 0.30), windowFrameMat);
        sill.position.set(0, -h / 2, 0); g.add(sill);
        var left = new THREE.Mesh(new THREE.BoxGeometry(0.08, h, 0.28), windowFrameMat);
        left.position.set(-w / 2, 0, 0); g.add(left);
        var right = new THREE.Mesh(new THREE.BoxGeometry(0.08, h, 0.28), windowFrameMat);
        right.position.set(w / 2, 0, 0); g.add(right);
        var horiz = new THREE.Mesh(new THREE.BoxGeometry(w - 0.08, 0.05, 0.22), windowFrameMat);
        horiz.position.set(0, 0, 0); g.add(horiz);
        var vert = new THREE.Mesh(new THREE.BoxGeometry(0.05, h - 0.08, 0.22), windowFrameMat);
        vert.position.set(0, 0, 0); g.add(vert);
        var glassGeo = new THREE.PlaneGeometry(w - 0.1, h - 0.1);
        var glassOuter = new THREE.Mesh(glassGeo, windowGlassMat);
        glassOuter.position.set(0, 0, 0.12); g.add(glassOuter);
        var glassInner = new THREE.Mesh(glassGeo, windowGlassMat);
        glassInner.position.set(0, 0, -0.12); g.add(glassInner);
        g.position.set(x, y, z);
        g.rotation.y = rotY || 0;
        scene.add(g);
      }
      // North wall (z=-24) — 3 windows at x=-6, 0, 6
      createWindow(-6, 1.7, BZ1, 0);
      createWindow(0, 1.7, BZ1, 0);
      createWindow(6, 1.7, BZ1, 0);
      // East wall (x=11) — 4 windows
      createWindow(BX2, 1.7, -5, -Math.PI / 2);
      createWindow(BX2, 1.7, -10, -Math.PI / 2);
      createWindow(BX2, 1.7, -15, -Math.PI / 2);
      createWindow(BX2, 1.7, -20, -Math.PI / 2);
      // West wall (x=-11) — 4 windows
      createWindow(BX1, 1.7, -4, Math.PI / 2);
      createWindow(BX1, 1.7, -8, Math.PI / 2);
      createWindow(BX1, 1.7, -15, Math.PI / 2);
      createWindow(BX1, 1.7, -20, Math.PI / 2);
      // South wall (z=0) — flanking entrance
      createWindow(-6, 1.7, 0, Math.PI);
      createWindow(6, 1.7, 0, Math.PI);

      // === LIGHTING ===

      var hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x556633, 0.6);
      scene.add(hemiLight);

      var sunLight = new THREE.DirectionalLight(0xfff5e0, 1.2);
      sunLight.position.set(10, 18, 5);
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.width = 1024;
      sunLight.shadow.mapSize.height = 1024;
      sunLight.shadow.camera.left = -18;
      sunLight.shadow.camera.right = 18;
      sunLight.shadow.camera.top = 4;
      sunLight.shadow.camera.bottom = -28;
      sunLight.shadow.camera.near = 1;
      sunLight.shadow.camera.far = 55;
      scene.add(sunLight);

      scene.add(new THREE.AmbientLight(0xffffff, 0.3));

      var fixtureGeo = new THREE.BoxGeometry(0.9, 0.04, 0.3);
      var fixtureMat = new THREE.MeshLambertMaterial({
        color: 0xffffff, emissive: 0xeef4ff, emissiveIntensity: 0.8
      });

      function addLight(x, z, intensity) {
        var light = new THREE.PointLight(0xf0f5ff, intensity, 12);
        light.position.set(x, 2.9, z);
        scene.add(light);
        var fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
        fixture.position.set(x, 2.98, z);
        scene.add(fixture);
      }

      for (var x = -8; x <= 8; x += 4) {
        for (var z = -22; z <= -2; z += 4) {
          addLight(x, z, 0.8);
        }
      }

      // --- Self-service checkout (right of exit) ---
      var cashierDeskGroup = new THREE.Group();

      var baseMat = new THREE.MeshLambertMaterial({ color: 0x5a5a60 });
      var baseCabinet = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.5), baseMat);
      baseCabinet.position.set(0, 0.45, 0); baseCabinet.castShadow = true; cashierDeskGroup.add(baseCabinet);

      var panelMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
      var topPanel = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.08), panelMat);
      topPanel.position.set(0, 1.15, -0.05);
      topPanel.rotation.x = -0.3;
      topPanel.castShadow = true;
      cashierDeskGroup.add(topPanel);

      var screenMat = new THREE.MeshLambertMaterial({ color: 0x1a3a1a, emissive: 0x0a3a0a, emissiveIntensity: 0.6 });
      var lcdScreen = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 0.005), screenMat);
      lcdScreen.position.set(0, 1.15, 0);
      lcdScreen.rotation.x = -0.3;
      lcdScreen.position.z += Math.sin(0.3) * 0.04;
      lcdScreen.position.y += Math.cos(0.3) * 0.04 - 0.04;
      cashierDeskGroup.add(lcdScreen);

      var cardReaderMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
      var cardReader = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.06), cardReaderMat);
      cardReader.position.set(0, 0.92, 0.15);
      cashierDeskGroup.add(cardReader);

      var receiptMat = new THREE.MeshLambertMaterial({ color: 0xf5f5f0 });
      var receiptSlot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.015, 0.04), receiptMat);
      receiptSlot.position.set(0, 0.92, 0.23);
      cashierDeskGroup.add(receiptSlot);

      cashierDeskGroup.position.set(-3.5, 0, -1.5);
      cashierDeskGroup.rotation.y = Math.PI;
      scene.add(cashierDeskGroup);

      var cashierTableBox = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.6), new THREE.MeshBasicMaterial({ visible: false }));
      cashierTableBox.position.set(-3.5, 0.45, -1.5); scene.add(cashierTableBox); collidables.push(cashierTableBox);

      // Wall-mounted signs (memory: signs_on_walls)
      H.createSign(THREE, scene, Game.Lang.t('sign.selfService'), -3.5, 2.5, -0.11, Math.PI);
      H.createSign(THREE, scene, Game.Lang.t('sign.reception'), 0, 2.5, -9.0 - 0.45, 0);

      return {
        wards: wards,
        waitingChairs: [
          { pos: new THREE.Vector3(8.5, 0, -2), occupied: false },
          { pos: new THREE.Vector3(8.5, 0, -3.2), occupied: false },
          { pos: new THREE.Vector3(8.5, 0, -4.4), occupied: false }
        ],
        chairMeshes: chairMeshes,
        cashierDesk: {
          group: cashierDeskGroup,
          collisionBox: cashierTableBox,
          terminalMeshes: [baseCabinet, topPanel, lcdScreen, cardReader, receiptSlot],
          patientPos: new THREE.Vector3(-3.5, 0, -2.5)
        },
        sunLight: sunLight
      };
    }
  };
})();
