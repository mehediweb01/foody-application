import "./App.css";
import { useSocket } from "./hooks/useSocket";

const App = () => {
  const { socket, connected } = useSocket();

  return (
    <>
      <div className="font-bold text-white bg-black text-center">
        socket io client to server connection checking:{" "}
        {connected ? "Connected" : "Disconnected"}
      </div>
    </>
  );
};

export default App;
