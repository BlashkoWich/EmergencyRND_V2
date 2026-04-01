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
        new THREE.MeshStandardMaterial({ map: H.createTileTexture(THREE), roughness: 0.35 })
      );
      indoorFloor.position.set(0, -0.05, -BD / 2);
      indoorFloor.receiveShadow = true;
      scene.add(indoorFloor);
      collidables.push(indoorFloor);

      // --- Outdoor ground: asphalt sidewalk ---
      var sidewalk = new THREE.Mesh(
        new THREE.BoxGeometry(60, 0.1, 60),
        new THREE.MeshStandardMaterial({ map: H.createAsphaltTexture(THREE), roughness: 0.8 })
      );
      sidewalk.position.set(0, -0.06, 24);
      sidewalk.receiveShadow = true;
      scene.add(sidewalk);
      collidables.push(sidewalk);

      // --- Grass areas ---
      var grassMat = new THREE.MeshStandardMaterial({ map: H.createGrassTexture(THREE), roughness: 0.9 });
      var grassL = new THREE.Mesh(new THREE.BoxGeometry(20, 0.1, 40), grassMat);
      grassL.position.set(-20, -0.04, 20); grassL.receiveShadow = true; scene.add(grassL); collidables.push(grassL);
      var grassR = new THREE.Mesh(new THREE.BoxGeometry(20, 0.1, 40), grassMat);
      grassR.position.set(20, -0.04, 20); grassR.receiveShadow = true; scene.add(grassR); collidables.push(grassR);

      // --- Ceiling (only over building) ---
      var ceilMesh = new THREE.Mesh(
        new THREE.BoxGeometry(BW, 0.1, BD),
        new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.9 })
      );
      ceilMesh.position.set(0, 3.05, -BD / 2);
      ceilMesh.receiveShadow = true;
      scene.add(ceilMesh);
      collidables.push(ceilMesh);

      // --- Building walls ---
      var T = 0.2;
      H.createWall(THREE, scene, collidables, 0, BZ1, BW + T, T);           // North
      H.createWall(THREE, scene, collidables, BX1, -BD / 2, T, BD);         // West
      H.createWall(THREE, scene, collidables, BX2, -BD / 2, T, BD);         // East
      // South wall — two segments with entrance gap (x: -1.2..1.2)
      var doorHalf = 1.2;
      var segW = (BW / 2 - doorHalf);
      H.createWall(THREE, scene, collidables, BX1 + segW / 2, BZ2, segW, T);
      H.createWall(THREE, scene, collidables, BX2 - segW / 2, BZ2, segW, T);
      H.createWall(THREE, scene, collidables, 0, BZ2, doorHalf * 2, T, { h: 0.5, y: 2.75 }); // Lintel

      // Door frame posts
      var frameMat = new THREE.MeshStandardMaterial({ color: 0x99a8b8, roughness: 0.5 });
      for (var i = 0; i < 2; i++) {
        var dx = i === 0 ? -doorHalf : doorHalf;
        var post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3, 0.25), frameMat);
        post.position.set(dx, 1.5, BZ2); scene.add(post); collidables.push(post);
      }

      // --- Entrance sign ---
      H.createSign(THREE, scene, '\u0427\u0410\u0421\u0422\u041D\u0410\u042F \u041A\u041B\u0418\u041D\u0418\u041A\u0410', 0, 2.3, BZ2 + 0.15, 0);

      // === FURNITURE ===

      // --- Reception desk ---
      var deskMat = new THREE.MeshStandardMaterial({ color: 0x6688aa, roughness: 0.4, metalness: 0.1 });
      var deskPanelMat = new THREE.MeshStandardMaterial({ color: 0x557799, roughness: 0.5 });

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
      var chairMat = new THREE.MeshStandardMaterial({ color: 0x3366aa, roughness: 0.6 });
      var chairLegMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3, metalness: 0.5 });

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

      H.createSign(THREE, scene, '\u0417\u041E\u041D\u0410 \u041E\u0416\u0418\u0414\u0410\u041D\u0418\u042F', 7.88, 2.5, -3.2, -Math.PI / 2);

      // --- 2 Medical beds ---
      var bedFrameMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.3, metalness: 0.4 });
      var mattressMat = new THREE.MeshStandardMaterial({ color: 0x88bbaa, roughness: 0.7 });
      var pillowMat = new THREE.MeshStandardMaterial({ color: 0xddeedd, roughness: 0.8 });

      var bedMeshes = [];
      function createBed(x, z, rotY) {
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
        box.position.set(x, 0.5, z); scene.add(box); collidables.push(box);
        bedMeshes.push({ group: g, collisionBox: box });
      }

      createBed(-5.5, -9, 0);
      createBed(-5.5, -7, 0);

      H.createSign(THREE, scene, '\u0421\u041C\u041E\u0422\u0420\u041E\u0412\u0410\u042F', -7.88, 2.5, -8, Math.PI / 2);

      // === OUTDOOR ENVIRONMENT ===

      // --- Trees ---
      var trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.9 });
      var leafMat = new THREE.MeshStandardMaterial({ color: 0x3a7a2a, roughness: 0.8 });
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

      // --- Benches ---
      var benchMat = new THREE.MeshStandardMaterial({ color: 0x8B6F47, roughness: 0.7 });
      var benchLegMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.4, metalness: 0.5 });
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

      // === LIGHTING ===

      // Hemisphere light (sky + ground)
      var hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x556633, 0.6);
      scene.add(hemiLight);

      // Sunlight
      var sunLight = new THREE.DirectionalLight(0xfff5e0, 1.2);
      sunLight.position.set(10, 15, 5);
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.width = 2048;
      sunLight.shadow.mapSize.height = 2048;
      sunLight.shadow.camera.left = -25;
      sunLight.shadow.camera.right = 25;
      sunLight.shadow.camera.top = 25;
      sunLight.shadow.camera.bottom = -25;
      sunLight.shadow.camera.near = 1;
      sunLight.shadow.camera.far = 40;
      scene.add(sunLight);

      // Indoor lighting
      scene.add(new THREE.AmbientLight(0xffffff, 0.3));

      var fixtureGeo = new THREE.BoxGeometry(0.9, 0.04, 0.3);
      var fixtureMat = new THREE.MeshStandardMaterial({
        color: 0xffffff, emissive: 0xeef4ff, emissiveIntensity: 0.8, roughness: 0.3
      });

      function addLight(x, z, intensity, castShadow) {
        var light = new THREE.PointLight(0xf0f5ff, intensity, 12);
        light.position.set(x, 2.9, z);
        if (castShadow) {
          light.castShadow = true;
          light.shadow.mapSize.width = 512;
          light.shadow.mapSize.height = 512;
        }
        scene.add(light);
        var fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
        fixture.position.set(x, 2.98, z);
        scene.add(fixture);
      }

      for (var x = -6; x <= 6; x += 4) {
        for (var z = -10; z <= -2; z += 4) {
          addLight(x, z, 0.8, Math.abs(x) < 4);
        }
      }

      // --- Cashier desk (right of reception) ---
      var cashierTableMat = new THREE.MeshStandardMaterial({ color: 0x8B6F47, roughness: 0.6 });
      var cashierTable = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.6), cashierTableMat);
      cashierTable.position.set(3.5, 0.4, -9.5); cashierTable.castShadow = true; scene.add(cashierTable);
      var cashierTableBox = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.7), new THREE.MeshBasicMaterial({ visible: false }));
      cashierTableBox.position.set(3.5, 0.4, -9.5); scene.add(cashierTableBox); collidables.push(cashierTableBox);

      // Card terminal on the table
      var terminalMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.4, metalness: 0.3 });
      var terminalBody = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.28), terminalMat);
      terminalBody.position.set(3.5, 0.84, -9.5); terminalBody.castShadow = true; scene.add(terminalBody);

      var terminalScreenMat = new THREE.MeshStandardMaterial({ color: 0x1a3a1a, roughness: 0.3, emissive: 0x0a1a0a, emissiveIntensity: 0.5 });
      var terminalScreen = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.005, 0.10), terminalScreenMat);
      terminalScreen.position.set(3.5, 0.865, -9.42); scene.add(terminalScreen);

      // Terminal keypad area (light gray dots area)
      var keypadMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5 });
      var keypadArea = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.005, 0.12), keypadMat);
      keypadArea.position.set(3.5, 0.865, -9.58); scene.add(keypadArea);

      // Terminal group for raycasting
      var terminalGroup = new THREE.Group();
      terminalGroup.add(terminalBody.clone());
      terminalGroup.position.set(3.5, 0.84, -9.5);

      H.createSign(THREE, scene, '\u041A\u0410\u0421\u0421\u0410', 3.5, 2.5, -11.78, 0);
      H.createSign(THREE, scene, '\u0420\u0415\u0421\u0415\u041F\u0428\u0415\u041D', 0, 2.5, -11.78, 0);

      // Return destination slots for patient system
      return {
        beds: [
          { pos: new THREE.Vector3(-4.5, 0, -9), occupied: false },
          { pos: new THREE.Vector3(-4.5, 0, -7), occupied: false }
        ],
        waitingChairs: [
          { pos: new THREE.Vector3(5.5, 0, -2), occupied: false },
          { pos: new THREE.Vector3(5.5, 0, -3.2), occupied: false },
          { pos: new THREE.Vector3(5.5, 0, -4.4), occupied: false }
        ],
        bedMeshes: bedMeshes,
        chairMeshes: chairMeshes,
        cashierDesk: {
          terminalMeshes: [terminalBody, terminalScreen, keypadArea],
          patientPos: new THREE.Vector3(3.5, 0, -8.0)
        }
      };
    }
  };
})();
