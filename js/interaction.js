(function() {
  window.Game = window.Game || {};

  var THREE, camera, controls;
  var ray, center;
  var modules = [];
  var activeModule = null;
  var hitResults = {};

  window.Game.Interaction = {
    setup: function(_THREE, _camera, _controls) {
      THREE = _THREE;
      camera = _camera;
      controls = _controls;
      ray = new THREE.Raycaster();
      center = new THREE.Vector2(0, 0);
    },

    register: function(name, getMeshesFn, recursive, maxDist) {
      modules.push({
        name: name,
        getMeshes: getMeshesFn,
        recursive: !!recursive,
        maxDist: maxDist || 5
      });
    },

    update: function() {
      activeModule = null;
      hitResults = {};

      if (!controls.isLocked) return;

      ray.setFromCamera(center, camera);

      var bestDist = Infinity;

      for (var i = 0; i < modules.length; i++) {
        var mod = modules[i];
        var meshes = mod.getMeshes();
        if (!meshes || meshes.length === 0) continue;

        ray.far = mod.maxDist;
        var hits = ray.intersectObjects(meshes, mod.recursive);

        if (hits.length > 0) {
          hitResults[mod.name] = hits;
          if (hits[0].distance < bestDist) {
            bestDist = hits[0].distance;
            activeModule = mod.name;
          }
        }
      }
    },

    isActive: function(name) {
      return activeModule === name;
    },

    getActive: function() {
      return activeModule;
    },

    hasAny: function() {
      return activeModule !== null;
    },

    getHits: function(name) {
      return hitResults[name] || null;
    },

    getRay: function() {
      return ray;
    }
  };
})();
