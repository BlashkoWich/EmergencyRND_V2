(function() {
  window.Game = window.Game || {};

  window.Game.World = {
    setup: function(THREE, scene, collidables) {
      var H = Game.Helpers;

      // === BUILDING: 16 wide (x: -8..8), 12 deep (z: -12..0) ===
      var BW = 16, BD = 12;
      var BX1 = -BW / 2, BX2 = BW / 2; // -8, 8
      var BZ1 = -BD, BZ2 = 0;           // -12, 0

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
      grassL.position.set(-20, -0.04, 20); grassL.receiveShadow = true; scene.add(grassL); collidables.push(grassL);
      var grassR = new THREE.Mesh(new THREE.BoxGeometry(20, 0.1, 40), grassMat);
      grassR.position.set(20, -0.04, 20); grassR.receiveShadow = true; scene.add(grassR); collidables.push(grassR);
      // Back of the building (z < -12)
      var grassBack = new THREE.Mesh(new THREE.BoxGeometry(60, 0.1, 24), grassMat);
      grassBack.position.set(0, -0.04, -24); grassBack.receiveShadow = true; scene.add(grassBack); collidables.push(grassBack);
      // Strip along west side of building (between entrance and delivery pad south edge)
      var grassWestSide = new THREE.Mesh(new THREE.BoxGeometry(8, 0.1, 7.3), grassMat);
      grassWestSide.position.set(-12, -0.04, -3.65); grassWestSide.receiveShadow = true; scene.add(grassWestSide); collidables.push(grassWestSide);
      // Strip along east side of building
      var grassEastSide = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 12), grassMat);
      grassEastSide.position.set(9, -0.04, -6); grassEastSide.receiveShadow = true; scene.add(grassEastSide); collidables.push(grassEastSide);
      // Fill west gap between grassL and delivery zone (avoids overlap with delivery pad at x=-16..-8)
      var grassWestMid = new THREE.Mesh(new THREE.BoxGeometry(14, 0.1, 12), grassMat);
      grassWestMid.position.set(-23, -0.04, -6); grassWestMid.receiveShadow = true; scene.add(grassWestMid); collidables.push(grassWestMid);
      // Fill east gap between grassR and building strip
      var grassEastMid = new THREE.Mesh(new THREE.BoxGeometry(20, 0.1, 12), grassMat);
      grassEastMid.position.set(20, -0.04, -6); grassEastMid.receiveShadow = true; scene.add(grassEastMid); collidables.push(grassEastMid);

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
      var WIN_W = 1.4, WIN_H = 1.0, WIN_Y = 1.7; // window dims (centered at y=1.7)
      var winBottomH = WIN_Y - WIN_H / 2;        // 1.2
      var winTopH = 3.0 - (WIN_Y + WIN_H / 2);    // 0.8
      // isHorizontal: wall runs along x (constant z = axisVal); else runs along z (constant x = axisVal)
      // windows: [{center, width}] along the running axis
      function createWallSegments(isHorizontal, axisVal, min, max, windows) {
        var fullLen = max - min;
        var fullCenter = (min + max) / 2;
        // Bottom strip (full length, h=1.2)
        if (isHorizontal) {
          H.createWall(THREE, scene, collidables, fullCenter, axisVal, fullLen, T, { h: winBottomH, y: winBottomH / 2 });
        } else {
          H.createWall(THREE, scene, collidables, axisVal, fullCenter, T, fullLen, { h: winBottomH, y: winBottomH / 2 });
        }
        // Top strip (full length, h=0.8)
        if (isHorizontal) {
          H.createWall(THREE, scene, collidables, fullCenter, axisVal, fullLen, T, { h: winTopH, y: 3.0 - winTopH / 2 });
        } else {
          H.createWall(THREE, scene, collidables, axisVal, fullCenter, T, fullLen, { h: winTopH, y: 3.0 - winTopH / 2 });
        }
        // Middle band (h=1.0 at y=1.7) — broken into segments between windows
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
      // North wall (z=-12, x: -8.1..8.1) — 2 windows
      createWallSegments(true, BZ1, BX1 - T / 2, BX2 + T / 2, [
        { center: -2.5, width: WIN_W },
        { center: 3.5, width: WIN_W }
      ]);
      // West wall (x=-8, z: -9.6..0) — 2 windows (south of side door gap)
      var westDoorZ2 = -9.6;
      var westWallLen = BZ2 - westDoorZ2; // 9.6
      createWallSegments(false, BX1, westDoorZ2, BZ2, [
        { center: -8, width: WIN_W },
        { center: -4, width: WIN_W }
      ]);
      // Lintel above side door
      var westDoorWidth = BZ1 - westDoorZ2; // abs 2.4
      H.createWall(THREE, scene, collidables, BX1, (BZ1 + westDoorZ2) / 2, T, Math.abs(westDoorWidth), { h: 0.5, y: 2.75 });
      // Side door frame post (south side of gap)
      var westFrameMat = new THREE.MeshLambertMaterial({ color: 0x99a8b8 });
      var westPost = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3, 0.08), westFrameMat);
      westPost.position.set(BX1, 1.5, westDoorZ2); scene.add(westPost); collidables.push(westPost);
      // East wall (x=8, z: -12..0) — 2 windows
      createWallSegments(false, BX2, BZ1, BZ2, [
        { center: -10, width: WIN_W },
        { center: -7, width: WIN_W }
      ]);
      // South wall — two segments with entrance gap (x: -1.2..1.2), each with 1 window
      var doorHalf = 1.2;
      createWallSegments(true, BZ2, BX1, -doorHalf, [{ center: -6, width: WIN_W }]);
      createWallSegments(true, BZ2, doorHalf, BX2, [{ center: 6, width: WIN_W }]);
      H.createWall(THREE, scene, collidables, 0, BZ2, doorHalf * 2, T, { h: 0.5, y: 2.75 }); // Entrance lintel

      // Door frame posts
      var frameMat = new THREE.MeshLambertMaterial({ color: 0x99a8b8 });
      for (var i = 0; i < 2; i++) {
        var dx = i === 0 ? -doorHalf : doorHalf;
        var post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3, 0.25), frameMat);
        post.position.set(dx, 1.5, BZ2); scene.add(post); collidables.push(post);
      }

      // --- Entrance sign ---
      H.createSign(THREE, scene, Game.Lang.t('sign.clinic'), 0, 2.3, BZ2 + 0.15, 0);

      // === FURNITURE ===

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

      // --- 3 Chairs (waiting area, along east wall) ---
      var chairMat = new THREE.MeshLambertMaterial({ color: 0x3366aa });
      var chairLegMat = new THREE.MeshLambertMaterial({ color: 0x888888 });

      var chairMeshes = [];
      function createChair(x, z, rotY) {
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
        chairMeshes.push({ group: g, collisionBox: box });
      }

      createChair(6.5, -2, -Math.PI / 2);
      createChair(6.5, -3.2, -Math.PI / 2);
      createChair(6.5, -4.4, -Math.PI / 2);

      H.createSign(THREE, scene, Game.Lang.t('sign.waitingArea'), 7.88, 2.5, -3.2, -Math.PI / 2);

      // --- 4 Medical beds ---
      var bedFrameMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
      var mattressMat = new THREE.MeshLambertMaterial({ color: 0x88bbaa });
      var pillowMat = new THREE.MeshLambertMaterial({ color: 0xddeedd });

      var bedMeshes = [];
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
        bedMeshes.push({ group: g, collisionBox: box, frame: frame, rail: rail, frameMat: frameMat });
      }

      createBed(-5.5, -9, 0);
      createBed(-5.5, -7, 0);
      createBed(-5.5, -5, 0);

      H.createSign(THREE, scene, Game.Lang.t('sign.examination'), -7.88, 2.5, -6, Math.PI / 2);
      // Sign above side door (interior, on remaining west wall near door edge)
      H.createSign(THREE, scene, Game.Lang.t('sign.deliveryZone'), -7.88, 2.5, -9.4, Math.PI / 2);

      // === OUTDOOR ENVIRONMENT ===

      // --- Asphalt pad outside west side door (for delivery zone) ---
      var westPad = new THREE.Mesh(
        new THREE.BoxGeometry(8, 0.1, 6),
        new THREE.MeshLambertMaterial({ map: H.createAsphaltTexture(THREE) })
      );
      westPad.position.set(-12, -0.055, -10.3);
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
      createTree(-5, 4);
      createTree(5, 4);
      createTree(-12, 8);
      createTree(12, 8);
      createTree(-8, 15);
      createTree(8, 15);
      // Behind the building
      createTree(-6, -18);
      createTree(6, -18);
      createTree(-14, -20);
      createTree(14, -20);
      // East side
      createTree(13, -2);
      createTree(14, -10);
      // West side (past delivery zone)
      createTree(-18, -4);

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

      // --- Windows (decorative, do not cut walls; not in collidables) ---
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
        // Frame: top, bottom (sill), left, right
        var top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.08, 0.28), windowFrameMat);
        top.position.set(0, h / 2, 0); g.add(top);
        var sill = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.06, 0.30), windowFrameMat);
        sill.position.set(0, -h / 2, 0); g.add(sill);
        var left = new THREE.Mesh(new THREE.BoxGeometry(0.08, h, 0.28), windowFrameMat);
        left.position.set(-w / 2, 0, 0); g.add(left);
        var right = new THREE.Mesh(new THREE.BoxGeometry(0.08, h, 0.28), windowFrameMat);
        right.position.set(w / 2, 0, 0); g.add(right);
        // Mullions (cross)
        var horiz = new THREE.Mesh(new THREE.BoxGeometry(w - 0.08, 0.05, 0.22), windowFrameMat);
        horiz.position.set(0, 0, 0); g.add(horiz);
        var vert = new THREE.Mesh(new THREE.BoxGeometry(0.05, h - 0.08, 0.22), windowFrameMat);
        vert.position.set(0, 0, 0); g.add(vert);
        // Glass panes (outer + inner, perpendicular to wall via group rotation)
        var glassGeo = new THREE.PlaneGeometry(w - 0.1, h - 0.1);
        var glassOuter = new THREE.Mesh(glassGeo, windowGlassMat);
        glassOuter.position.set(0, 0, 0.12); g.add(glassOuter);
        var glassInner = new THREE.Mesh(glassGeo, windowGlassMat);
        glassInner.position.set(0, 0, -0.12); g.add(glassInner);
        g.position.set(x, y, z);
        g.rotation.y = rotY || 0;
        scene.add(g);
      }
      // North wall (z=-12) — flanking sign.reception (x=0)
      createWindow(-2.5, 1.7, -12, 0);
      createWindow(3.5, 1.7, -12, 0);
      // East wall (x=8) — outside chair zone / sign at z=-3.2
      createWindow(8, 1.7, -7, -Math.PI / 2);
      createWindow(8, 1.7, -10, -Math.PI / 2);
      // West wall (x=-8) — between beds, avoiding sign.examination (z=-6)
      createWindow(-8, 1.7, -4, Math.PI / 2);
      createWindow(-8, 1.7, -8, Math.PI / 2);
      // South wall (z=0) — flanking entrance, avoiding cashier (x=-3.5)
      createWindow(-6, 1.7, 0, Math.PI);
      createWindow(6, 1.7, 0, Math.PI);

      // === LIGHTING ===

      // Hemisphere light (sky + ground)
      var hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x556633, 0.6);
      scene.add(hemiLight);

      // Sunlight
      var sunLight = new THREE.DirectionalLight(0xfff5e0, 1.2);
      sunLight.position.set(10, 15, 5);
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.width = 1024;
      sunLight.shadow.mapSize.height = 1024;
      sunLight.shadow.camera.left = -14;
      sunLight.shadow.camera.right = 14;
      sunLight.shadow.camera.top = 2;
      sunLight.shadow.camera.bottom = -16;
      sunLight.shadow.camera.near = 1;
      sunLight.shadow.camera.far = 40;
      scene.add(sunLight);

      // Indoor lighting
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

      for (var x = -6; x <= 6; x += 4) {
        for (var z = -10; z <= -2; z += 4) {
          addLight(x, z, 0.8);
        }
      }

      // --- Self-service checkout (right of exit) ---
      var cashierDeskGroup = new THREE.Group();

      // Base cabinet — metallic gray
      var baseMat = new THREE.MeshLambertMaterial({ color: 0x5a5a60 });
      var baseCabinet = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.5), baseMat);
      baseCabinet.position.set(0, 0.45, 0); baseCabinet.castShadow = true; cashierDeskGroup.add(baseCabinet);

      // Top panel — slightly slanted dark panel holding the screen
      var panelMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
      var topPanel = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.08), panelMat);
      topPanel.position.set(0, 1.15, -0.05);
      topPanel.rotation.x = -0.3;
      topPanel.castShadow = true;
      cashierDeskGroup.add(topPanel);

      // LCD screen — green emissive, attached to front face of panel
      var screenMat = new THREE.MeshLambertMaterial({ color: 0x1a3a1a, emissive: 0x0a3a0a, emissiveIntensity: 0.6 });
      var lcdScreen = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 0.005), screenMat);
      lcdScreen.position.set(0, 1.15, 0);
      lcdScreen.rotation.x = -0.3;
      // Offset slightly forward of panel along tilted direction
      lcdScreen.position.z += Math.sin(0.3) * 0.04;
      lcdScreen.position.y += Math.cos(0.3) * 0.04 - 0.04;
      cashierDeskGroup.add(lcdScreen);

      // Card reader slot on top of cabinet
      var cardReaderMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
      var cardReader = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.06), cardReaderMat);
      cardReader.position.set(0, 0.92, 0.15);
      cashierDeskGroup.add(cardReader);

      // Receipt printer slot — white paper peek
      var receiptMat = new THREE.MeshLambertMaterial({ color: 0xf5f5f0 });
      var receiptSlot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.015, 0.04), receiptMat);
      receiptSlot.position.set(0, 0.92, 0.23);
      cashierDeskGroup.add(receiptSlot);

      cashierDeskGroup.position.set(-3.5, 0, -1.5);
      cashierDeskGroup.rotation.y = Math.PI;
      scene.add(cashierDeskGroup);

      var cashierTableBox = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.6), new THREE.MeshBasicMaterial({ visible: false }));
      cashierTableBox.position.set(-3.5, 0.45, -1.5); scene.add(cashierTableBox); collidables.push(cashierTableBox);

      // Sign above exit (interior of south wall) — wall-mounted per memory guidance
      H.createSign(THREE, scene, Game.Lang.t('sign.selfService'), -3.5, 2.5, -0.11, Math.PI);
      H.createSign(THREE, scene, Game.Lang.t('sign.reception'), 0, 2.5, -11.78, 0);

      // Return destination slots for patient system
      return {
        beds: [
          { pos: new THREE.Vector3(-4.5, 0, -9), occupied: false },
          { pos: new THREE.Vector3(-4.5, 0, -7), occupied: false },
          { pos: new THREE.Vector3(-4.5, 0, -5), occupied: false }
        ],
        waitingChairs: [
          { pos: new THREE.Vector3(5.5, 0, -2), occupied: false },
          { pos: new THREE.Vector3(5.5, 0, -3.2), occupied: false },
          { pos: new THREE.Vector3(5.5, 0, -4.4), occupied: false }
        ],
        bedMeshes: bedMeshes,
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
