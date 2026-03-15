export const orderHandler = (io, socket) => {
  console.log(`User ${socket.id} connected`);

  socket.on("placeOrder", async (data, callback) => {
    try {
      console.log(`User ${socket.id} placed an order`);
      const validation = validateOrder(data);
    } catch (error) {
      console.log(error);
    }
  });
};
