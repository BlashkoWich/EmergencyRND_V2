(function() {
  window.Game = window.Game || {};

  var CONSUMABLE_TYPES = {
    strepsils:     { name: 'Стрепсилс',        color: 0xcc3333, size: { x: 0.15, y: 0.08, z: 0.10 } },
    painkiller:    { name: 'Обезболивающее',    color: 0x3366cc, size: { x: 0.18, y: 0.06, z: 0.12 } },
    antihistamine: { name: 'Антигистаминное',   color: 0x33aa55, size: { x: 0.14, y: 0.07, z: 0.10 } },
    linen_clean:   { name: 'Постельное бельё',  color: 0xeeeeff, size: { x: 0.20, y: 0.10, z: 0.15 } },
    linen_dirty:   { name: 'Грязное бельё',     color: 0x887766, size: { x: 0.20, y: 0.10, z: 0.15 } }
  };

  var INSTRUMENT_TYPES = {
    instrument_stethoscope: { name: 'Фонендоскоп', color: 0x8866cc, size: { x: 0.72, y: 0.40, z: 0.40 } },
    instrument_hammer:   { name: 'Рефлекс-молоток', color: 0xcc8844, size: { x: 0.64, y: 0.56, z: 0.24 } },
    instrument_rhinoscope:  { name: 'Риноскоп',    color: 0x44aacc, size: { x: 0.64, y: 0.32, z: 0.32 } }
  };

  function isInstrument(type) {
    return type && type.indexOf('instrument_') === 0;
  }

  function isLinen(type) {
    return type === 'linen_clean' || type === 'linen_dirty';
  }

  var GRAVITY = -9.8;
  var GROUND_Y = 0;
  var DELIVERY_ZONE = { cx: 0, cz: 5, hw: 1.5, hd: 1.0 };
  var TRASH_ZONE = { cx: 3, cz: 1.5, radius: 0.8 };
  var DROP_FORWARD_SPEED = 4.0;
  var DROP_UP_SPEED = 2.0;

  // Box constants
  var BOX_SIZE = { x: 0.8, y: 0.6, z: 0.6 };
  var BOX_ITEMS_COUNT = 10;

  var THREE, scene, camera, controls, collidables;
  var groundItems = [];
  var groundBoxes = [];
  var heldBox = null;
  var hoveredItem = null;
  var hoveredBox = null;
  var interactRay, screenCenter;
  var hintEl, heldBoxHintEl;
  var deliveryZoneMesh;
  var trashBinMesh;
  var physicsRay;

  function createDeliveryZone() {
    var canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 170;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(255, 200, 50, 0.25)';
    ctx.fillRect(0, 0, 256, 170);
    ctx.strokeStyle = '#ffcc33';
    ctx.lineWidth = 6;
    ctx.setLineDash([16, 10]);
    ctx.strokeRect(6, 6, 244, 158);
    ctx.fillStyle = '#ffcc33';
    ctx.font = 'bold 28px Segoe UI, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ДОСТАВКА', 128, 85);

    var tex = new THREE.CanvasTexture(canvas);
    var geo = new THREE.PlaneGeometry(3, 2);
    var mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    deliveryZoneMesh = new THREE.Mesh(geo, mat);
    deliveryZoneMesh.rotation.x = -Math.PI / 2;
    deliveryZoneMesh.position.set(DELIVERY_ZONE.cx, 0.01, DELIVERY_ZONE.cz);
    scene.add(deliveryZoneMesh);
  }

  function createTrashBin() {
    var group = new THREE.Group();

    // Body — dark gray cylinder, slight taper
    var bodyGeo = new THREE.CylinderGeometry(0.28, 0.22, 0.7, 14);
    var bodyMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.6, metalness: 0.15 });
    var body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.35;
    body.castShadow = true;
    group.add(body);

    // Rim — torus at top
    var rimGeo = new THREE.TorusGeometry(0.28, 0.025, 8, 18);
    var rimMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.3, metalness: 0.4 });
    var rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.7;
    group.add(rim);

    // Red accent stripe
    var stripeGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.06, 14);
    var stripeMat = new THREE.MeshStandardMaterial({ color: 0xcc3333, roughness: 0.5 });
    var stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.y = 0.55;
    group.add(stripe);

    // Inner void (dark top to look open)
    var innerGeo = new THREE.CylinderGeometry(0.24, 0.19, 0.68, 14);
    var innerMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    var inner = new THREE.Mesh(innerGeo, innerMat);
    inner.position.y = 0.36;
    group.add(inner);

    group.position.set(TRASH_ZONE.cx, 0, TRASH_ZONE.cz);
    scene.add(group);
    trashBinMesh = group;

    // Collision box
    var colBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.8, 0.65),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    colBox.position.set(TRASH_ZONE.cx, 0.4, TRASH_ZONE.cz);
    scene.add(colBox);
    collidables.push(colBox);

    // Ground zone indicator
    var canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(200, 60, 60, 0.18)';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#cc3333';
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 6]);
    ctx.strokeRect(4, 4, 120, 120);
    ctx.fillStyle = '#cc3333';
    ctx.font = 'bold 22px Segoe UI, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u041C\u0423\u0421\u041E\u0420', 64, 64);

    var tex = new THREE.CanvasTexture(canvas);
    var zoneMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 1.4),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    );
    zoneMesh.rotation.x = -Math.PI / 2;
    zoneMesh.position.set(TRASH_ZONE.cx, 0.01, TRASH_ZONE.cz);
    scene.add(zoneMesh);

    // Sign on wall
  }

  function markBoxEmpty(box) {
    if (box.empty) return;
    box.empty = true;
    // Flatten the box visually
    box.mesh.scale.y = 0.5;
    box.mesh.position.y = box.mesh.position.y - BOX_SIZE.y * 0.25;
    // Fade materials to gray
    box.mesh.traverse(function(child) {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        child.material.color.set(0x888888);
        child.material.opacity = 0.7;
        child.material.transparent = true;
      }
    });
  }

  // --- Medical 3D Models ---

  function createConsumableMesh(type) {
    var info = CONSUMABLE_TYPES[type];
    var group = new THREE.Group();

    if (type === 'strepsils') {
      // Blister pack: flat base + 6 hemispherical bumps (2 rows x 3)
      var baseMat = new THREE.MeshStandardMaterial({ color: info.color, roughness: 0.4, metalness: 0.1 });
      var base = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 0.10), baseMat);
      base.castShadow = true;
      group.add(base);

      var bumpMat = new THREE.MeshStandardMaterial({ color: 0xee5555, roughness: 0.3, metalness: 0.2 });
      var bumpGeo = new THREE.SphereGeometry(0.016, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
      for (var row = 0; row < 2; row++) {
        for (var col = 0; col < 3; col++) {
          var bump = new THREE.Mesh(bumpGeo, bumpMat);
          bump.position.set(-0.04 + col * 0.04, 0.01, -0.025 + row * 0.05);
          bump.castShadow = true;
          group.add(bump);
        }
      }

      // Foil back (bottom)
      var foilMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.2, metalness: 0.6 });
      var foil = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.003, 0.09), foilMat);
      foil.position.y = -0.01;
      group.add(foil);

    } else if (type === 'painkiller') {
      // Pill bottle: cylinder body + white cap + label band
      var bodyMat = new THREE.MeshStandardMaterial({ color: info.color, roughness: 0.4 });
      var body = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.10, 12), bodyMat);
      body.castShadow = true;
      group.add(body);

      // White cap
      var capMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
      var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.025, 12), capMat);
      cap.position.y = 0.0625;
      cap.castShadow = true;
      group.add(cap);

      // White label band
      var labelMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5 });
      var label = new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.037, 0.035, 12), labelMat);
      label.position.y = -0.005;
      group.add(label);

    } else if (type === 'antihistamine') {
      // Medicine box with white cross on front
      var boxMat = new THREE.MeshStandardMaterial({ color: info.color, roughness: 0.5 });
      var box = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.10, 0.05), boxMat);
      box.castShadow = true;
      group.add(box);

      // White cross on front face
      var crossMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
      var crossH = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.015, 0.002), crossMat);
      crossH.position.set(0, 0, 0.026);
      group.add(crossH);
      var crossV = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.05, 0.002), crossMat);
      crossV.position.set(0, 0, 0.026);
      group.add(crossV);

    } else if (type === 'linen_clean') {
      // Folded clean bedsheet — light blue/white stack
      var sheetMat = new THREE.MeshStandardMaterial({ color: 0xdde4f0, roughness: 0.8 });
      var sheet = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.08, 0.15), sheetMat);
      sheet.castShadow = true;
      group.add(sheet);
      // Fold line
      var foldMat = new THREE.MeshStandardMaterial({ color: 0xc8d0e0, roughness: 0.7 });
      var fold = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.005, 0.002), foldMat);
      fold.position.set(0, 0.043, 0);
      group.add(fold);
      // Top accent stripe
      var stripeMat = new THREE.MeshStandardMaterial({ color: 0x99aacc, roughness: 0.6 });
      var stripe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.003, 0.04), stripeMat);
      stripe.position.set(0, 0.042, 0.03);
      group.add(stripe);

    } else if (type === 'linen_dirty') {
      // Folded dirty bedsheet — brownish/yellow tint
      var dirtyMat = new THREE.MeshStandardMaterial({ color: 0x998870, roughness: 0.9 });
      var dirtySheet = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.08, 0.15), dirtyMat);
      dirtySheet.castShadow = true;
      group.add(dirtySheet);
      // Stain spots
      var stainMat = new THREE.MeshStandardMaterial({ color: 0x776650, roughness: 0.9 });
      var stain1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.003, 0.03), stainMat);
      stain1.position.set(-0.04, 0.042, 0.02);
      group.add(stain1);
      var stain2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.003, 0.04), stainMat);
      stain2.position.set(0.05, 0.042, -0.03);
      group.add(stain2);
    }

    group.userData.consumableType = type;
    return group;
  }

  // --- Instrument 3D Models ---

  function createInstrumentMesh(type) {
    var info = INSTRUMENT_TYPES[type];
    var group = new THREE.Group();

    if (type === 'instrument_stethoscope') {
      // Stethoscope: chest piece disk + tube + earpiece
      var diskMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3, metalness: 0.6 });
      var disk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.01, 16), diskMat);
      disk.position.y = 0;
      disk.castShadow = true;
      group.add(disk);

      var tubeMat = new THREE.MeshStandardMaterial({ color: info.color, roughness: 0.5 });
      var tube = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 8), tubeMat);
      tube.position.y = 0.065;
      tube.castShadow = true;
      group.add(tube);

      // Y-split earpieces
      var earL = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.04, 6), tubeMat);
      earL.position.set(-0.015, 0.14, 0);
      earL.rotation.z = 0.4;
      group.add(earL);
      var earR = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.04, 6), tubeMat);
      earR.position.set(0.015, 0.14, 0);
      earR.rotation.z = -0.4;
      group.add(earR);

      // Ear tips
      var tipMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.4 });
      var tipL = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), tipMat);
      tipL.position.set(-0.025, 0.155, 0);
      group.add(tipL);
      var tipR = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), tipMat);
      tipR.position.set(0.025, 0.155, 0);
      group.add(tipR);

    } else if (type === 'instrument_hammer') {
      // Reflex hammer: handle + rubber head
      var handleMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5, metalness: 0.3 });
      var handle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 8), handleMat);
      handle.castShadow = true;
      group.add(handle);

      // Rubber triangular head (flattened cylinder on its side)
      var headMat = new THREE.MeshStandardMaterial({ color: info.color, roughness: 0.7 });
      var head = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.012, 12), headMat);
      head.position.y = 0.075;
      head.rotation.z = Math.PI / 2;
      head.castShadow = true;
      group.add(head);

      // Small metal band at junction
      var bandMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3, metalness: 0.5 });
      var band = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.008, 8), bandMat);
      band.position.y = 0.065;
      group.add(band);

    } else if (type === 'instrument_rhinoscope') {
      // Rhinoscope: cylinder body + cone tip + light
      var bodyMat = new THREE.MeshStandardMaterial({ color: info.color, roughness: 0.4, metalness: 0.3 });
      var body = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 10), bodyMat);
      body.castShadow = true;
      group.add(body);

      // Handle grip
      var gripMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.7 });
      var grip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.04, 8), gripMat);
      grip.position.y = -0.04;
      group.add(grip);

      // Cone tip
      var tipMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.3, metalness: 0.5 });
      var tip = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.03, 8), tipMat);
      tip.position.y = 0.075;
      tip.castShadow = true;
      group.add(tip);

      // Light at tip (emissive)
      var lightMat = new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffffcc, emissiveIntensity: 0.5, roughness: 0.2 });
      var light = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 4), lightMat);
      light.position.y = 0.092;
      group.add(light);
    }

    group.scale.set(4, 4, 4);
    group.userData.consumableType = type;
    group.userData.isInstrument = true;
    return group;
  }

  // --- Box 3D Model ---

  function createBoxMesh(type) {
    var info = CONSUMABLE_TYPES[type];
    var group = new THREE.Group();

    // Box in the drug's color
    var boxMat = new THREE.MeshStandardMaterial({ color: info.color, roughness: 0.6 });
    var box = new THREE.Mesh(new THREE.BoxGeometry(BOX_SIZE.x, BOX_SIZE.y, BOX_SIZE.z), boxMat);
    box.castShadow = true;
    group.add(box);

    // Slightly darker edge strip on top
    var darkerColor = new THREE.Color(info.color).multiplyScalar(0.7);
    var edgeMat = new THREE.MeshStandardMaterial({ color: darkerColor, roughness: 0.7 });
    var edgeT = new THREE.Mesh(new THREE.BoxGeometry(BOX_SIZE.x + 0.01, 0.02, BOX_SIZE.z + 0.01), edgeMat);
    edgeT.position.y = BOX_SIZE.y / 2;
    group.add(edgeT);

    // Create label canvas (high-res for clarity)
    var canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    var ctx = canvas.getContext('2d');

    // White label area
    ctx.fillStyle = '#ffffff';
    ctx.roundRect(20, 20, 472, 472, 16);
    ctx.fill();

    // Colored border
    var colorHex = '#' + info.color.toString(16).padStart(6, '0');
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 8;
    ctx.roundRect(20, 20, 472, 472, 16);
    ctx.stroke();

    // Type-specific icon
    if (type === 'strepsils') {
      // Blister with pills
      ctx.fillStyle = colorHex;
      ctx.beginPath();
      ctx.roundRect(166, 30, 180, 60, 10);
      ctx.fill();
      ctx.fillStyle = '#ee5555';
      for (var pr = 0; pr < 2; pr++) {
        for (var pc = 0; pc < 3; pc++) {
          ctx.beginPath();
          ctx.arc(196 + pc * 50, 48 + pr * 24, 9, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (type === 'painkiller') {
      // Pill bottle
      ctx.fillStyle = colorHex;
      ctx.beginPath();
      ctx.roundRect(216, 28, 80, 66, 8);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(210, 24, 92, 18, 4);
      ctx.fill();
      ctx.fillStyle = '#eee';
      ctx.beginPath();
      ctx.roundRect(222, 56, 68, 24, 4);
      ctx.fill();
    } else if (type === 'antihistamine') {
      // Box with cross
      ctx.fillStyle = colorHex;
      ctx.beginPath();
      ctx.roundRect(196, 24, 120, 72, 8);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(236, 34, 40, 12);
      ctx.fillRect(250, 28, 12, 64);
    } else if (type === 'linen_clean') {
      // Folded sheet icon
      ctx.fillStyle = '#dde4f0';
      ctx.beginPath();
      ctx.roundRect(186, 24, 140, 72, 8);
      ctx.fill();
      ctx.strokeStyle = '#99aacc';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(196, 48); ctx.lineTo(316, 48); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(196, 72); ctx.lineTo(316, 72); ctx.stroke();
    }

    // Drug name (large, bold)
    ctx.fillStyle = '#111';
    ctx.font = 'bold 52px Segoe UI, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(info.name, 256, 180);

    // Horizontal divider
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(80, 230);
    ctx.lineTo(432, 230);
    ctx.stroke();

    // "x10" text (large)
    ctx.fillStyle = '#333';
    ctx.font = 'bold 72px Segoe UI, Arial, sans-serif';
    ctx.fillText('×10', 256, 320);

    // Subtitle
    ctx.fillStyle = '#777';
    ctx.font = '32px Segoe UI, Arial, sans-serif';
    ctx.fillText(isLinen(type) ? 'расходники' : 'препараты', 256, 410);

    var tex = new THREE.CanvasTexture(canvas);
    var labelGeo = new THREE.PlaneGeometry(BOX_SIZE.x * 0.85, BOX_SIZE.y * 0.85);
    var labelMatFront = new THREE.MeshBasicMaterial({
      map: tex, transparent: true,
      depthTest: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
    });

    // Front label
    var labelFront = new THREE.Mesh(labelGeo, labelMatFront);
    labelFront.position.z = BOX_SIZE.z / 2 + 0.005;
    labelFront.userData.isLabel = true;
    group.add(labelFront);

    // Back label (same texture, rotated 180)
    var labelMatBack = new THREE.MeshBasicMaterial({
      map: tex, transparent: true,
      depthTest: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
    });
    var labelBack = new THREE.Mesh(labelGeo, labelMatBack);
    labelBack.position.z = -(BOX_SIZE.z / 2 + 0.005);
    labelBack.rotation.y = Math.PI;
    labelBack.userData.isLabel = true;
    group.add(labelBack);

    group.userData.isBox = true;
    group.userData.boxType = type;
    return group;
  }

  // --- Spawn Functions ---

  function spawnInDeliveryZone(type) {
    var mesh = createConsumableMesh(type);
    var x = DELIVERY_ZONE.cx + (Math.random() - 0.5) * 2 * DELIVERY_ZONE.hw;
    var z = DELIVERY_ZONE.cz + (Math.random() - 0.5) * 2 * DELIVERY_ZONE.hd;
    mesh.position.set(x, 3.0, z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    scene.add(mesh);

    groundItems.push({
      type: type,
      mesh: mesh,
      velocity: new THREE.Vector3(0, 0, 0),
      grounded: false,
      pickedUp: false
    });
  }

  function spawnBoxInDeliveryZone(type) {
    var mesh = createBoxMesh(type);
    var x = DELIVERY_ZONE.cx + (Math.random() - 0.5) * 2 * DELIVERY_ZONE.hw;
    var z = DELIVERY_ZONE.cz + (Math.random() - 0.5) * 2 * DELIVERY_ZONE.hd;
    mesh.position.set(x, 3.0, z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    scene.add(mesh);

    groundBoxes.push({
      type: type,
      mesh: mesh,
      remaining: BOX_ITEMS_COUNT,
      velocity: new THREE.Vector3(0, 0, 0),
      grounded: false,
      pickedUp: false
    });
  }

  function spawnInstrumentInDeliveryZone(type) {
    var mesh = createInstrumentMesh(type);
    var x = DELIVERY_ZONE.cx + (Math.random() - 0.5) * 2 * DELIVERY_ZONE.hw;
    var z = DELIVERY_ZONE.cz + (Math.random() - 0.5) * 2 * DELIVERY_ZONE.hd;
    mesh.position.set(x, 3.0, z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    scene.add(mesh);

    groundItems.push({
      type: type,
      mesh: mesh,
      velocity: new THREE.Vector3(0, 0, 0),
      grounded: false,
      pickedUp: false
    });
  }

  function dropFromPlayer(type) {
    var mesh = isInstrument(type) ? createInstrumentMesh(type) : createConsumableMesh(type);
    var forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    var spawnPos = camera.position.clone().add(forward.clone().multiplyScalar(0.8));
    spawnPos.y -= 0.3;
    mesh.position.copy(spawnPos);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    scene.add(mesh);

    var vel = forward.clone().multiplyScalar(DROP_FORWARD_SPEED);
    vel.y = DROP_UP_SPEED;

    groundItems.push({
      type: type,
      mesh: mesh,
      velocity: vel,
      grounded: false,
      pickedUp: false
    });
  }

  function throwHeldBox() {
    var forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    var vel = forward.clone().multiplyScalar(DROP_FORWARD_SPEED);
    vel.y = DROP_UP_SPEED;

    heldBox.velocity = vel;
    heldBox.grounded = false;
    heldBox.pickedUp = false;
    heldBox = null;
  }

  // --- Physics ---

  function applyItemPhysics(item, halfH, halfW, delta, downDir) {
    item.velocity.y += GRAVITY * delta;

    var pos = item.mesh.position;
    var vel = item.velocity;

    // X axis collision
    if (Math.abs(vel.x) > 0.001) {
      var dirX = new THREE.Vector3(vel.x > 0 ? 1 : -1, 0, 0);
      physicsRay.set(pos, dirX);
      physicsRay.far = Math.abs(vel.x * delta) + halfW + 0.02;
      var hitsX = physicsRay.intersectObjects(collidables);
      if (hitsX.length > 0 && hitsX[0].distance < Math.abs(vel.x * delta) + halfW + 0.02) {
        vel.x = 0;
      }
    }

    // Z axis collision
    if (Math.abs(vel.z) > 0.001) {
      var dirZ = new THREE.Vector3(0, 0, vel.z > 0 ? 1 : -1);
      physicsRay.set(pos, dirZ);
      physicsRay.far = Math.abs(vel.z * delta) + halfW + 0.02;
      var hitsZ = physicsRay.intersectObjects(collidables);
      if (hitsZ.length > 0 && hitsZ[0].distance < Math.abs(vel.z * delta) + halfW + 0.02) {
        vel.z = 0;
      }
    }

    // Y axis (downward) collision
    if (vel.y < 0) {
      physicsRay.set(pos, downDir);
      physicsRay.far = Math.abs(vel.y * delta) + halfH + 0.02;
      var hitsY = physicsRay.intersectObjects(collidables);
      if (hitsY.length > 0 && hitsY[0].distance < Math.abs(vel.y * delta) + halfH + 0.02) {
        pos.y = hitsY[0].point.y + halfH;
        vel.y = 0;
        vel.x *= 0.3;
        vel.z *= 0.3;
        if (Math.abs(vel.x) < 0.1 && Math.abs(vel.z) < 0.1) {
          vel.x = 0;
          vel.z = 0;
          item.grounded = true;
        }
      }
    }

    // Apply velocity
    pos.x += vel.x * delta;
    pos.y += vel.y * delta;
    pos.z += vel.z * delta;

    // Ground plane fallback
    if (pos.y - halfH <= GROUND_Y) {
      pos.y = GROUND_Y + halfH;
      vel.y = 0;
      vel.x *= 0.3;
      vel.z *= 0.3;
      if (Math.abs(vel.x) < 0.1 && Math.abs(vel.z) < 0.1) {
        vel.x = 0;
        vel.z = 0;
        item.grounded = true;
      }
    }
  }

  function updatePhysics(delta) {
    var downDir = new THREE.Vector3(0, -1, 0);

    for (var i = 0; i < groundItems.length; i++) {
      var item = groundItems[i];
      if (item.grounded || item.pickedUp) continue;
      var typeInfo = CONSUMABLE_TYPES[item.type] || INSTRUMENT_TYPES[item.type];
      var halfH = typeInfo.size.y / 2;
      var halfW = typeInfo.size.x / 2;
      applyItemPhysics(item, halfH, halfW, delta, downDir);
    }

    for (var i = 0; i < groundBoxes.length; i++) {
      var box = groundBoxes[i];
      if (box.grounded || box.pickedUp) continue;
      applyItemPhysics(box, BOX_SIZE.y / 2, BOX_SIZE.x / 2, delta, downDir);
    }

    // Trash bin collision — destroy items/boxes that land in the zone
    var tr = TRASH_ZONE.radius * TRASH_ZONE.radius;
    for (var i = groundItems.length - 1; i >= 0; i--) {
      var it = groundItems[i];
      if (it.pickedUp) continue;
      var p = it.mesh.position;
      var dx = p.x - TRASH_ZONE.cx, dz = p.z - TRASH_ZONE.cz;
      if (dx * dx + dz * dz < tr && p.y < 1.0) {
        scene.remove(it.mesh);
        groundItems.splice(i, 1);
      }
    }
    for (var i = groundBoxes.length - 1; i >= 0; i--) {
      var bx = groundBoxes[i];
      if (bx.pickedUp) continue;
      var p = bx.mesh.position;
      var dx = p.x - TRASH_ZONE.cx, dz = p.z - TRASH_ZONE.cz;
      if (dx * dx + dz * dz < tr && p.y < 1.0) {
        scene.remove(bx.mesh);
        groundBoxes.splice(i, 1);
        if (hoveredBox === bx) { hoveredBox = null; hintEl.style.display = 'none'; }
      }
    }
  }

  // --- Highlight / Unhighlight ---

  function highlightGroup(group) {
    group.traverse(function(child) {
      if (child.isMesh && !child.userData.isLabel) {
        child.material = child.material.clone();
        child.material.emissive = new THREE.Color(0x00ff44);
        child.material.emissiveIntensity = 0.35;
      }
    });
  }

  function unhighlightGroup(group) {
    group.traverse(function(child) {
      if (child.isMesh && !child.userData.isLabel && child.material.emissive) {
        child.material.emissive = new THREE.Color(0x000000);
        child.material.emissiveIntensity = 0;
      }
    });
  }

  // --- Mesh Lookup ---

  function getItemFromMesh(hitObject) {
    for (var i = 0; i < groundItems.length; i++) {
      if (groundItems[i].pickedUp) continue;
      var current = hitObject;
      while (current) {
        if (current === groundItems[i].mesh) return groundItems[i];
        current = current.parent;
      }
    }
    return null;
  }

  function getBoxFromMesh(hitObject) {
    for (var i = 0; i < groundBoxes.length; i++) {
      if (groundBoxes[i].pickedUp) continue;
      var current = hitObject;
      while (current) {
        if (current === groundBoxes[i].mesh) return groundBoxes[i];
        current = current.parent;
      }
    }
    return null;
  }

  // --- Held Box Update ---

  function updateHeldBox() {
    if (!heldBox) return;
    var forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    var pos = camera.position.clone();
    pos.add(forward.clone().multiplyScalar(0.6));
    pos.y -= 0.35;
    var right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    pos.add(right.multiplyScalar(0.2));
    heldBox.mesh.position.copy(pos);
    heldBox.mesh.rotation.y = Math.atan2(forward.x, forward.z);
  }

  function updateHeldBoxHints() {
    if (heldBox && controls.isLocked) {
      var heldItemName = (CONSUMABLE_TYPES[heldBox.type] || INSTRUMENT_TYPES[heldBox.type] || {}).name || 'предмет';
      heldBoxHintEl.innerHTML = heldBox.empty
        ? 'G — Выбросить в мусорку'
        : 'ЛКМ — Взять: ' + heldItemName + ' (осталось: ' + heldBox.remaining + ')<br>G — Бросить коробку';
      heldBoxHintEl.style.display = 'block';
    } else {
      heldBoxHintEl.style.display = 'none';
    }
  }

  // --- Box Interaction (hover + E key hint) ---

  function updateBoxInteraction() {
    if (!controls.isLocked || Game.Patients.isPopupOpen() || Game.Shop.isOpen()) {
      if (hoveredBox) { unhighlightGroup(hoveredBox.mesh); hoveredBox = null; }
      return false;
    }
    if (heldBox) {
      if (hoveredBox) { unhighlightGroup(hoveredBox.mesh); hoveredBox = null; }
      return false;
    }
    if (!Game.Interaction.isActive('boxes')) {
      if (hoveredBox) { unhighlightGroup(hoveredBox.mesh); hoveredBox = null; }
      return false;
    }

    interactRay.setFromCamera(screenCenter, camera);
    var meshes = [];
    for (var i = 0; i < groundBoxes.length; i++) {
      if (groundBoxes[i].grounded && !groundBoxes[i].pickedUp) {
        meshes.push(groundBoxes[i].mesh);
      }
    }

    var hits = interactRay.intersectObjects(meshes, true);
    var newHovered = hits.length > 0 ? getBoxFromMesh(hits[0].object) : null;

    if (newHovered !== hoveredBox) {
      if (hoveredBox) unhighlightGroup(hoveredBox.mesh);
      if (newHovered) highlightGroup(newHovered.mesh);
      hoveredBox = newHovered;
    }

    if (hoveredBox) {
      var boxItemName = (CONSUMABLE_TYPES[hoveredBox.type] || INSTRUMENT_TYPES[hoveredBox.type] || {}).name || 'предмет';
      hintEl.textContent = hoveredBox.empty
        ? 'E — Поднять пустую коробку'
        : 'ЛКМ — Взять: ' + boxItemName + ' (' + hoveredBox.remaining + ' шт.)  |  E — Поднять коробку';
      hintEl.style.display = 'block';
      return true;
    }
    return false;
  }

  // --- Consumable Interaction (hover + LMB pickup hint) ---

  function updateInteraction() {
    if (!controls.isLocked || Game.Patients.isPopupOpen() || Game.Shop.isOpen()) {
      if (hoveredItem) { unhighlightGroup(hoveredItem.mesh); hoveredItem = null; }
      return false;
    }
    if (!Game.Interaction.isActive('consumables')) {
      if (hoveredItem) { unhighlightGroup(hoveredItem.mesh); hoveredItem = null; }
      return false;
    }

    interactRay.setFromCamera(screenCenter, camera);
    var meshes = [];
    for (var i = 0; i < groundItems.length; i++) {
      if (groundItems[i].grounded && !groundItems[i].pickedUp) {
        meshes.push(groundItems[i].mesh);
      }
    }

    var hits = interactRay.intersectObjects(meshes, true);
    var newHovered = hits.length > 0 ? getItemFromMesh(hits[0].object) : null;

    if (newHovered !== hoveredItem) {
      if (hoveredItem) unhighlightGroup(hoveredItem.mesh);
      if (newHovered) highlightGroup(newHovered.mesh);
      hoveredItem = newHovered;
    }

    if (hoveredItem) {
      hintEl.textContent = 'Поднять на ЛКМ';
      hintEl.style.display = 'block';
      return true;
    }
    return false;
  }

  // --- Public API ---

  window.Game.Consumables = {
    TYPES: CONSUMABLE_TYPES,
    INSTRUMENT_TYPES: INSTRUMENT_TYPES,

    hasInteraction: function() { return !!hoveredItem; },
    hasBoxInteraction: function() { return !!hoveredBox; },
    isHoldingBox: function() { return !!heldBox; },
    isInstrument: function(type) { return isInstrument(type); },
    isLinen: function(type) { return isLinen(type); },

    createMesh: function(type) { return isInstrument(type) ? createInstrumentMesh(type) : createConsumableMesh(type); },

    countGroundItems: function(type) {
      var count = 0;
      for (var i = 0; i < groundItems.length; i++) {
        if (groundItems[i].type === type && !groundItems[i].pickedUp) count++;
      }
      return count;
    },

    countBoxItems: function(type) {
      var count = 0;
      for (var i = 0; i < groundBoxes.length; i++) {
        if (groundBoxes[i].type === type && !groundBoxes[i].pickedUp) count += groundBoxes[i].remaining;
      }
      if (heldBox && heldBox.type === type) count += heldBox.remaining;
      return count;
    },

    spawnInDeliveryZone: function(type) {
      spawnInDeliveryZone(type);
    },

    spawnBoxInDeliveryZone: function(type) {
      spawnBoxInDeliveryZone(type);
    },

    spawnInstrumentInDeliveryZone: function(type) {
      spawnInstrumentInDeliveryZone(type);
    },

    dropFromPlayer: function(type) {
      dropFromPlayer(type);
    },

    // Staff APIs
    findNearestGroundItem: function(type, fromPos) {
      var best = null;
      var bestDist = Infinity;
      for (var i = 0; i < groundItems.length; i++) {
        var gi = groundItems[i];
        if (gi.type === type && !gi.pickedUp) {
          var dx = gi.mesh.position.x - fromPos.x;
          var dz = gi.mesh.position.z - fromPos.z;
          var d = dx * dx + dz * dz;
          if (d < bestDist) {
            bestDist = d;
            best = gi.mesh;
          }
        }
      }
      return best;
    },

    removeGroundItem: function(mesh) {
      for (var i = 0; i < groundItems.length; i++) {
        if (groundItems[i].mesh === mesh && !groundItems[i].pickedUp) {
          groundItems[i].pickedUp = true;
          scene.remove(groundItems[i].mesh);
          groundItems.splice(i, 1);
          return true;
        }
      }
      return false;
    },

    getGroundItemsByType: function(type) {
      var result = [];
      for (var i = 0; i < groundItems.length; i++) {
        if (groundItems[i].type === type && !groundItems[i].pickedUp) {
          result.push(groundItems[i].mesh);
        }
      }
      return result;
    },

    spawnAtPosition: function(type, position) {
      var mesh = isInstrument(type) ? createInstrumentMesh(type) : createConsumableMesh(type);
      mesh.position.copy(position);
      mesh.rotation.y = Math.random() * Math.PI * 2;
      scene.add(mesh);
      groundItems.push({
        type: type,
        mesh: mesh,
        velocity: new THREE.Vector3(0, 0, 0),
        grounded: true,
        pickedUp: false
      });
    },

    setup: function(_THREE, _scene, _camera, _controls, _collidables) {
      THREE = _THREE;
      scene = _scene;
      camera = _camera;
      controls = _controls;
      collidables = _collidables;

      interactRay = new THREE.Raycaster();
      interactRay.far = 5;
      screenCenter = new THREE.Vector2(0, 0);
      physicsRay = new THREE.Raycaster();
      hintEl = document.getElementById('interact-hint');
      heldBoxHintEl = document.getElementById('held-box-hint');

      createDeliveryZone();
      createTrashBin();

      // --- LMB: take from held box / pickup ground item ---
      document.addEventListener('mousedown', function(e) {
        if (e.button !== 0 || !controls.isLocked) return;
        if (Game.Patients.isPopupOpen() || Game.Shop.isOpen()) return;
        if (Game.Diagnostics && Game.Diagnostics.isActive()) return;
        if (Game.Patients.hasInteraction()) return;
        if (Game.WashingMachine && Game.WashingMachine.hasInteraction()) return;
        if (Game.Furniture && Game.Furniture.tryLinenReplace()) return;
        if (Game.Tutorial && Game.Tutorial.isActive() && !Game.Tutorial.isAllowed('pickup_item')) return;

        // If holding a box, LMB takes item from box
        if (heldBox) {
          if (Game.Cashier && Game.Cashier.isPopupOpen()) return;
          if (heldBox.remaining <= 0) return;
          if (Game.Inventory.addItem(heldBox.type)) {
            heldBox.remaining--;
            if (heldBox.remaining <= 0) {
              markBoxEmpty(heldBox);
            }
            if (Game.Tutorial && Game.Tutorial.isActive()) Game.Tutorial.onEvent('item_picked_up', heldBox.type);
          } else {
            Game.Inventory.showNotification('Инвентарь полон');
          }
          return;
        }

        // Take item from grounded box on LMB
        if (hoveredBox) {
          if (hoveredBox.remaining <= 0) return;
          if (Game.Inventory.addItem(hoveredBox.type)) {
            hoveredBox.remaining--;
            if (hoveredBox.remaining <= 0) {
              markBoxEmpty(hoveredBox);
            }
            if (Game.Tutorial && Game.Tutorial.isActive()) Game.Tutorial.onEvent('item_picked_up', hoveredBox.type);
          } else {
            Game.Inventory.showNotification('Инвентарь полон');
          }
          return;
        }

        // Normal item pickup
        if (!hoveredItem) return;
        if (Game.Inventory.addItem(hoveredItem.type)) {
          var pickedType = hoveredItem.type;
          hoveredItem.pickedUp = true;
          scene.remove(hoveredItem.mesh);
          unhighlightGroup(hoveredItem.mesh);
          hoveredItem = null;
          hintEl.style.display = 'none';
          if (Game.Tutorial && Game.Tutorial.isActive()) Game.Tutorial.onEvent('item_picked_up', pickedType);
        } else {
          Game.Inventory.showNotification('Инвентарь полон');
        }
      });

      // --- G key: throw held box / drop from inventory ---
      document.addEventListener('keydown', function(e) {
        if (e.code !== 'KeyG') return;
        if (!controls.isLocked) return;
        if (Game.Patients.isPopupOpen() || Game.Shop.isOpen()) return;
        if (Game.Tutorial && Game.Tutorial.isActive() && !Game.Tutorial.isAllowed('drop_item')) return;

        // Priority: throw held box
        if (heldBox) {
          throwHeldBox();
          return;
        }

        // Otherwise drop from inventory
        var type = Game.Inventory.getActive();
        if (!type) return;
        Game.Inventory.removeActive();
        dropFromPlayer(type);
      });

      // --- E key: pick up box ---
      document.addEventListener('keydown', function(e) {
        if (e.code !== 'KeyE') return;
        if (!controls.isLocked) return;
        if (Game.Patients.isPopupOpen() || Game.Shop.isOpen()) return;
        if (Game.Tutorial && Game.Tutorial.isActive() && !Game.Tutorial.isAllowed('pickup_box')) return;
        if (Game.Furniture && (Game.Furniture.isCarrying() || Game.Furniture.hasInteraction())) return;
        if (Game.WashingMachine && Game.WashingMachine.hasInteraction()) return;
        if (heldBox) return;
        if (!hoveredBox) return;

        heldBox = hoveredBox;
        heldBox.pickedUp = true;
        unhighlightGroup(hoveredBox.mesh);
        hoveredBox = null;
        hintEl.style.display = 'none';
      });

      // Register with central interaction system
      Game.Interaction.register('boxes', function() {
        var meshes = [];
        for (var i = 0; i < groundBoxes.length; i++) {
          if (groundBoxes[i].grounded && !groundBoxes[i].pickedUp) {
            meshes.push(groundBoxes[i].mesh);
          }
        }
        return meshes;
      }, true, 5);

      Game.Interaction.register('consumables', function() {
        var meshes = [];
        for (var i = 0; i < groundItems.length; i++) {
          if (groundItems[i].grounded && !groundItems[i].pickedUp) {
            meshes.push(groundItems[i].mesh);
          }
        }
        return meshes;
      }, true, 5);
    },

    update: function(delta) {
      updatePhysics(delta);
      updateHeldBox();

      // Central interaction system decides which module is active
      var boxInteracted = updateBoxInteraction();
      if (!boxInteracted && !heldBox) {
        updateInteraction();
      } else if (!boxInteracted) {
        if (hoveredItem) { unhighlightGroup(hoveredItem.mesh); hoveredItem = null; }
      }

      updateHeldBoxHints();
    }
  };
})();
