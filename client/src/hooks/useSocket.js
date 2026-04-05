import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

const useSocket = () => {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
    });

    //   connection
    socketRef.current.on("connect", () => {
      setConnected(true);
      console.log(
        `Connected to socket server with id: ${socketRef.current.id}`,
      );
    });

    //   disconnection
    socketRef.current.on("disconnect", () => {
      setConnected(false);
      console.log(
        `Disconnected from socket server with id: ${socketRef.current.id}`,
      );
    });

    // connected users
    socketRef.current.on("connected", (data) => {
      console.log(`connected users: ${data.message}`);
    });

    //   cleanup
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return {
    socket: socketRef.current,
    connected,
  };
};

export { useSocket };
