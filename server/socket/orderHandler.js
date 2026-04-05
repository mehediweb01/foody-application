import { getCollection } from "../config/database.js";
import {
  calculateTotal,
  createOrderDocument,
  generateOrderId,
  getOrder,
  isValidStatusTransition,
  validateOrder,
} from "../utils/helpers.js";

export const orderHandler = (io, socket) => {
  // place order
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

  // admin events

  // admin login
  socket.on("adminLogin", async (data, callback) => {
    try {
      if (data.password === process.env.ADMIN_PASSWORD) {
        socket.isAdmin = true;
        socket.join("admins");
        console.log(`Admin ${socket.id} logged in.`);
        callback({ success: true });
      } else {
        callback({ success: false, message: "Unauthorized!" });
      }
    } catch (error) {
      callback({ success: false, message: error.message });
      console.error(`Error logging in admin: ${error}`);
    }
  });

  // admin get all order
  socket.on("getAllOrder", async (data, callback) => {
    try {
      if (!socket.isAdmin) {
        callback({ success: false, message: "Unauthorized!" });
      }

      const orderCollection = getCollection("orders");
      const filter = data.status ? { status: data.status } : {};
      const orders = await orderCollection
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray();

      callback({ success: true, orders });
    } catch (error) {
      callback({ success: false, message: error.message });
      console.error(`Error getting orders: ${error}`);
    }
  });

  // order status update
  socket.on("updateOrderStatus", async (data, callback) => {
    try {
      const ordersCollection = getCollection("orders");
      const order = await ordersCollection.findOne({ orderId: data.orderId });
      if (!order) {
        return callback({ success: false, message: "Order not found!" });
      }
      if (!isValidStatusTransition(order.status, data.newStatus)) {
        return callback({
          success: false,
          message: "Invalid status transition!",
        });
      }

      const result = await orderCollection.findOneAndUpdate(
        {
          orderId: data.orderId,
        },
        {
          $set: {
            status: data.newStatus,
            updatedAt: new Date(),
          },
          $push: {
            statusHistory: {
              status: data.newStatus,
              timestamp: new Date(),
              by: socket.id,
              note:
                data.note || `Status changed to ${data.newStatus} by admin.`,
            },
          },
        },
        {
          returnDocument: "after",
        },
      );

      io.to(`order-${data.orderId}`).emit("statusUpdated", {
        orderId: data.orderId,
        status: data.newStatus,
        order: result,
      });

      socket.to("admins").emit("orderStatusChanged", {
        orderid: data.orderId,
        status: data.newStatus,
      });

      callback({
        success: true,
        message: "Order status updated successfully!",
        order: result,
      });
    } catch (error) {
      callback({
        success: false,
        message: error.message || "Failed to update order status!",
      });
    }
  });

  // accept order
  socket.on("acceptOrder", async (data, callback) => {
    try {
      if (!socket.isAdmin) {
        return callback({ success: false, message: "Unauthorized!" });
      }

      const orderCollection = getCollection("orders");
      const order = await orderCollection.findOne({ orderId: data.orderId });

      if (!order || order.status !== "pending") {
        return callback({ success: false, message: "Order can't accept!" });
      }

      const estimatedTime = data.estimatedTime || 30; // default 30 mins

      const result = await orderCollection.findOneAndUpdate(
        {
          orderId: data.orderId,
        },
        {
          $set: {
            status: "confirmed",
            estimatedTime,
            updatedAt: new Date(),
          },
          $push: {
            statusHistory: {
              status: "confirmed",
              timestamp: new Date(),
              by: socket.id,
              note: `Order accepted by admin. Estimated time: ${estimatedTime} mins.`,
            },
          },
        },
        {
          returnDocument: "after",
        },
      );

      io.to(`order-${data.orderId}`).emit("orderAccepted", {
        orderId: data.orderId,
        estimatedTime,
      });

      socket.to("admins").emit("orderAcceptedByAdmin", {
        orderId: data.orderId,
      });

      callback({
        success: true,
        message: "Order accepted successfully!",
        order: result,
      });
    } catch (error) {
      callback({
        success: false,
        message: error.message || "Failed to accept order!",
      });
      console.error(`Error accepting order: ${error}`);
    }
  });

  // reject order
  socket.on("rejectOrder", async (data, callback) => {
    try {
      if (!socket.isAdmin) {
        return callback({ success: false, message: "Unauthorized!" });
      }

      const orderCollection = getCollection("orders");
      const order = await orderCollection.findOne({ orderId: data.orderId });
      if (!order || order.status !== "pending") {
        return callback({
          success: false,
          message: "Order can't be rejected!",
        });
      }

      await orderCollection.findOneAndUpdate(
        {
          orderId: data.orderId,
        },
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
              note: `Order rejected by admin.`,
            },
          },
        },
        {
          returnDocument: "after",
        },
      );

      io.to(`order-${data.orderId}`).emit("orderRejected", {
        orderId: data.orderId,
        reason: data?.reason || "Order rejected by admin.",
      });

      socket.to("admins").emit("orderRejectedByAdmin", {
        reason: data?.reason || "Order rejected by admin.",
      });

      callback({
        success: true,
        message: "Order rejected!",
      });
    } catch (error) {
      callback({
        success: false,
        message: error.message || "Failed to reject order!",
      });
      console.error(`Error rejecting order: ${error}`);
    }
  });

  // Set Estimated Time
  socket.on("setEstimatedTime", async (data, callback) => {
    try {
      if (!socket.isAdmin) {
        return callback({ success: false, message: "Unauthorized" });
      }

      const ordersCollection = getCollection("orders");
      const result = await ordersCollection.findOneAndUpdate(
        { orderId: data.orderId },
        { $set: { estimatedTime: data.estimatedTime, updatedAt: new Date() } },
        { returnDocument: "after" },
      );

      if (result) {
        io.to(`order-${data.orderId}`).emit("estimatedTimeUpdated", {
          orderId: data.orderId,
          estimatedTime: data.estimatedTime,
        });
        callback({ success: true, order: result });
      } else {
        callback({ success: false, message: "Order not found" });
      }
    } catch (error) {
      console.error("❌ Set time error:", error);
      callback({ success: false, message: "Failed to update time" });
    }
  });

  // live stats
  socket.on("getLiveStats", async (data, callback) => {
    try {
      if (!socket.isAdmin) {
        return callback({ success: false, message: "Unauthorized!" });
      }

      const orderCollection = getCollection("orders");
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const stats = {
        totalToday: await orderCollection.countDocuments({
          createdAt: { $gte: today },
        }),

        pending: await orderCollection.countDocuments({ status: "pending" }),
        confirmed: await orderCollection.countDocuments({
          status: "confirmed",
        }),
        preparing: await orderCollection.countDocuments({
          status: "preparing",
        }),
        ready: await orderCollection.countDocuments({
          status: "ready",
        }),
        outForDelivery: await orderCollection.countDocuments({
          status: "out_for_delivery",
        }),
        delivered: await orderCollection.countDocuments({
          status: "delivered",
        }),
        cancelled: await orderCollection.countDocuments({
          status: "cancelled",
        }),
      };

      callback({ success: true, stats });
    } catch (error) {
      callback({
        success: false,
        message: error.message || "Failed to get live stats!",
      });
      console.error(`Error getting live stats: ${error}`);
    }
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log(`👋 User disconnected: ${socket.id}`);
    if (socket.isAdmin) {
      socket.to("admins").emit("adminDisconnected", { adminId: socket.id });
    }
  });
};
