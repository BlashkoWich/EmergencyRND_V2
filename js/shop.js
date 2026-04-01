(function() {
  window.Game = window.Game || {};

  var controls;
  var shopEl;
  var isShopOpen = false;
  var countEls = {}; // type -> span element
  var upgradeLevel = 0; // 0=base(5), 1=10, 2=15, 3=20
  var upgradeLevels = [
    { price: 50, stack: 10 },
    { price: 100, stack: 15 },
    { price: 200, stack: 20 }
  ];
  var upgradeButtons = []; // [{btn, item}]

  function updateCounts() {
    var types = Game.Consumables.TYPES;
    for (var type in types) {
      if (!countEls[type]) continue;
      var inInventory = Game.Inventory.countType(type);
      var onGround = Game.Consumables.countGroundItems(type);
      var inBoxes = Game.Consumables.countBoxItems(type);
      var total = inInventory + onGround + inBoxes;
      countEls[type].textContent = total > 0 ? '(есть: ' + total + ')' : '';
    }
    // Instruments
    var instrTypes = Game.Consumables.INSTRUMENT_TYPES;
    for (var type in instrTypes) {
      if (!countEls[type]) continue;
      var inInventory = Game.Inventory.countType(type);
      var onGround = Game.Consumables.countGroundItems(type);
      var total = inInventory + onGround;
      countEls[type].textContent = total > 0 ? '(есть: ' + total + ')' : '';
    }
  }

  function refreshUpgradeButtons() {
    for (var i = 0; i < upgradeButtons.length; i++) {
      var entry = upgradeButtons[i];
      var btn = entry.btn;
      var level = entry.level;
      if (level < upgradeLevel) {
        // Already purchased
        btn.textContent = 'Куплено \u2713';
        btn.classList.add('disabled');
      } else if (level === upgradeLevel) {
        // Available for purchase
        btn.textContent = 'Купить — $' + upgradeLevels[level].price;
        btn.classList.remove('disabled');
      } else {
        // Locked — need previous level first
        btn.textContent = 'Сначала купите ур. ' + level;
        btn.classList.add('disabled');
      }
    }
  }

  window.Game.Shop = {
    isOpen: function() { return isShopOpen; },

    setup: function(_controls) {
      controls = _controls;
      shopEl = document.getElementById('shop-popup');
      var closeBtn = document.getElementById('shop-close');

      // --- Tab switching ---
      var tabs = shopEl.querySelectorAll('.shop-tab');
      var tabContents = {
        consumables: document.getElementById('shop-tab-consumables'),
        instruments: document.getElementById('shop-tab-instruments'),
        furniture: document.getElementById('shop-tab-furniture'),
        upgrades: document.getElementById('shop-tab-upgrades')
      };
      for (var t = 0; t < tabs.length; t++) {
        (function(tab) {
          tab.addEventListener('click', function() {
            for (var k = 0; k < tabs.length; k++) tabs[k].classList.remove('active');
            tab.classList.add('active');
            for (var key in tabContents) tabContents[key].style.display = 'none';
            tabContents[tab.dataset.tab].style.display = '';
          });
        })(tabs[t]);
      }

      // --- Consumable buy buttons + count spans ---
      var consumableItems = document.querySelectorAll('#shop-tab-consumables .shop-item');
      for (var i = 0; i < consumableItems.length; i++) {
        var itemEl = consumableItems[i];
        var type = itemEl.dataset.type;

        // Create count span
        var countSpan = document.createElement('span');
        countSpan.className = 'shop-item-count';
        itemEl.insertBefore(countSpan, itemEl.querySelector('.shop-buy-btn'));
        countEls[type] = countSpan;

        // Buy button handler
        (function(btn, t) {
          btn.addEventListener('click', function() {
            var balance = Game.Cashier.getBalance();
            if (balance < 10) {
              Game.Inventory.showNotification('Недостаточно средств!');
              return;
            }
            Game.Cashier.spend(10);
            Game.Consumables.spawnBoxInDeliveryZone(t);
            updateCounts();
          });
        })(itemEl.querySelector('.shop-buy-btn'), type);
      }

      // --- Instrument buy buttons + count spans ---
      var instrumentItems = document.querySelectorAll('#shop-tab-instruments .shop-item');
      for (var i = 0; i < instrumentItems.length; i++) {
        var itemEl = instrumentItems[i];
        var type = itemEl.dataset.type;

        // Create count span
        var countSpan = document.createElement('span');
        countSpan.className = 'shop-item-count';
        itemEl.insertBefore(countSpan, itemEl.querySelector('.shop-buy-btn'));
        countEls[type] = countSpan;

        // Buy button handler
        (function(btn, t) {
          btn.addEventListener('click', function() {
            var balance = Game.Cashier.getBalance();
            if (balance < 1) {
              Game.Inventory.showNotification('Недостаточно средств!');
              return;
            }
            Game.Cashier.spend(1);
            Game.Consumables.spawnInstrumentInDeliveryZone(t);
            updateCounts();
          });
        })(itemEl.querySelector('.shop-buy-btn'), type);
      }

      // --- Furniture buy buttons ---
      var furnitureItems = document.querySelectorAll('#shop-tab-furniture .shop-item');
      var furniturePrices = { bed: 25, chair: 15 };
      for (var i = 0; i < furnitureItems.length; i++) {
        var itemEl = furnitureItems[i];
        var type = itemEl.dataset.type;
        (function(btn, t) {
          var price = furniturePrices[t];
          btn.addEventListener('click', function() {
            var balance = Game.Cashier.getBalance();
            if (balance < price) {
              Game.Inventory.showNotification('Недостаточно средств!');
              return;
            }
            Game.Cashier.spend(price);
            Game.Furniture.spawnFurniture(t);
          });
        })(itemEl.querySelector('.shop-buy-btn'), type);
      }

      // --- Upgrade buy buttons ---
      var upgradeItems = document.querySelectorAll('#shop-tab-upgrades .shop-upgrade-item');
      for (var i = 0; i < upgradeItems.length; i++) {
        var itemEl = upgradeItems[i];
        var btn = itemEl.querySelector('.shop-buy-btn');
        upgradeButtons.push({ btn: btn, item: itemEl, level: i });
        (function(btn, level) {
          btn.addEventListener('click', function() {
            if (upgradeLevel !== level) return; // not available yet
            var price = upgradeLevels[level].price;
            var balance = Game.Cashier.getBalance();
            if (balance < price) {
              Game.Inventory.showNotification('Недостаточно средств!');
              return;
            }
            Game.Cashier.spend(price);
            upgradeLevel = level + 1;
            Game.Inventory.setMaxStack(upgradeLevels[level].stack);
            Game.Inventory.showNotification(
              'Теперь можно хранить ' + upgradeLevels[level].stack + ' препаратов в слоте!',
              'rgba(34, 139, 34, 0.85)'
            );
            refreshUpgradeButtons();
          });
        })(btn, i);
      }
      refreshUpgradeButtons();

      // Close button
      closeBtn.addEventListener('click', function() {
        shopEl.style.display = 'none';
        isShopOpen = false;
        controls.lock();
      });

      // KeyQ to toggle shop
      document.addEventListener('keydown', function(e) {
        if (e.code !== 'KeyQ') return;
        if (Game.Patients.isPopupOpen()) return;
        if (Game.Cashier.isPopupOpen()) return;
        if (Game.Diagnostics && Game.Diagnostics.isActive()) return;

        if (isShopOpen) {
          shopEl.style.display = 'none';
          isShopOpen = false;
          controls.lock();
        } else if (controls.isLocked) {
          isShopOpen = true;
          shopEl.style.display = 'block';
          controls.unlock();
          updateCounts();
          refreshUpgradeButtons();
        }
      });
    }
  };
})();
