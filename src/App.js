import "./App.css";
import Popup from "./components/Popup";
import UserState from "./context/UserState";

function App() {
  const host = process.env.REACT_APP_HOST;
  return (
    <UserState>
      <Popup prop={{ host }} />
    </UserState>
  );
}

export default App;
