let clients = [];

const addClient = (req, res) => {
  const clientId = Date.now() + Math.random();
  let adminId = null;

  if (req.user?.role === "admin") {
    adminId = req.user._id; // ✅ admin uses own id
  } else if (req.user?.role === "staff") {
    adminId = req.user.createdBy; // ✅ staff uses createdBy
  }

  const newClient = {
    id: clientId,
    role: req.user?.role || "guest",
    adminId,
    fingerPrint: req.query.fingerPrint || null,
    res
  };

  console.log("🧠 ADD CLIENT DEBUG:");
  console.log("Role:", newClient.role);
  console.log("adminId:", newClient.adminId);
  console.log("FingerPrint:", newClient.fingerPrint);

  // Remove duplicate connections safely
  clients = clients.filter(c => {
    // 👨‍🍳 ADMIN → only remove previous admin connections
    if (newClient.role === "admin") {
      return !(c.role === "admin" && String(c.adminId) === String(newClient.adminId));
    }

    // 👨‍🔧 STAFF → only remove same staff (optional: by user id)
    if (newClient.role === "staff") {
      return !(c.role === "staff" && String(c.id) === String(newClient.id));
    }

    // 👤 USER → remove same fingerprint
    if (newClient.role === "guest") {
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
    console.log("🔍 MATCH CHECK:");
    console.log("Client Role:", client.role);
    console.log("Client Restaurant:", client.adminId);
    console.log("Order Restaurant:", data.user);
    try {
      if (
        type === "NEW_ORDER" &&
        (client.role === "admin" || client.role === "staff") &&
        String(client.adminId) === String(data.user)
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