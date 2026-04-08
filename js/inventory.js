(function() {
  window.Game = window.Game || {};

  var slots = [null, null, null, null, null, null]; // each slot: {type, count} or null
  var activeSlot = 0;
  var maxStack = 5; // base stack size for consumables (instruments don't stack)
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

    } else if (type === 'linen_clean') {
      // Folded clean bedsheet — light blue rectangle with fold lines
      ctx.fillStyle = '#dde4f0';
      ctx.beginPath();
      ctx.roundRect(16, 28, 96, 72, 8);
      ctx.fill();
      ctx.strokeStyle = '#b8c4d8';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Fold lines
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(24, 52); ctx.lineTo(104, 52); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(24, 76); ctx.lineTo(104, 76); ctx.stroke();
      // Accent stripe
      ctx.fillStyle = '#99aacc';
      ctx.fillRect(24, 32, 80, 10);

    } else if (type === 'linen_dirty') {
      // Folded dirty bedsheet — brownish with stain spots
      ctx.fillStyle = '#998870';
      ctx.beginPath();
      ctx.roundRect(16, 28, 96, 72, 8);
      ctx.fill();
      ctx.strokeStyle = '#7a7060';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Fold lines
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(24, 52); ctx.lineTo(104, 52); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(24, 76); ctx.lineTo(104, 76); ctx.stroke();
      // Stain spots
      ctx.fillStyle = 'rgba(100, 80, 50, 0.5)';
      ctx.beginPath(); ctx.arc(45, 45, 10, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(80, 70, 8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(60, 85, 6, 0, Math.PI * 2); ctx.fill();
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

      var countBadge = document.createElement('span');
      countBadge.className = 'inv-count';
      countBadge.style.display = 'none';
      slot.appendChild(countBadge);

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
    hintShopEl.textContent = Game.Lang.t('inv.shop');
    hintsEl.appendChild(hintShopEl);

    hintDropEl = document.createElement('span');
    hintDropEl.className = 'inv-hint';
    hintDropEl.textContent = Game.Lang.t('inv.drop');
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
      var countEl = el.querySelector('.inv-count');
      el.className = 'inv-slot' + (i === activeSlot ? ' active' : '');

      if (slots[i]) {
        var slotType = slots[i].type;
        var slotCount = slots[i].count;
        var info = types[slotType] || instrTypes[slotType];
        var icon = generateIcon(slotType);
        if (icon) {
          itemEl.style.backgroundImage = 'url(' + icon + ')';
          itemEl.style.backgroundSize = 'cover';
          itemEl.style.backgroundColor = 'transparent';
        } else {
          itemEl.style.backgroundImage = '';
          itemEl.style.backgroundColor = '#' + info.color.toString(16).padStart(6, '0');
        }
        itemEl.style.display = 'block';
        itemEl.title = Game.Lang.t('item.' + slotType);

        // Show count badge for stackable items (consumables only, count > 1)
        if (countEl) {
          if (!slotType.startsWith('instrument_') && slotCount > 1) {
            countEl.textContent = slotCount;
            countEl.style.display = 'flex';
          } else {
            countEl.style.display = 'none';
          }
        }
      } else {
        itemEl.style.display = 'none';
        itemEl.style.backgroundImage = '';
        itemEl.title = '';
        if (countEl) countEl.style.display = 'none';
      }
    }

    // Active item name
    if (activeNameEl) {
      var activeData = slots[activeSlot];
      if (activeData) {
        var activeInfo = types[activeData.type] || instrTypes[activeData.type];
        activeNameEl.textContent = Game.Lang.t('item.' + activeData.type);
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
      var isInstrument = type.startsWith('instrument_');
      // For consumables: try to stack into existing slot first
      if (!isInstrument) {
        for (var i = 0; i < 6; i++) {
          if (slots[i] && slots[i].type === type && slots[i].count < maxStack) {
            slots[i].count++;
            refreshUI();
            return true;
          }
        }
      }
      // Find empty slot
      for (var i = 0; i < 6; i++) {
        if (slots[i] === null) {
          slots[i] = { type: type, count: 1 };
          refreshUI();
          return true;
        }
      }
      return false;
    },

    addItemBulk: function(type, maxCount) {
      if (maxCount <= 0) return 0;
      var isInstrument = type.startsWith('instrument_');
      if (isInstrument) {
        // Instruments don't stack — just add one
        return this.addItem(type) ? 1 : 0;
      }
      // Try to stack into existing slot with same type
      for (var i = 0; i < 6; i++) {
        if (slots[i] && slots[i].type === type && slots[i].count < maxStack) {
          var canAdd = Math.min(maxStack - slots[i].count, maxCount);
          slots[i].count += canAdd;
          refreshUI();
          return canAdd;
        }
      }
      // Find empty slot
      for (var i = 0; i < 6; i++) {
        if (slots[i] === null) {
          var canAdd = Math.min(maxStack, maxCount);
          slots[i] = { type: type, count: canAdd };
          refreshUI();
          return canAdd;
        }
      }
      return 0;
    },

    removeActive: function() {
      var data = slots[activeSlot];
      if (data) {
        var type = data.type;
        data.count--;
        if (data.count <= 0) {
          slots[activeSlot] = null;
        }
        refreshUI();
        return type;
      }
      return null;
    },

    removeActiveN: function(n) {
      var data = slots[activeSlot];
      if (!data) return null;
      var type = data.type;
      data.count -= n;
      if (data.count <= 0) {
        slots[activeSlot] = null;
      }
      refreshUI();
      return type;
    },

    getActiveCount: function() {
      return slots[activeSlot] ? slots[activeSlot].count : 0;
    },

    getActive: function() {
      return slots[activeSlot] ? slots[activeSlot].type : null;
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
        if (slots[i] && slots[i].type === type) count += slots[i].count;
      }
      return count;
    },

    setMaxStack: function(n) {
      maxStack = n;
    },

    getMaxStack: function() {
      return maxStack;
    },

    findAndActivate: function(type) {
      for (var i = 0; i < 6; i++) {
        if (slots[i] && slots[i].type === type) {
          activeSlot = i;
          refreshUI();
          return true;
        }
      }
      return false;
    },

    findAndActivateOneOf: function(types) {
      for (var i = 0; i < types.length; i++) {
        for (var j = 0; j < 6; j++) {
          if (slots[j] && slots[j].type === types[i]) {
            activeSlot = j;
            refreshUI();
            return types[i];
          }
        }
      }
      return null;
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
