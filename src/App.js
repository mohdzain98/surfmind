import './App.css';
import Popup from './Components/Popup';

function App() {
  const host = process.env.REACT_APP_HOST
  return (
    <Popup prop={{host}}/>
  );
}

export default App;
