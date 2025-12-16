/**
 * Main App component
 * Root component that renders the Chat interface
 */

import { Chat } from "./components/Chat";

function App() {
  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50">
      <Chat />
    </div>
  );
}

export default App;

