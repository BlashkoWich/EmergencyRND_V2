(function() {
  window.Game = window.Game || {};

  var slots = [null, null, null, null, null, null];
  var activeSlot = 0;
  var barEl, slotEls, notificationEl, hintsEl, hintShopEl, hintDropEl, activeNameEl;
  var notificationTimer = null;
  var iconCache = {}; // type -> dataURL

  // --- Icon generation (128x128 hi-res) ---
  function generateIcon(type) {
    if (iconCache[type]) return iconCache[type];
    var S = 128;
    var c = document.createElement('canvas');
    c.width = S; c.height = S;
    var ctx = c.getContext('2d');

    var types = Game.Consumables.TYPES;
    var instrTypes = Game.Consumables.INSTRUMENT_TYPES;
    var info = types[type] || instrTypes[type];
    if (!info) return null;
    var r = (info.color >> 16) & 255, g = (info.color >> 8) & 255, b = info.color & 255;
    var hex = 'rgb(' + r + ',' + g + ',' + b + ')';
    var hexLight = 'rgb(' + Math.min(255, r + 60) + ',' + Math.min(255, g + 60) + ',' + Math.min(255, b + 60) + ')';

    if (type === 'strepsils') {
      // Blister pack — flat red plate with 6 round pills
      ctx.fillStyle = hex;
      ctx.beginPath();
      ctx.roundRect(10, 24, 108, 80, 10);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Foil backing
      ctx.fillStyle = 'rgba(200,200,220,0.15)';
      ctx.beginPath();
      ctx.roundRect(14, 28, 100, 72, 8);
      ctx.fill();
      // 6 pills (2 rows x 3)
      for (var row = 0; row < 2; row++) {
        for (var col = 0; col < 3; col++) {
          var px = 32 + col * 32;
          var py = 46 + row * 30;
          ctx.beginPath();
          ctx.arc(px, py, 12, 0, Math.PI * 2);
          ctx.fillStyle = '#ee5555';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.25)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(px - 3, py - 3, 4, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.fill();
        }
      }

    } else if (type === 'painkiller') {
      // Pill bottle — blue cylinder with white cap and label
      ctx.fillStyle = hex;
      ctx.beginPath();
      ctx.roundRect(30, 16, 68, 96, 8);
      ctx.fill();
      // Highlight strip
      ctx.fillStyle = hexLight;
      ctx.fillRect(34, 16, 14, 96);
      // White cap
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(26, 8, 76, 20, 5);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // White label band
      ctx.fillStyle = '#eeeef4';
      ctx.beginPath();
      ctx.roundRect(34, 56, 60, 30, 4);
      ctx.fill();
      // Rx text on label
      ctx.fillStyle = hex;
      ctx.font = 'bold 20px Segoe UI, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Rx', 64, 78);

    } else if (type === 'antihistamine') {
      // Medicine box — green box with large white cross
      ctx.fillStyle = hex;
      ctx.beginPath();
      ctx.roundRect(16, 16, 96, 96, 8);
      ctx.fill();
      ctx.strokeStyle = hexLight;
      ctx.lineWidth = 2;
      ctx.stroke();
      // Large white cross centered
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(50, 28, 28, 72, 4);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(28, 50, 72, 28, 4);
      ctx.fill();

    } else if (type === 'instrument_stethoscope') {
      // Stethoscope — curved tube + chest piece + earpieces
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // Tube (curved)
      ctx.strokeStyle = hex;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(64, 90);
      ctx.quadraticCurveTo(64, 50, 64, 42);
      ctx.stroke();
      // Y-split
      ctx.beginPath();
      ctx.moveTo(64, 42);
      ctx.quadraticCurveTo(58, 32, 44, 24);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(64, 42);
      ctx.quadraticCurveTo(70, 32, 84, 24);
      ctx.stroke();
      // Chest piece (silver disk)
      ctx.beginPath();
      ctx.arc(64, 94, 12, 0, Math.PI * 2);
      ctx.fillStyle = '#b0b0b0';
      ctx.fill();
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(62, 91, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fill();
      // Ear tips
      ctx.fillStyle = '#444';
      ctx.beginPath();
      ctx.arc(40, 20, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(88, 20, 5, 0, Math.PI * 2);
      ctx.fill();

    } else if (type === 'instrument_hammer') {
      // Reflex hammer — long handle + triangular rubber head
      ctx.lineCap = 'round';
      // Handle
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(64, 30);
      ctx.lineTo(64, 96);
      ctx.stroke();
      // Metal band
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(64, 32);
      ctx.lineTo(64, 36);
      ctx.stroke();
      // Rubber head (triangular)
      ctx.fillStyle = hex;
      ctx.beginPath();
      ctx.ellipse(64, 24, 22, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Highlight
      ctx.beginPath();
      ctx.ellipse(60, 21, 8, 4, -0.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fill();

    } else if (type === 'instrument_rhinoscope') {
      // Rhinoscope — pen-like device with light tip
      ctx.lineCap = 'round';
      // Body
      ctx.fillStyle = hex;
      ctx.beginPath();
      ctx.roundRect(52, 28, 24, 56, 4);
      ctx.fill();
      ctx.strokeStyle = hexLight;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Grip (darker)
      ctx.fillStyle = '#555';
      ctx.beginPath();
      ctx.roundRect(50, 72, 28, 18, 4);
      ctx.fill();
      // Grip texture lines
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      for (var ly = 75; ly < 88; ly += 3) {
        ctx.beginPath();
        ctx.moveTo(52, ly);
        ctx.lineTo(76, ly);
        ctx.stroke();
      }
      // Cone tip
      ctx.fillStyle = '#ccc';
      ctx.beginPath();
      ctx.moveTo(52, 28);
      ctx.lineTo(76, 28);
      ctx.lineTo(64, 14);
      ctx.closePath();
      ctx.fill();
      // Light at tip (glow)
      ctx.beginPath();
      ctx.arc(64, 14, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffaa';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(64, 14, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,200,0.2)';
      ctx.fill();
    }

    var url = c.toDataURL();
    iconCache[type] = url;
    return url;
  }

  function createUI() {
    var container = document.createElement('div');
    container.id = 'inventory-container';

    // Active item name (above bar)
    activeNameEl = document.createElement('div');
    activeNameEl.id = 'inventory-active-name';
    container.appendChild(activeNameEl);

    // Inventory bar
    barEl = document.createElement('div');
    barEl.id = 'inventory-bar';

    for (var i = 0; i < 6; i++) {
      var slot = document.createElement('div');
      slot.className = 'inv-slot' + (i === 0 ? ' active' : '');
      slot.dataset.index = i;

      var item = document.createElement('div');
      item.className = 'inv-item';
      slot.appendChild(item);

      var label = document.createElement('span');
      label.className = 'inv-label';
      label.textContent = String(i + 1);
      slot.appendChild(label);

      barEl.appendChild(slot);
    }
    container.appendChild(barEl);

    // Hints row
    hintsEl = document.createElement('div');
    hintsEl.id = 'inventory-hints';

    hintShopEl = document.createElement('span');
    hintShopEl.className = 'inv-hint';
    hintShopEl.textContent = 'Q — Магазин';
    hintsEl.appendChild(hintShopEl);

    hintDropEl = document.createElement('span');
    hintDropEl.className = 'inv-hint';
    hintDropEl.textContent = 'G — Бросить';
    hintDropEl.style.display = 'none';
    hintsEl.appendChild(hintDropEl);

    container.appendChild(hintsEl);
    document.body.appendChild(container);
    slotEls = barEl.querySelectorAll('.inv-slot');

    // Notification
    notificationEl = document.createElement('div');
    notificationEl.id = 'notification';
    document.body.appendChild(notificationEl);
  }

  function refreshUI() {
    var types = Game.Consumables.TYPES;
    var instrTypes = Game.Consumables.INSTRUMENT_TYPES;
    for (var i = 0; i < 6; i++) {
      var el = slotEls[i];
      var itemEl = el.querySelector('.inv-item');
      el.className = 'inv-slot' + (i === activeSlot ? ' active' : '');

      if (slots[i]) {
        var info = types[slots[i]] || instrTypes[slots[i]];
        var icon = generateIcon(slots[i]);
        if (icon) {
          itemEl.style.backgroundImage = 'url(' + icon + ')';
          itemEl.style.backgroundSize = 'cover';
          itemEl.style.backgroundColor = 'transparent';
        } else {
          itemEl.style.backgroundImage = '';
          itemEl.style.backgroundColor = '#' + info.color.toString(16).padStart(6, '0');
        }
        itemEl.style.display = 'block';
        itemEl.title = info.name;
      } else {
        itemEl.style.display = 'none';
        itemEl.style.backgroundImage = '';
        itemEl.title = '';
      }
    }

    // Active item name
    if (activeNameEl) {
      var activeType = slots[activeSlot];
      if (activeType) {
        var activeInfo = types[activeType] || instrTypes[activeType];
        activeNameEl.textContent = activeInfo.name;
        activeNameEl.style.display = 'block';
      } else {
        activeNameEl.textContent = '';
        activeNameEl.style.display = 'none';
      }
    }

    // Show/hide drop hint
    if (hintDropEl) {
      if (Game.Consumables && Game.Consumables.isHoldingBox()) {
        hintDropEl.style.display = 'none';
      } else {
        hintDropEl.style.display = slots[activeSlot] ? 'inline' : 'none';
      }
    }
  }

  window.Game.Inventory = {
    setup: function() {
      createUI();

      document.addEventListener('keydown', function(e) {
        var digit = null;
        switch (e.code) {
          case 'Digit1': digit = 0; break;
          case 'Digit2': digit = 1; break;
          case 'Digit3': digit = 2; break;
          case 'Digit4': digit = 3; break;
          case 'Digit5': digit = 4; break;
          case 'Digit6': digit = 5; break;
        }
        if (digit !== null) {
          activeSlot = digit;
          refreshUI();
        }
      });

      refreshUI();
    },

    addItem: function(type) {
      for (var i = 0; i < 6; i++) {
        if (slots[i] === null) {
          slots[i] = type;
          refreshUI();
          return true;
        }
      }
      return false;
    },

    removeActive: function() {
      var type = slots[activeSlot];
      if (type) {
        slots[activeSlot] = null;
        refreshUI();
      }
      return type;
    },

    getActive: function() {
      return slots[activeSlot];
    },

    getActiveIndex: function() {
      return activeSlot;
    },

    isFull: function() {
      for (var i = 0; i < 6; i++) {
        if (slots[i] === null) return false;
      }
      return true;
    },

    countType: function(type) {
      var count = 0;
      for (var i = 0; i < 6; i++) {
        if (slots[i] === type) count++;
      }
      return count;
    },

    showNotification: function(text, color) {
      notificationEl.textContent = text;
      notificationEl.style.background = color || 'rgba(200, 50, 50, 0.85)';
      notificationEl.style.display = 'block';
      notificationEl.style.opacity = '1';
      if (notificationTimer) clearTimeout(notificationTimer);
      notificationTimer = setTimeout(function() {
        notificationEl.style.opacity = '0';
        setTimeout(function() {
          notificationEl.style.display = 'none';
        }, 400);
      }, 2000);
    }
  };
})();
