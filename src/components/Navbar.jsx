import { NavLink } from "react-router-dom";
import "./Navbar.css";

function Navbar() {
  return (
    <aside className="sidebar">

      <div className="brand">
        <h2>Kalenski™</h2>
        <span>Card Empire®</span>
      </div>


      <nav className="nav-menu">

        <NavLink to="/">
          Dashboard
        </NavLink>

        <NavLink to="/marketplace">
          Marketplace
        </NavLink>

        <NavLink to="/events">
          Events
        </NavLink>

        <NavLink to="/messages">
          Messages
        </NavLink>

        <NavLink to="/profile">
          Profile
        </NavLink>

        <NavLink to="/admin">
          Admin
        </NavLink>

      </nav>


      <div className="sidebar-footer">

        <div className="user-box">

          <strong>
            Kalenski
          </strong>

          <span>
            Admin
          </span>

        </div>

      </div>

    </aside>
  );
}

export default Navbar;