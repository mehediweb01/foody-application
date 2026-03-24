import {
  calculateTotal,
  createOrderDocument,
  generateOrderId,
  validateOrder,
} from "../../utils/helpers.js";
import { getCollection } from "../config/database.js";

export const orderHandler = (io, socket) => {
  console.log(`User ${socket.id} connected`);

  socket.on("placeOrder", async (data, callback) => {
    try {
      console.log(`User ${socket.id} placed an order`);
      const validation = validateOrder(data);

      if (!validation.valid) {
        return callback({ success: false, message: validation.message });
      }

      const totals = calculateTotal(data.items);
      const orderId = generateOrderId();
      const order = createOrderDocument(data, orderId, totals);

      const orderCollection = getCollection("orders");
      await orderCollection.insertOne(order);

      socket.join(`order-${orderId}`);
      socket.join(`customers`);

      io.to(`admins`).emit("orderPlaced", { order });

      callback({ success: true, message: "Order placed successful" });
      console.log(`Order ${orderId} placed successful`);
    } catch (error) {
      console.log(error);
      callback({ success: false, message: "Order placed failed!" });
    }
  });
};
