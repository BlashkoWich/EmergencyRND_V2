(function() {
  window.Game = window.Game || {};

  window.Game.Helpers = {
    createWall(THREE, scene, collidables, x, z, w, d, opts) {
      opts = opts || {};
      var h = opts.h || 3;
      var y = opts.y || h / 2;
      var color = opts.color || 0xe8f0f8;
      var geo = new THREE.BoxGeometry(w, h, d);
      var mat = new THREE.MeshLambertMaterial({ color: color });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      collidables.push(mesh);
      return mesh;
    },

    createSign(THREE, scene, text, x, y, z, rotY) {
      var canvas = document.createElement('canvas');
      canvas.width = 512; canvas.height = 128;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#2a5a8a';
      ctx.fillRect(0, 0, 512, 128);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 48px Segoe UI, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 256, 64);
      var tex = new THREE.CanvasTexture(canvas);
      var geo = new THREE.PlaneGeometry(1.2, 0.3);
      var mat = new THREE.MeshLambertMaterial({ map: tex });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.rotation.y = rotY || 0;
      scene.add(mesh);
      return mesh;
    },

    createTileTexture(THREE) {
      var c = document.createElement('canvas');
      c.width = 256; c.height = 256;
      var ctx = c.getContext('2d');
      var s = 64;
      for (var r = 0; r < 4; r++) {
        for (var col = 0; col < 4; col++) {
          ctx.fillStyle = (r + col) % 2 === 0 ? '#c8d0c8' : '#b8c4b8';
          ctx.fillRect(col * s, r * s, s, s);
          ctx.strokeStyle = '#a0aca0'; ctx.lineWidth = 1;
          ctx.strokeRect(col * s, r * s, s, s);
        }
      }
      var tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(8, 6);
      return tex;
    },

    createAsphaltTexture(THREE) {
      var c = document.createElement('canvas');
      c.width = 256; c.height = 256;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#555558';
      ctx.fillRect(0, 0, 256, 256);
      for (var i = 0; i < 800; i++) {
        var x = Math.random() * 256, y = Math.random() * 256;
        var g = 60 + Math.random() * 40;
        ctx.fillStyle = 'rgb(' + g + ',' + g + ',' + g + ')';
        ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
      }
      var tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(20, 20);
      return tex;
    },

    createGrassTexture(THREE) {
      var c = document.createElement('canvas');
      c.width = 256; c.height = 256;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#4a8a3a';
      ctx.fillRect(0, 0, 256, 256);
      for (var i = 0; i < 1200; i++) {
        var x = Math.random() * 256, y = Math.random() * 256;
        var g = 90 + Math.random() * 80;
        ctx.fillStyle = 'rgb(' + (30 + Math.random()*30) + ',' + g + ',' + (20 + Math.random()*20) + ')';
        ctx.fillRect(x, y, 1, 2 + Math.random() * 3);
      }
      var tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(15, 15);
      return tex;
    }
  };
})();
