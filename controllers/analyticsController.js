const Order = require("../models/Order");

exports.getRestaurantInsights = async (req, res) => {
  try {
    const user = req.user; // from JWT auth
    const { from, to, hours } = req.query;

    let fromDate, toDate;

    const parseUserDateUTC = (input, isEndOfDay = false) => {
      if (!input) return null;

      if (input.includes("/")) {
        // DD/MM/YY
        const parts = input.split("/").map(Number);
        if (parts.length === 3) {
          const [yy, mm, dd] = parts;
          const date = new Date(Date.UTC(2000 + yy, mm - 1, dd));
          if (isEndOfDay) date.setUTCHours(23, 59, 59, 999);
          return date;
        }
      } else {
        // ISO format YYYY-MM-DD or YYYY/MM/DD
        const date = new Date(input);
        if (!isNaN(date)) {
          if (isEndOfDay) date.setUTCHours(23, 59, 59, 999);
          else date.setUTCHours(0, 0, 0, 0);
          return date;
        }
      }

      return null;
    };

    if (hours) {
      const hrs = parseInt(hours);
      if (isNaN(hrs) || hrs <= 0) {
        return res.status(400).json({ message: "Invalid hours value" });
      }
      toDate = new Date();
      fromDate = new Date(toDate.getTime() - hrs * 60 * 60 * 1000);
    } else {
      const oldestOrder = await Order.findOne({
        user: user._id,
        status: "completed",
      }).sort({ createdAt: 1 }).lean();

      fromDate = from
        ? parseUserDateUTC(from)
        : oldestOrder
        ? new Date(oldestOrder.createdAt)
        : new Date();

      toDate = to
        ? parseUserDateUTC(to, true)
        : new Date();

      if (!fromDate || !toDate || isNaN(fromDate) || isNaN(toDate)) {
        return res.status(400).json({ message: "Invalid from/to date" });
      }
    }

    const orders = await Order.find({
      user: user._id,
      status: "completed",
      createdAt: { $gte: fromDate, $lte: toDate },
    }).lean();

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((acc, o) => {
      if (o.totalAmount != null) return acc + o.totalAmount;
      if (o.totalPrice != null) return acc + o.totalPrice;
      if (o.items?.length)
        return acc + o.items.reduce((sum, i) => sum + (i.price * i.quantity || 0), 0);
      return acc;
    }, 0);

    // Chart: keep original UTC timestamp, truncate for readability
    const chartData = orders
      .map(o => {
        const createdAt = new Date(o.createdAt); // still UTC
        let revenue = 0;
        if (o.totalAmount != null) revenue = o.totalAmount;
        else if (o.totalPrice != null) revenue = o.totalPrice;
        else if (o.items?.length)
          revenue = o.items.reduce((sum, i) => sum + (i.price * i.quantity || 0), 0);

        const year = createdAt.getUTCFullYear();
        const month = String(createdAt.getUTCMonth() + 1).padStart(2, "0");
        const day = String(createdAt.getUTCDate()).padStart(2, "0");
        const hours = String(createdAt.getUTCHours()).padStart(2, "0");
        const minutes = String(createdAt.getUTCMinutes()).padStart(2, "0");

        return {
          date: `${year}-${month}-${day} ${hours}:${minutes}`,
          revenue
        };
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    return res.status(200).json({
      totalOrders,
      totalRevenue,
      chartData,
      from: fromDate,
      to: toDate,
      rangeType: hours ? `last ${hours} hours` : "custom date range",
    });
  } catch (err) {
    console.error("Error fetching insights:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};
