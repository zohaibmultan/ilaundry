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
    COUNTER_COUNTER: 'Counter & Counter',
    COUNTER_DELIVERY: 'Counter & Delivery',
    PICKUP_DELIVERY: 'Pick-up & Delivery',
    PICKUP_COUNTER: 'Pick-up & Counter'
  };

  const PICKUP_TYPES = new Set([
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
    'Route & Route',
    'Pick-up & Delivery',
    'Store collection & Store delivery',
    'R & R'
  ]);

  function normalize(type) {
    return (type || '').toString().trim();
  }

  function hasPickup(type) {
    return PICKUP_TYPES.has(normalize(type));
  }

  function hasDelivery(type) {
    return DELIVERY_TYPES.has(normalize(type));
  }

  function isRouteRoute(type) {
    return ROUTE_ROUTE_TYPES.has(normalize(type));
  }

  function isCounterCounter(type) {
    const t = normalize(type);
    return t === 'Counter & Counter' || t === 'C & C' || (!hasPickup(t) && !hasDelivery(t));
  }

  return {
    CANONICAL,
    hasPickup,
    hasDelivery,
    isRouteRoute,
    isCounterCounter,
    normalize
  };
}));
