export const validateOrder = (data) => {
  if (!data.customerName?.trim()) {
    return {
      valid: false,
      message: "Customer name is required!",
    };
  }
  if (!data.customerPhone?.trim()) {
    return {
      valid: false,
      message: "Customer PHone number is required!",
    };
  }
  if (!data.customerAddress?.trim()) {
    return {
      valid: false,
      message: "Customer address is required!",
    };
  }
  if (!Array.isArray(data.items)) {
    return {
      valid: false,
      message: "Order must have at least one item!",
    };
  }

  return {
    valid: true,
    message: "",
  };
};

// order id generator
export const generateOrderId = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");

  return `ORD-${year}${month}${day}-${random}`;
};

// calculate totals
export const calculateTotal = (items) => {
  const subTotal = items.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );
  const tax = subTotal * 0.1;
  const deliveryFee = 45;
  const total = subTotal + tax + deliveryFee;

  return {
    subTotal: Math.round(subTotal * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    deliveryFee,
    totalAmount: Math.round(total * 100) / 100,
  };
};

// create order document
export const createOrderDocument = (orderData, orderId, totals) => {
  return {
    orderId,
    customerName: orderData.customerName.trim(),
    customerPhone: orderData.customerPhone.trim(),
    items: orderData.items,
    subtotal: totals.subTotal,
    tax: totals.tax,
    deliveryFee: totals.deliveryFee,
    totalAmount: totals.totalAmount,
    specialNotes: orderData.specialNotes || "",
    paymentMethod: orderData.paymentMethod || "cash",
    paymentStatus: "pending",
    statusHistory: [
      {
        status: "pending",
        timestamp: new Date(),
        by: "customer",
        note: "Order placed",
      },
    ],
    estimatedTime: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
};
