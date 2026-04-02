(function() {
  window.Game = window.Game || {};

  window.Game.Controls = {
    _camera: null,
    _collidables: null,
    _controls: null,
    _THREE: null,
    _raycaster: null,
    _keys: { forward: false, backward: false, left: false, right: false, sprint: false, jump: false },
    _moveSpeed: 4.0,
    _sprintSpeed: 7.0,
    _collisionDistance: 0.4,
    _collisionOrigin: null,
    _savedQuat: null, // saved quaternion to restore after re-lock
    _forward: null,
    _right: null,
    _moveDir: null,
    _moveX: null,
    _moveZ: null,
    _velocityY: 0,
    _jumpSpeed: 5.0,
    _gravity: -12.0,
    _groundY: 1.6,
    _isGrounded: true,

    setup: function(THREE, camera, collidables, PointerLockControls) {
      this._THREE = THREE;
      this._camera = camera;
      this._collidables = collidables;
      this._raycaster = new THREE.Raycaster();
      this._collisionOrigin = new THREE.Vector3();
      this._forward = new THREE.Vector3();
      this._right = new THREE.Vector3();
      this._moveDir = new THREE.Vector3();
      this._moveX = new THREE.Vector3();
      this._moveZ = new THREE.Vector3();

      // Filter out bogus large mouse deltas (known Pointer Lock API browser bug)
      // Capture phase runs before PointerLockControls' bubble-phase listener
      var MAX_MOUSE_DELTA = 150;
      document.addEventListener('mousemove', function(e) {
        if (Math.abs(e.movementX) > MAX_MOUSE_DELTA || Math.abs(e.movementY) > MAX_MOUSE_DELTA) {
          e.stopImmediatePropagation();
        }
      }, true);

      var controls = new PointerLockControls(camera, document.body);
      controls.pointerSpeed = 0.5;
      this._controls = controls;
      var self = this;

      var overlay = document.getElementById('overlay');
      var crosshairEl = document.getElementById('crosshair');

      overlay.addEventListener('click', function() { controls.lock(); });
      controls.addEventListener('lock', function() {
        // Save camera orientation to restore on next frame,
        // preventing the jump from accumulated mouse delta during lock transition
        self._savedQuat = camera.quaternion.clone();
        overlay.style.display = 'none';
        crosshairEl.style.display = 'block';
      });
      controls.addEventListener('unlock', function() {
        if (Game.Shop && Game.Shop.isOpen()) return;
        if (Game.Patients && Game.Patients.isPopupOpen()) return;
        if (Game.Diagnostics && Game.Diagnostics.isActive()) return;
        if (Game.Shift && Game.Shift.isPopupOpen()) return;
        if (Game.Levels && Game.Levels.isPopupOpen()) return;
        if (Game.Cashier && Game.Cashier.isPopupOpen()) return;
        var levelSelect = document.getElementById('level-select-screen');
        if (levelSelect && levelSelect.style.display !== 'none') return;
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
          case 'ShiftLeft': keys.sprint = true; break;
          case 'Space': keys.jump = true; e.preventDefault(); break;
        }
      });
      document.addEventListener('keyup', function(e) {
        switch (e.code) {
          case 'KeyW': keys.forward = false; break;
          case 'KeyS': keys.backward = false; break;
          case 'KeyA': keys.left = false; break;
          case 'KeyD': keys.right = false; break;
          case 'ShiftLeft': keys.sprint = false; break;
          case 'Space': keys.jump = false; break;
        }
      });

      return controls;
    },

    update: function(delta) {
      var THREE = this._THREE;
      var camera = this._camera;

      // Restore saved orientation after re-lock to prevent camera jump
      if (this._savedQuat) {
        camera.quaternion.copy(this._savedQuat);
        this._savedQuat = null;
        return; // skip movement this frame
      }

      var keys = this._keys;
      var baseSpeed = keys.sprint ? this._sprintSpeed : this._moveSpeed;
      var speed = baseSpeed * delta;

      var forward = this._forward;
      camera.getWorldDirection(forward);
      forward.y = 0; forward.normalize();

      var right = this._right;
      right.set(0, 0, 0);
      right.crossVectors(forward, camera.up).normalize();

      var moveDir = this._moveDir.set(0, 0, 0);
      if (keys.forward)  moveDir.add(forward);
      if (keys.backward) moveDir.sub(forward);
      if (keys.left)     moveDir.sub(right);
      if (keys.right)    moveDir.add(right);

      if (moveDir.lengthSq() > 0) {
        moveDir.normalize();

        var moveX = this._moveX.set(moveDir.x, 0, 0).normalize();
        var moveZ = this._moveZ.set(0, 0, moveDir.z).normalize();

        if (moveDir.x !== 0 && this._canMove(moveX)) {
          camera.position.x += moveDir.x * speed;
        }
        if (moveDir.z !== 0 && this._canMove(moveZ)) {
          camera.position.z += moveDir.z * speed;
        }
      }

      // Jump initiation
      if (keys.jump && this._isGrounded) {
        this._velocityY = this._jumpSpeed;
        this._isGrounded = false;
      }

      // Apply gravity
      this._velocityY += this._gravity * delta;
      camera.position.y += this._velocityY * delta;

      // Ground clamp
      if (camera.position.y <= this._groundY) {
        camera.position.y = this._groundY;
        this._velocityY = 0;
        this._isGrounded = true;
      }
    },

    _canMove: function(direction) {
      this._collisionOrigin.copy(this._camera.position);
      this._collisionOrigin.y = 0.5;
      this._raycaster.set(this._collisionOrigin, direction);
      this._raycaster.far = this._collisionDistance;
      var hits = this._raycaster.intersectObjects(this._collidables);
      return hits.length === 0;
    }
  };
})();
