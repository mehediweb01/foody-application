import { getCollection } from "../config/database.js";
import {
  calculateTotal,
  createOrderDocument,
  generateOrderId,
  getOrder,
  validateOrder,
} from "../utils/helpers.js";

export const orderHandler = (io, socket) => {
  console.log(`User ${socket.id} connected`);

  socket.on("placeOrder", async (data, callback) => {
    try {
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

  // tracking order
  socket.on("trackOrder", async (data, callback) => {
    try {
      const order = await getOrder(data.orderId);

      if (!order) {
        return callback({ success: false, message: "Order not found!" });
      }

      socket.join(`order-${data.orderId}`);
      callback({ success: true, message: "Order found!" });
    } catch (error) {
      console.error(`Error tracking order: ${error}`);
      callback({ success: false, message: error.message });
    }
  });

  // cancelled order
  socket.on("cancelOrder", async (data, callback) => {
    try {
      const order = await getOrder(data.orderId);

      if (!order) {
        return callback({ success: false, message: "Order not found!" });
      }

      if (!["pending", "confirmed"].includes(order.status)) {
        return callback({
          success: false,
          message: "Order can't be cancelled!",
        });
      }

      const orderCollection = getCollection("orders");

      await orderCollection.updateOne(
        { orderId: order.orderId },
        {
          $set: {
            status: "cancelled",
            updatedAt: new Date(),
          },
          $push: {
            statusHistory: {
              status: "cancelled",
              timestamp: new Date(),
              by: socket.id,
              note: order.reason || "Cancelled by customer",
            },
          },
        },
      );

      io.to(`order-${data.orderId}`).emit("orderCancelled", {
        orderId: data.orderId,
      });
      io.to("admins").emit("orderCancelled", {
        orderId: data.orderId,
        customerName: order.customerName,
      });

      callback({ success: true, message: "Order cancelled successfully!" });
    } catch (error) {
      console.error(`Error cancelling order: ${error}`);
      callback({ success: false, message: error.message });
    }
  });

  // get all orders
  socket.on("getMyOrders", async (data, callback) => {
    try {
      const ordersCollection = getCollection("orders");
      const orders = await ordersCollection
        .find({
          customerPhone: data.customerPhone,
        })
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray();

      callback({ success: true, orders });
    } catch (error) {
      console.error(`Error getting orders: ${error}`);
      callback({ success: false, message: error.message });
    }
  });
};
