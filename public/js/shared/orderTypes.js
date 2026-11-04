(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node.js / CommonJS
    module.exports = factory();
  } else {
    // Browser global
    root.OrderTypes = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CANONICAL = {
    COUNTER_COUNTER: 'Counter • Counter',
    COUNTER_DELIVERY: 'Counter • Route',
    PICKUP_DELIVERY: 'Route • Route',
    PICKUP_COUNTER: 'Route • Counter'
  };

  const CANONICAL_CODES = {
    COUNTER_COUNTER: 'C • C',
    COUNTER_DELIVERY: 'C • R',
    PICKUP_DELIVERY: 'R • R',
    PICKUP_COUNTER: 'R • C'
  };

  const PICKUP_TYPES = new Set([
    'Route • Route',
    'Route • Counter',
    'R • R',
    'R • C',
    'Route & Route',
    'Route & Counter',
    'Pick-up & Delivery',
    'Pick-up & Counter',
    'Store collection & Store delivery',
    'Store collection & Store pickup',
    'R & R',
    'R & C'
  ]);

  const DELIVERY_TYPES = new Set([
    'Route • Route',
    'Counter • Route',
    'R • R',
    'C • R',
    'Route & Route',
    'Counter & Route',
    'Pick-up & Delivery',
    'Counter & Delivery',
    'Customer drop-off & Store delivery',
    'Store collection & Store delivery',
    'R & R',
    'C & R'
  ]);

  const ROUTE_ROUTE_TYPES = new Set([
    'Route • Route',
    'R • R',
    'Route & Route',
    'Pick-up & Delivery',
    'Store collection & Store delivery',
    'R & R'
  ]);

  function normalize(type) {
    if (!type) return '';
    return String(type).trim().replace(/\s*&\s*/g, ' • ');
  }

  function formatDisplay(type) {
    if (!type) return 'Counter • Counter';
    return String(type).trim().replace(/\s*&\s*/g, ' • ');
  }

  function formatCode(code) {
    if (!code) return 'C • C';
    return String(code).trim().replace(/\s*&\s*/g, ' • ');
  }

  function hasPickup(type) {
    const raw = (type || '').toString().trim();
    return PICKUP_TYPES.has(raw) || PICKUP_TYPES.has(normalize(raw));
  }

  function hasDelivery(type) {
    const raw = (type || '').toString().trim();
    return DELIVERY_TYPES.has(raw) || DELIVERY_TYPES.has(normalize(raw));
  }

  function isRouteRoute(type) {
    const raw = (type || '').toString().trim();
    return ROUTE_ROUTE_TYPES.has(raw) || ROUTE_ROUTE_TYPES.has(normalize(raw));
  }

  function isCounterCounter(type) {
    const raw = (type || '').toString().trim();
    const t = normalize(raw);
    return t === 'Counter • Counter' || t === 'C • C' || raw === 'Counter & Counter' || raw === 'C & C' || (!hasPickup(raw) && !hasDelivery(raw));
  }

  return {
    CANONICAL,
    CANONICAL_CODES,
    hasPickup,
    hasDelivery,
    isRouteRoute,
    isCounterCounter,
    normalize,
    formatDisplay,
    formatCode
  };
}));
