(function() {
  window.Game = window.Game || {};

  // Ward definitions. Each ward has:
  //   tier     — 'basic' | 'improved' | 'vip' (preferred by patient)
  //   price    — charged when ward.tier === patient.preferredTier
  //   accepts  — severity keys this ward can admit
  //   capacity — bed count (filled in from world.js at setup)
  //   slots    — [{ pos: Vector3, occupied: bool }] (from world.js)
  var TYPES = {
    easy:     { tier: 'basic',    price: 30,  accepts: ['mild'] },
    easyPlus: { tier: 'improved', price: 55,  accepts: ['mild', 'medium'] },
    medium:   { tier: 'basic',    price: 40,  accepts: ['medium'] },
    hard:     { tier: 'basic',    price: 60,  accepts: ['severe'] },
    hardPlus: { tier: 'improved', price: 80,  accepts: ['medium', 'severe'] },
    vip:      { tier: 'vip',      price: 100, accepts: ['mild', 'medium', 'severe'] }
  };

  // Price the patient *would* pay in their preferred-tier ward, by severity.
  // Used when the actual ward differs from the preferred tier — patient pays
  // min(actualWardPrice, preferredWardPriceForSeverity), so over- and under-
  // placement both cap at the cheaper of the two.
  //   basic    → easy / medium / hard
  //   improved → easyPlus (also used for medium, since easyPlus is 🟡's cheaper option)
  //              / hardPlus (for severe)
  //   vip      → vip (100) for any severity
  var PREFERRED_PRICE = {
    basic:    { mild: 30,  medium: 40,  severe: 60 },
    improved: { mild: 55,  medium: 55,  severe: 80 },
    vip:      { mild: 100, medium: 100, severe: 100 }
  };

  // Kept for backward compatibility — equals PREFERRED_PRICE.basic.
  var BASIC_PRICE_BY_SEVERITY = PREFERRED_PRICE.basic;

  // Display order in the popup (row-major 3×2).
  var ORDER = ['easy', 'easyPlus', 'medium', 'hard', 'hardPlus', 'vip'];

  var wards = {};  // populated in setup()

  function accepts(wardId, severityKey) {
    var w = TYPES[wardId];
    if (!w) return false;
    return w.accepts.indexOf(severityKey) !== -1;
  }

  function calcPayment(wardId, patient) {
    var w = TYPES[wardId];
    if (!w) return 0;
    if (w.tier === patient.preferredTier) return w.price;
    // Tier mismatch: patient pays the cheaper of the actual ward and their
    // preferred-tier equivalent for their severity.
    var pref = PREFERRED_PRICE[patient.preferredTier];
    var preferredPrice = pref ? (pref[patient.severity.key] || 0) : 0;
    return Math.min(w.price, preferredPrice);
  }

  function getWard(wardId) { return wards[wardId] || null; }

  function getSlots(wardId) {
    var w = wards[wardId];
    return w ? w.slots : [];
  }

  function getFreeSlot(wardId) {
    var slots = getSlots(wardId);
    for (var i = 0; i < slots.length; i++) {
      if (!slots[i].occupied) return slots[i];
    }
    return null;
  }

  function getFreeCount(wardId) {
    var slots = getSlots(wardId);
    var n = 0;
    for (var i = 0; i < slots.length; i++) if (!slots[i].occupied) n++;
    return n;
  }

  function getCapacity(wardId) { return getSlots(wardId).length; }

  function getTotalCapacity() {
    var n = 0;
    for (var id in wards) if (wards.hasOwnProperty(id)) n += wards[id].slots.length;
    return n;
  }

  function getAllSlots() {
    var out = [];
    for (var i = 0; i < ORDER.length; i++) {
      var slots = getSlots(ORDER[i]);
      for (var j = 0; j < slots.length; j++) out.push(slots[j]);
    }
    return out;
  }

  // Reverse lookup: given a slot object, return its ward id.
  function getWardIdBySlot(slot) {
    if (!slot) return null;
    if (slot.wardId) return slot.wardId;
    for (var id in wards) {
      if (!wards.hasOwnProperty(id)) continue;
      var s = wards[id].slots;
      for (var i = 0; i < s.length; i++) if (s[i] === slot) return id;
    }
    return null;
  }

  function setup(wardData) {
    wards = {};
    for (var id in TYPES) {
      if (!TYPES.hasOwnProperty(id)) continue;
      var def = TYPES[id];
      var provided = (wardData && wardData[id]) || { slots: [] };
      // tag each slot with its ward id for quick reverse lookup
      for (var i = 0; i < provided.slots.length; i++) provided.slots[i].wardId = id;
      wards[id] = {
        id: id,
        tier: def.tier,
        price: def.price,
        accepts: def.accepts.slice(),
        slots: provided.slots
      };
    }
  }

  window.Game.Wards = {
    TYPES: TYPES,
    ORDER: ORDER,
    BASIC_PRICE_BY_SEVERITY: BASIC_PRICE_BY_SEVERITY,
    setup: setup,
    accepts: accepts,
    calcPayment: calcPayment,
    getWard: getWard,
    getSlots: getSlots,
    getFreeSlot: getFreeSlot,
    getFreeCount: getFreeCount,
    getCapacity: getCapacity,
    getTotalCapacity: getTotalCapacity,
    getAllSlots: getAllSlots,
    getWardIdBySlot: getWardIdBySlot
  };
})();
