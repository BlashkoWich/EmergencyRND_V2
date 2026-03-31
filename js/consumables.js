(function() {
  window.Game = window.Game || {};

  var CONSUMABLE_TYPES = {
    strepsils:     { name: 'Стрепсилс',        color: 0xcc3333, size: { x: 0.15, y: 0.08, z: 0.10 } },
    painkiller:    { name: 'Обезболивающее',    color: 0x3366cc, size: { x: 0.18, y: 0.06, z: 0.12 } },
    antihistamine: { name: 'Антигистаминное',   color: 0x33aa55, size: { x: 0.14, y: 0.07, z: 0.10 } }
  };

  var GRAVITY = -9.8;
  var GROUND_Y = 0;
  var DELIVERY_ZONE = { cx: 0, cz: 5, hw: 1.5, hd: 1.0 };
  var DROP_FORWARD_SPEED = 4.0;
  var DROP_UP_SPEED = 2.0;

  var THREE, scene, camera, controls, collidables;
  var groundItems = [];
  var hoveredItem = null;
  var interactRay, screenCenter;
  var hintEl;
  var deliveryZoneMesh;
  var physicsRay; // reusable raycaster for physics collisions

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

  function createConsumableMesh(type) {
    var info = CONSUMABLE_TYPES[type];
    var geo = new THREE.BoxGeometry(info.size.x, info.size.y, info.size.z);
    var mat = new THREE.MeshStandardMaterial({ color: info.color, roughness: 0.5 });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.userData.consumableType = type;
    return mesh;
  }

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

  function dropFromPlayer(type) {
    var mesh = createConsumableMesh(type);
    // Spawn slightly in front and below camera
    var forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    var spawnPos = camera.position.clone().add(forward.clone().multiplyScalar(0.8));
    spawnPos.y -= 0.3;
    mesh.position.copy(spawnPos);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    scene.add(mesh);

    // Velocity: forward + slightly up
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

  // Check if moving along an axis would hit a collider
  function checkAxisCollision(pos, direction, distance, halfH) {
    // Cast from item center
    physicsRay.set(pos, direction);
    physicsRay.far = distance + 0.05;
    var hits = physicsRay.intersectObjects(collidables);
    if (hits.length > 0 && hits[0].distance < distance + 0.05) {
      return true;
    }
    return false;
  }

  function updatePhysics(delta) {
    var downDir = new THREE.Vector3(0, -1, 0);
    var tempPos = new THREE.Vector3();

    for (var i = 0; i < groundItems.length; i++) {
      var item = groundItems[i];
      if (item.grounded || item.pickedUp) continue;

      var halfH = CONSUMABLE_TYPES[item.type].size.y / 2;
      var halfW = CONSUMABLE_TYPES[item.type].size.x / 2;

      // Apply gravity
      item.velocity.y += GRAVITY * delta;

      var pos = item.mesh.position;
      var vel = item.velocity;

      // --- Horizontal collision (X axis) ---
      if (Math.abs(vel.x) > 0.001) {
        var dirX = new THREE.Vector3(vel.x > 0 ? 1 : -1, 0, 0);
        physicsRay.set(pos, dirX);
        physicsRay.far = Math.abs(vel.x * delta) + halfW + 0.02;
        var hitsX = physicsRay.intersectObjects(collidables);
        if (hitsX.length > 0 && hitsX[0].distance < Math.abs(vel.x * delta) + halfW + 0.02) {
          vel.x = 0;
        }
      }

      // --- Horizontal collision (Z axis) ---
      if (Math.abs(vel.z) > 0.001) {
        var dirZ = new THREE.Vector3(0, 0, vel.z > 0 ? 1 : -1);
        physicsRay.set(pos, dirZ);
        physicsRay.far = Math.abs(vel.z * delta) + halfW + 0.02;
        var hitsZ = physicsRay.intersectObjects(collidables);
        if (hitsZ.length > 0 && hitsZ[0].distance < Math.abs(vel.z * delta) + halfW + 0.02) {
          vel.z = 0;
        }
      }

      // --- Vertical collision (downward) ---
      var landedOnSurface = false;
      if (vel.y < 0) {
        physicsRay.set(pos, downDir);
        physicsRay.far = Math.abs(vel.y * delta) + halfH + 0.02;
        var hitsY = physicsRay.intersectObjects(collidables);
        if (hitsY.length > 0 && hitsY[0].distance < Math.abs(vel.y * delta) + halfH + 0.02) {
          pos.y = hitsY[0].point.y + halfH;
          vel.y = 0;
          vel.x *= 0.3; // friction
          vel.z *= 0.3;
          landedOnSurface = true;
          // Check if nearly stopped
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

      // Apply horizontal friction for items on ground/surface
      if (landedOnSurface && !item.grounded) {
        // Still sliding -- will decelerate next frame
      }
    }
  }

  function highlightItem(item) {
    item.mesh.material = item.mesh.material.clone();
    item.mesh.material.emissive = new THREE.Color(0x00ff44);
    item.mesh.material.emissiveIntensity = 0.35;
  }

  function unhighlightItem(item) {
    item.mesh.material.emissive = new THREE.Color(0x000000);
    item.mesh.material.emissiveIntensity = 0;
  }

  function getItemFromMesh(mesh) {
    for (var i = 0; i < groundItems.length; i++) {
      if (groundItems[i].mesh === mesh && !groundItems[i].pickedUp) return groundItems[i];
    }
    return null;
  }

  function updateInteraction() {
    if (!controls.isLocked || Game.Patients.isPopupOpen() || Game.Shop.isOpen()) {
      if (hoveredItem) { unhighlightItem(hoveredItem); hoveredItem = null; }
      return false;
    }
    if (Game.Patients.hasInteraction()) {
      if (hoveredItem) { unhighlightItem(hoveredItem); hoveredItem = null; }
      return false;
    }

    interactRay.setFromCamera(screenCenter, camera);
    var meshes = [];
    for (var i = 0; i < groundItems.length; i++) {
      if (groundItems[i].grounded && !groundItems[i].pickedUp) {
        meshes.push(groundItems[i].mesh);
      }
    }

    var hits = interactRay.intersectObjects(meshes);
    var newHovered = hits.length > 0 ? getItemFromMesh(hits[0].object) : null;

    if (newHovered !== hoveredItem) {
      if (hoveredItem) unhighlightItem(hoveredItem);
      if (newHovered) highlightItem(newHovered);
      hoveredItem = newHovered;
    }

    if (hoveredItem) {
      hintEl.textContent = 'Поднять на ЛКМ';
      hintEl.style.display = 'block';
      return true;
    }
    return false;
  }

  window.Game.Consumables = {
    TYPES: CONSUMABLE_TYPES,

    hasInteraction: function() { return !!hoveredItem; },

    countGroundItems: function(type) {
      var count = 0;
      for (var i = 0; i < groundItems.length; i++) {
        if (groundItems[i].type === type && !groundItems[i].pickedUp) count++;
      }
      return count;
    },

    spawnInDeliveryZone: function(type) {
      spawnInDeliveryZone(type);
    },

    dropFromPlayer: function(type) {
      dropFromPlayer(type);
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

      createDeliveryZone();

      // Pickup on click
      document.addEventListener('mousedown', function(e) {
        if (e.button !== 0 || !controls.isLocked) return;
        if (Game.Patients.isPopupOpen() || Game.Shop.isOpen()) return;
        if (Game.Patients.hasInteraction()) return;
        if (!hoveredItem) return;

        if (Game.Inventory.addItem(hoveredItem.type)) {
          hoveredItem.pickedUp = true;
          scene.remove(hoveredItem.mesh);
          unhighlightItem(hoveredItem);
          hoveredItem = null;
          hintEl.style.display = 'none';
        } else {
          Game.Inventory.showNotification('Инвентарь полон');
        }
      });

      // Drop on G key (KeyG works for both EN 'G' and RU 'П')
      document.addEventListener('keydown', function(e) {
        if (e.code !== 'KeyG') return;
        if (!controls.isLocked) return;
        if (Game.Patients.isPopupOpen() || Game.Shop.isOpen()) return;

        var type = Game.Inventory.getActive();
        if (!type) return;

        Game.Inventory.removeActive();
        dropFromPlayer(type);
      });
    },

    update: function(delta) {
      updatePhysics(delta);
      updateInteraction();
    }
  };
})();
