import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import "./index.css";


function Dashboard() {
  return (
    <div className="fade-in">
      <h1 className="title">
        The ONE AND ONLY Card Empire®
      </h1>

      <p className="subtitle">
        Hosted by Kalenski™
      </p>
    </div>
  );
}


function Marketplace() {
  return (
    <div className="fade-in">
      <h1 className="title">
        Marketplace
      </h1>

      <p className="subtitle">
        Browse the Card Empire collection.
      </p>
    </div>
  );
}


function Events() {
  return (
    <div className="fade-in">
      <h1 className="title">
        Events
      </h1>

      <p className="subtitle">
        Upcoming and previous events.
      </p>
    </div>
  );
}


function Messages() {
  return (
    <div className="fade-in">
      <h1 className="title">
        Messages
      </h1>

      <p className="subtitle">
        Community conversations.
      </p>
    </div>
  );
}


function Profile() {
  return (
    <div className="fade-in">
      <h1 className="title">
        Profile
      </h1>

      <p className="subtitle">
        Your Card Empire profile.
      </p>
    </div>
  );
}


function Admin() {
  return (
    <div className="fade-in">
      <h1 className="title">
        Admin Panel
      </h1>

      <p className="subtitle">
        Manage the Empire.
      </p>
    </div>
  );
}



function App() {

  return (

    <BrowserRouter>

      <div className="app-layout">

        <Navbar />

        <main className="main-content">

          <Routes>

            <Route 
              path="/"
              element={<Dashboard />}
            />

            <Route 
              path="/marketplace"
              element={<Marketplace />}
            />

            <Route 
              path="/events"
              element={<Events />}
            />

            <Route 
              path="/messages"
              element={<Messages />}
            />

            <Route 
              path="/profile"
              element={<Profile />}
            />

            <Route 
              path="/admin"
              element={<Admin />}
            />

          </Routes>

        </main>

      </div>

    </BrowserRouter>

  );
}


export default App;