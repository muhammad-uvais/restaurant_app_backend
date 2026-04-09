const orderEmitter = require('../events/orderEvents');
const { sendEvent } = require('../utils/sseManager');

// New Order → Admin
orderEmitter.on('orderCreated', (order) => {
  sendEvent("NEW_ORDER", order);
});

// Status Update → User
orderEmitter.on('orderStatusChanged', (order) => {
  sendEvent("ORDER_STATUS_CHANGED", order);
});