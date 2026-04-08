let clients = [];

const addClient = (req, res) => {
  const clientId = Date.now() + Math.random();

  const newClient = {
    id: clientId,
    role: req.user?.role || "guest",
    restaurantId: req.user?._id || null,
    fingerPrint: req.query.fingerPrint || null,
    res
  };

  // Remove duplicate connections safely
  clients = clients.filter(c => {
    if (newClient.role === "admin" && newClient.restaurantId) {
      return String(c.restaurantId) !== String(newClient.restaurantId);
    }

    if (newClient.fingerPrint) {
      return c.fingerPrint !== newClient.fingerPrint;
    }

    return true;
  });

  clients.push(newClient);

  // Initial handshake
  res.write(`data: ${JSON.stringify({ type: "CONNECTED" })}\n\n`);

  req.on('close', () => {
    clients = clients.filter(c => c.id !== clientId);
  });
};


// Send Events Safely
const sendEvent = (type, data) => {

  clients.forEach(client => {
    try {
      if (
        type === "NEW_ORDER" &&
        client.role === "admin" &&
        String(client.restaurantId) === String(data.user)
      ) {
        client.res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
      }

      if (
        type === "ORDER_STATUS_CHANGED" &&
        client.fingerPrint === data.fingerPrint
      ) {
        client.res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
      }

    } catch (err) {
      clients = clients.filter(c => c.id !== client.id);
    }
  });
};


// Keep Alive
setInterval(() => {
  clients.forEach(client => {
    try {
      client.res.write(': keep-alive\n\n');
    } catch {
      clients = clients.filter(c => c.id !== client.id);
    }
  });
}, 25000);


module.exports = {
  addClient,
  sendEvent
};