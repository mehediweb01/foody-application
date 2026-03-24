import { validateOrder } from "../../utils/helpers.js";

export const orderHandler = (io, socket) => {
  console.log(`User ${socket.id} connected`);

  socket.on("placeOrder", async (data, callback) => {
    try {
      console.log(`User ${socket.id} placed an order`);
      const validation = validateOrder(data);

      if (!validation.valid) {
        return callback({ valid: false, message: validation.message });
      }
    } catch (error) {
      console.log(error);
    }
  });
};
