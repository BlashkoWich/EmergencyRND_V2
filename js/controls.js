(function() {
  window.Game = window.Game || {};

  window.Game.Controls = {
    _camera: null,
    _collidables: null,
    _controls: null,
    _THREE: null,
    _raycaster: null,
    _keys: { forward: false, backward: false, left: false, right: false },
    _moveSpeed: 4.0,
    _collisionDistance: 0.4,

    setup: function(THREE, camera, collidables, PointerLockControls) {
      this._THREE = THREE;
      this._camera = camera;
      this._collidables = collidables;
      this._raycaster = new THREE.Raycaster();

      var controls = new PointerLockControls(camera, document.body);
      controls.pointerSpeed = 0.5;
      this._controls = controls;

      var overlay = document.getElementById('overlay');
      var crosshairEl = document.getElementById('crosshair');

      overlay.addEventListener('click', function() { controls.lock(); });
      controls.addEventListener('lock', function() {
        overlay.style.display = 'none';
        crosshairEl.style.display = 'block';
      });
      controls.addEventListener('unlock', function() {
        overlay.style.display = 'flex';
        crosshairEl.style.display = 'none';
        document.getElementById('interact-hint').style.display = 'none';
      });

      // WASD (layout-independent via e.code)
      var keys = this._keys;
      document.addEventListener('keydown', function(e) {
        switch (e.code) {
          case 'KeyW': keys.forward = true; break;
          case 'KeyS': keys.backward = true; break;
          case 'KeyA': keys.left = true; break;
          case 'KeyD': keys.right = true; break;
        }
      });
      document.addEventListener('keyup', function(e) {
        switch (e.code) {
          case 'KeyW': keys.forward = false; break;
          case 'KeyS': keys.backward = false; break;
          case 'KeyA': keys.left = false; break;
          case 'KeyD': keys.right = false; break;
        }
      });

      return controls;
    },

    update: function(delta) {
      var THREE = this._THREE;
      var camera = this._camera;
      var keys = this._keys;
      var speed = this._moveSpeed * delta;

      var forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0; forward.normalize();

      var right = new THREE.Vector3();
      right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

      var moveDir = new THREE.Vector3();
      if (keys.forward)  moveDir.add(forward);
      if (keys.backward) moveDir.sub(forward);
      if (keys.left)     moveDir.sub(right);
      if (keys.right)    moveDir.add(right);

      if (moveDir.lengthSq() === 0) return;
      moveDir.normalize();

      var moveX = new THREE.Vector3(moveDir.x, 0, 0).normalize();
      var moveZ = new THREE.Vector3(0, 0, moveDir.z).normalize();

      if (moveDir.x !== 0 && this._canMove(moveX)) {
        camera.position.x += moveDir.x * speed;
      }
      if (moveDir.z !== 0 && this._canMove(moveZ)) {
        camera.position.z += moveDir.z * speed;
      }

      camera.position.y = 1.6;
    },

    _canMove: function(direction) {
      this._raycaster.set(this._camera.position, direction);
      this._raycaster.far = this._collisionDistance;
      var hits = this._raycaster.intersectObjects(this._collidables);
      return hits.length === 0;
    }
  };
})();
