import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";

import Navbar from "./components/Navbar";
import Marketplace from "./components/Marketplace";
import { getCards } from "./services/cardApi";

import "./index.css";



function Dashboard() {


  useEffect(() => {

    getCards()

      .then(cards => {

        console.log(
          "YGOPRODECK CARDS:",
          cards.slice(0, 5)
        );

      })

      .catch(error => {

        console.error(
          "CARD API ERROR:",
          error
        );

      });


  }, []);



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



    </div>

  );

}





function Events() {

  return (

    <div className="fade-in">

      <h1 className="title">
        Events
      </h1>

    </div>

  );

}




function Messages() {

  return (

    <div className="fade-in">

      <h1 className="title">
        Messages
      </h1>

    </div>

  );

}





function Profile() {

  return (

    <div className="fade-in">

      <h1 className="title">
        Profile
      </h1>

    </div>

  );

}





function Admin() {

  return (

    <div className="fade-in">

      <h1 className="title">
        Admin Panel
      </h1>

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