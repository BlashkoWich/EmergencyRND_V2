(function() {
  window.Game = window.Game || {};

  var THREE, scene, camera, controls, collidables;
  var interactRay, screenCenter;
  var hintEl;

  var trashItems = []; // { mesh, variant, particleTimer, flies: [] }
  var stinkParticles = []; // { sprite, life, maxLife, vx, vy, vz, phase }
  var hoveredTrash = null;
  var spawnTimer = 0;
  var SPAWN_MIN = 45;
  var SPAWN_MAX = 60;
  var nextSpawnTime = 0;
  var MAX_TRASH = 10;

  // Main hall (excluding diag room in NW: x<-3 AND z<-13). Bounds cover whole building; the
  // diag-room exclusion is enforced in the spawn position check below.
  var INDOOR_BOUNDS = { xMin: -7.0, xMax: 7.0, zMin: -17.0, zMax: -1.0 };

  // ====== STINK PARTICLE TEXTURE ======

  var stinkTexture = null;

  function getStinkTexture() {
    if (stinkTexture) return stinkTexture;
    var canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    var ctx = canvas.getContext('2d');
    // Radial glow
    var grad = ctx.createRadialGradient(16, 16, 2, 16, 16, 14);
    grad.addColorStop(0, 'rgba(120, 180, 40, 0.8)');
    grad.addColorStop(0.5, 'rgba(100, 160, 30, 0.4)');
    grad.addColorStop(1, 'rgba(80, 140, 20, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    // Wavy ~ symbol
    ctx.strokeStyle = 'rgba(140, 200, 50, 0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(6, 18);
    ctx.bezierCurveTo(10, 12, 14, 22, 18, 14);
    ctx.bezierCurveTo(22, 8, 24, 20, 28, 14);
    ctx.stroke();
    stinkTexture = new THREE.CanvasTexture(canvas);
    stinkTexture.minFilter = THREE.LinearFilter;
    return stinkTexture;
  }

  // ====== FLY TEXTURE ======

  var flyTexture = null;

  function getFlyTexture() {
    if (flyTexture) return flyTexture;
    var canvas = document.createElement('canvas');
    canvas.width = 16; canvas.height = 16;
    var ctx = canvas.getContext('2d');
    // Body — dark oval
    ctx.fillStyle = '#222222';
    ctx.beginPath();
    ctx.ellipse(8, 9, 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Wings — translucent gray
    ctx.fillStyle = 'rgba(180, 180, 200, 0.6)';
    ctx.beginPath();
    ctx.ellipse(4, 6, 3, 2, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(12, 6, 3, 2, 0.4, 0, Math.PI * 2);
    ctx.fill();
    flyTexture = new THREE.CanvasTexture(canvas);
    flyTexture.minFilter = THREE.LinearFilter;
    return flyTexture;
  }

  // ====== TRASH MESH CREATION ======

  function createTrashMesh(variant) {
    var group = new THREE.Group();

    if (variant === 'banana') {
      // Banana peel — curved yellow shape with brown spots
      var peelMat = new THREE.MeshLambertMaterial({ color: 0xddc830 });
      var brownMat = new THREE.MeshLambertMaterial({ color: 0x8b6914 });

      // Main peel body — flat curved
      var body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.08), peelMat);
      body.position.y = 0.01;
      body.rotation.z = 0.1;
      group.add(body);

      // Peel flaps splayed out
      var flap1 = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.015, 0.06), peelMat);
      flap1.position.set(-0.08, 0.015, 0.06);
      flap1.rotation.set(0.3, 0.2, -0.4);
      group.add(flap1);

      var flap2 = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.015, 0.06), peelMat);
      flap2.position.set(0.06, 0.015, -0.05);
      flap2.rotation.set(-0.2, -0.3, 0.3);
      group.add(flap2);

      var flap3 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.015, 0.05), peelMat);
      flap3.position.set(0.10, 0.02, 0.03);
      flap3.rotation.set(0.1, 0.5, 0.5);
      group.add(flap3);

      // Brown tip
      var tip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.03), brownMat);
      tip.position.set(-0.12, 0.01, 0);
      group.add(tip);

      // Brown spots
      var spot1 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.022, 0.02), brownMat);
      spot1.position.set(0.02, 0.02, 0.01);
      group.add(spot1);

      var spot2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.022, 0.025), brownMat);
      spot2.position.set(-0.04, 0.02, -0.02);
      group.add(spot2);

    } else if (variant === 'foodbag') {
      // Crumpled food bag — several tilted boxes simulating folds
      var bagColors = [0xee3333, 0xff8800, 0x2288dd, 0x44bb44];
      var mainColor = bagColors[Math.floor(Math.random() * bagColors.length)];
      var bagMat = new THREE.MeshLambertMaterial({ color: mainColor });

      // Main crumpled body
      var main = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.10, 0.12), bagMat);
      main.position.y = 0.05;
      main.rotation.set(0.15, Math.random() * 0.5, 0.2);
      group.add(main);

      // Crumpled folds
      var fold1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.10), bagMat);
      fold1.position.set(0.06, 0.08, 0.02);
      fold1.rotation.set(-0.3, 0.4, 0.5);
      group.add(fold1);

      var fold2 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.08), bagMat);
      fold2.position.set(-0.04, 0.09, -0.03);
      fold2.rotation.set(0.4, -0.2, -0.3);
      group.add(fold2);

      // Grease stain
      var stainMat = new THREE.MeshLambertMaterial({ color: 0x998855 });
      var stain = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.002, 0.05), stainMat);
      stain.position.set(0.01, 0.101, 0.02);
      stain.rotation.x = 0.15;
      group.add(stain);

    } else if (variant === 'apple') {
      // Apple core — small cylinder with stem
      var coreMat = new THREE.MeshLambertMaterial({ color: 0xccaa66 });
      var skinMat = new THREE.MeshLambertMaterial({ color: 0xcc3333 });

      // Core body
      var core = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.08, 8), coreMat);
      core.position.y = 0.04;
      core.rotation.z = 0.3;
      group.add(core);

      // Remaining skin patches
      var skin1 = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.06, 0.015), skinMat);
      skin1.position.set(0.03, 0.04, 0.01);
      skin1.rotation.z = 0.3;
      group.add(skin1);

      var skin2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.02), skinMat);
      skin2.position.set(-0.025, 0.04, -0.015);
      skin2.rotation.z = 0.3;
      group.add(skin2);

      // Stem
      var stemMat = new THREE.MeshLambertMaterial({ color: 0x665533 });
      var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.05, 4), stemMat);
      stem.position.set(0.01, 0.09, 0);
      stem.rotation.set(0.1, 0, 0.2);
      group.add(stem);

      // Brown oxidation spots
      var oxidMat = new THREE.MeshLambertMaterial({ color: 0x886633 });
      var oxid = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.015), oxidMat);
      oxid.position.set(0, 0.04, 0.025);
      oxid.rotation.z = 0.3;
      group.add(oxid);

    } else if (variant === 'cup') {
      // Crushed paper cup — tilted cylinder, dented
      var cupMat = new THREE.MeshLambertMaterial({ color: 0xf0f0f0 });

      // Main cup body (slightly squished via scale)
      var cup = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.12, 8), cupMat);
      cup.position.set(0, 0.03, 0);
      cup.rotation.z = Math.PI / 2 + 0.2; // Lying on its side
      cup.rotation.x = 0.15;
      cup.scale.set(1, 0.8, 1); // Squish
      group.add(cup);

      // Colored brand stripe
      var stripeColors = [0xcc2222, 0x2266cc, 0x22aa44];
      var stripeMat = new THREE.MeshLambertMaterial({
        color: stripeColors[Math.floor(Math.random() * stripeColors.length)]
      });
      var stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.032, 0.04, 8), stripeMat);
      stripe.position.set(0, 0.03, 0);
      stripe.rotation.z = Math.PI / 2 + 0.2;
      stripe.rotation.x = 0.15;
      stripe.scale.set(1, 0.8, 1);
      group.add(stripe);

      // Coffee/liquid stain on floor
      var stainMat = new THREE.MeshLambertMaterial({
        color: 0x664422, transparent: true, opacity: 0.5
      });
      var stain = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.003, 0.06), stainMat);
      stain.position.set(0.05, 0.001, 0);
      group.add(stain);
    }

    group.userData.isTrash = true;
    return group;
  }

  // ====== FLY CREATION ======

  function createFlies(trashPos) {
    var flies = [];
    var count = 2 + Math.floor(Math.random() * 2); // 2-3 flies
    for (var i = 0; i < count; i++) {
      var mat = new THREE.SpriteMaterial({
        map: getFlyTexture(),
        transparent: true,
        depthTest: false
      });
      var sprite = new THREE.Sprite(mat);
      sprite.scale.set(0.06, 0.06, 1);
      scene.add(sprite);
      flies.push({
        sprite: sprite,
        phase: Math.random() * Math.PI * 2,
        speed: 2.5 + Math.random() * 1.5, // rad/sec
        radius: 0.25 + Math.random() * 0.15,
        baseY: 0.15 + Math.random() * 0.15
      });
    }
    return flies;
  }

  function updateFlies(item, delta) {
    var cx = item.mesh.position.x;
    var cz = item.mesh.position.z;
    for (var i = 0; i < item.flies.length; i++) {
      var fly = item.flies[i];
      fly.phase += fly.speed * delta;
      fly.sprite.position.x = cx + fly.radius * Math.cos(fly.phase);
      fly.sprite.position.z = cz + fly.radius * Math.sin(fly.phase);
      fly.sprite.position.y = fly.baseY + Math.sin(fly.phase * 2.3) * 0.05;
    }
  }

  function removeFlies(item) {
    for (var i = 0; i < item.flies.length; i++) {
      scene.remove(item.flies[i].sprite);
    }
    item.flies.length = 0;
  }

  // ====== STINK PARTICLES ======

  var STINK_INTERVAL = 0.4;
  var STINK_LIFETIME = 1.5;
  var STINK_SPEED_Y = 0.3;

  function spawnStinkParticle(pos) {
    var mat = new THREE.SpriteMaterial({
      map: getStinkTexture(),
      transparent: true,
      depthTest: false
    });
    var sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.08, 0.08, 1);
    sprite.position.set(
      pos.x + (Math.random() - 0.5) * 0.15,
      0.05 + Math.random() * 0.05,
      pos.z + (Math.random() - 0.5) * 0.15
    );
    scene.add(sprite);
    stinkParticles.push({
      sprite: sprite,
      life: STINK_LIFETIME,
      maxLife: STINK_LIFETIME,
      vx: (Math.random() - 0.5) * 0.05,
      vy: STINK_SPEED_Y,
      phase: Math.random() * Math.PI * 2
    });
  }

  function updateStinkParticles(delta) {
    // Spawn from each trash item
    for (var i = 0; i < trashItems.length; i++) {
      var item = trashItems[i];
      item.particleTimer += delta;
      if (item.particleTimer >= STINK_INTERVAL) {
        item.particleTimer -= STINK_INTERVAL;
        spawnStinkParticle(item.mesh.position);
      }
    }

    // Update existing particles
    for (var i = stinkParticles.length - 1; i >= 0; i--) {
      var p = stinkParticles[i];
      p.life -= delta;
      if (p.life <= 0) {
        scene.remove(p.sprite);
        stinkParticles.splice(i, 1);
        continue;
      }
      var alpha = p.life / p.maxLife;
      p.sprite.position.y += p.vy * delta;
      p.phase += delta * 2.0;
      p.sprite.position.x += Math.sin(p.phase) * 0.15 * delta; // Sway
      p.sprite.material.opacity = alpha * 0.7;
      var s = 0.08 * (0.5 + 0.5 * alpha);
      p.sprite.scale.set(s, s, 1);
    }
  }

  function removeStinkParticlesFor(pos) {
    // Remove particles near removed trash
    for (var i = stinkParticles.length - 1; i >= 0; i--) {
      var sp = stinkParticles[i].sprite.position;
      var dx = sp.x - pos.x;
      var dz = sp.z - pos.z;
      if (dx * dx + dz * dz < 0.25) {
        scene.remove(stinkParticles[i].sprite);
        stinkParticles.splice(i, 1);
      }
    }
  }

  // ====== SPAWN LOGIC ======

  function resetSpawnTimer() {
    nextSpawnTime = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN);
    spawnTimer = 0;
  }

  function getRandomSpawnPos() {
    for (var attempt = 0; attempt < 10; attempt++) {
      var x = INDOOR_BOUNDS.xMin + Math.random() * (INDOOR_BOUNDS.xMax - INDOOR_BOUNDS.xMin);
      var z = INDOOR_BOUNDS.zMin + Math.random() * (INDOOR_BOUNDS.zMax - INDOOR_BOUNDS.zMin);

      // Exclude diagnostic room footprint (x<-3 AND z<-13)
      if (x < -3 && z < -13) continue;

      var tooClose = false;
      for (var i = 0; i < collidables.length; i++) {
        var obj = collidables[i];
        var dx = x - obj.position.x;
        var dz = z - obj.position.z;
        if (dx * dx + dz * dz < 0.64) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) {
        return new THREE.Vector3(x, 0, z);
      }
    }
    return null;
  }

  var VARIANTS = ['banana', 'foodbag', 'apple', 'cup'];

  function spawnTrash(pos) {
    var variant = VARIANTS[Math.floor(Math.random() * VARIANTS.length)];
    var mesh = createTrashMesh(variant);
    mesh.position.copy(pos);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    scene.add(mesh);
    var flies = createFlies(pos);
    trashItems.push({ mesh: mesh, variant: variant, particleTimer: 0, flies: flies });
  }

  function updateSpawning(delta) {
    if (Game.Levels.getLevel() < 3) return;
    spawnTimer += delta;
    if (spawnTimer >= nextSpawnTime) {
      if (trashItems.length < MAX_TRASH) {
        var pos = getRandomSpawnPos();
        if (pos) {
          spawnTrash(pos);
        }
      }
      resetSpawnTimer();
    }
  }

  // ====== HIGHLIGHT ======

  function highlightTrash(group) {
    Game.Outline.setHover([group]);
  }

  function unhighlightTrash(group) {
    Game.Outline.clearHover();
  }

  // ====== PLAYER INTERACTION ======

  function clearHover() {
    if (hoveredTrash) {
      unhighlightTrash(hoveredTrash.mesh);
      hoveredTrash = null;
    }
  }

  function updateInteraction() {
    if (!controls.isLocked || Game.Patients.isPopupOpen() || Game.Shop.isOpen()) {
      clearHover();
      return false;
    }
    if (Game.Diagnostics && Game.Diagnostics.isActive()) {
      clearHover();
      return false;
    }
    if (!Game.Interaction.isActive('trash')) { clearHover(); return false; }

    var hits = Game.Interaction.getHits('trash');
    var newHovered = null;
    if (hits) {
      var hitObj = hits[0].object;
      for (var i = 0; i < trashItems.length; i++) {
        var current = hitObj;
        while (current) {
          if (current === trashItems[i].mesh) { newHovered = trashItems[i]; break; }
          current = current.parent;
        }
        if (newHovered) break;
      }
    }

    if (newHovered !== hoveredTrash) {
      if (hoveredTrash) unhighlightTrash(hoveredTrash.mesh);
      if (newHovered) highlightTrash(newHovered.mesh);
      hoveredTrash = newHovered;
    }

    if (hoveredTrash) {
      hintEl.textContent = Game.Lang.t('trash.hint');
      hintEl.style.display = 'block';
      return true;
    }
    return false;
  }

  // ====== REMOVAL ======

  function removeTrashItem(item) {
    var pos = item.mesh.position.clone();
    scene.remove(item.mesh);
    removeFlies(item);
    removeStinkParticlesFor(pos);
    for (var i = 0; i < trashItems.length; i++) {
      if (trashItems[i] === item) {
        trashItems.splice(i, 1);
        break;
      }
    }
    if (hoveredTrash === item) {
      hoveredTrash = null;
      hintEl.style.display = 'none';
    }
  }

  // ====== PUBLIC API ======

  window.Game.Trash = {
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

      resetSpawnTimer();

      document.addEventListener('mousedown', function(e) {
        if (e.button !== 0 || !controls.isLocked) return;
        if (Game.Patients.isPopupOpen() || Game.Shop.isOpen()) return;
        if (!hoveredTrash) return;
        if (Game.Patients.hasInteraction()) return;
        if (Game.Furniture && (Game.Furniture.hasInteraction() || Game.Furniture.isCarrying())) return;
        if (Game.Consumables.hasInteraction() || Game.Consumables.hasBoxInteraction() || Game.Consumables.isHoldingBox()) return;
        if (Game.Shelves && Game.Shelves.hasInteraction()) return;

        removeTrashItem(hoveredTrash);
      });

      // Register with central interaction system
      Game.Interaction.register('trash', function() {
        var meshes = [];
        for (var i = 0; i < trashItems.length; i++) {
          meshes.push(trashItems[i].mesh);
        }
        return meshes;
      }, true, 5);
    },

    update: function(delta) {
      updateSpawning(delta);
      updateInteraction();
      updateStinkParticles(delta);
      // Update flies for each trash item
      for (var i = 0; i < trashItems.length; i++) {
        updateFlies(trashItems[i], delta);
      }
    },

    hasInteraction: function() {
      return !!hoveredTrash;
    },

    getTrashItems: function() {
      var result = [];
      for (var i = 0; i < trashItems.length; i++) {
        result.push(trashItems[i].mesh);
      }
      return result;
    },

    getCount: function() {
      return trashItems.length;
    },

    removeTrash: function(mesh) {
      for (var i = 0; i < trashItems.length; i++) {
        if (trashItems[i].mesh === mesh) {
          removeTrashItem(trashItems[i]);
          return true;
        }
      }
      return false;
    },

    findNearest: function(fromPos) {
      var best = null;
      var bestDist = Infinity;
      for (var i = 0; i < trashItems.length; i++) {
        var p = trashItems[i].mesh.position;
        var dx = p.x - fromPos.x;
        var dz = p.z - fromPos.z;
        var d = dx * dx + dz * dz;
        if (d < bestDist) {
          bestDist = d;
          best = trashItems[i].mesh;
        }
      }
      return best;
    }
  };
})();
