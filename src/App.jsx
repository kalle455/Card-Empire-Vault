import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import "./index.css";


function Dashboard() {
  return (
    <div className="fade-in home-page">

      <section className="hero card">

        <div className="hero-content">

          <p className="hero-small">
            Welcome to
          </p>

          <h1 className="title">
            The ONE AND ONLY
            <br />
            Card Empire®
          </h1>

          <h2 className="gold-text">
            Hosted by Kalenski™
          </h2>


          <p className="subtitle hero-description">
            A premium trading platform for collectors,
            duelists and the Card Empire community.
          </p>


          <div className="hero-buttons">

            <button className="btn-primary">
              Enter Marketplace
            </button>

            <button className="btn-secondary">
              View Events
            </button>

          </div>

        </div>


      </section>



      <section className="stats-grid">


        <div className="card stat-card">

          <span>
            2500+
          </span>

          <p>
            Cards Available
          </p>

        </div>



        <div className="card stat-card">

          <span>
            50+
          </span>

          <p>
            Events Hosted
          </p>

        </div>



        <div className="card stat-card">

          <span>
            1000+
          </span>

          <p>
            Community Members
          </p>

        </div>


      </section>




      <section className="home-section">

        <h2 className="section-title">
          Latest Events
        </h2>


        <div className="content-grid">


          <div className="card event-card">

            <h3>
              6-WAY FFA Tournament
            </h3>

            <p>
              Police Station • 8000 Life Points
            </p>

            <span>
              Prize: United We Stand
            </span>

          </div>



          <div className="card event-card">

            <h3>
              Card Empire Championship
            </h3>

            <p>
              Competitive Duel Event
            </p>

            <span>
              Sponsored by Kalenski™
            </span>

          </div>


        </div>

      </section>




      <section className="home-section">


        <h2 className="section-title">
          About Kalenski™
        </h2>


        <div className="card about-card">

          <p>
            Kalenski™ | The ONE AND ONLY Card Empire®
            is built around trading, collecting and
            competitive card gaming.
            <br />
            <br />
            A place created for the community,
            powered by passion and dedication.
          </p>

        </div>


      </section>




      <section className="home-section">


        <h2 className="section-title">
          Community News
        </h2>


        <div className="card news-card">

          <h3>
            Welcome to the Empire
          </h3>

          <p>
            New cards, events and marketplace updates
            will appear here.
          </p>

        </div>


      </section>


    </div>
  );
}



function Marketplace() {
  return <h1 className="title">Marketplace</h1>;
}


function Events() {
  return <h1 className="title">Events</h1>;
}


function Messages() {
  return <h1 className="title">Messages</h1>;
}


function Profile() {
  return <h1 className="title">Profile</h1>;
}


function Admin() {
  return <h1 className="title">Admin Panel</h1>;
}



function App() {

  return (

    <BrowserRouter>

      <div className="app-layout">

        <Navbar />

        <main className="main-content">

          <Routes>

            <Route path="/" element={<Dashboard />} />

            <Route path="/marketplace" element={<Marketplace />} />

            <Route path="/events" element={<Events />} />

            <Route path="/messages" element={<Messages />} />

            <Route path="/profile" element={<Profile />} />

            <Route path="/admin" element={<Admin />} />

          </Routes>

        </main>

      </div>

    </BrowserRouter>

  );
}


export default App;