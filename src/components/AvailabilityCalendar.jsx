import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./AvailabilityCalendar.css";

export default function AvailabilityCalendar() {
  const [windows, setWindows] = useState([]);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    let active = true;
    async function load() {
      const now = new Date().toISOString();
      const [availabilityResult, eventsResult] = await Promise.all([
        supabase.from("empire_availability").select("id,title,location,note,starts_at,ends_at").gt("ends_at", now).order("starts_at", { ascending: true }).limit(6),
        supabase.from("events").select("id,title,description,starts_at,event_format").gte("starts_at", now).order("starts_at", { ascending: true }).limit(4),
      ]);
      if (active) {
        setWindows(availabilityResult.data ?? []);
        setEvents(eventsResult.data ?? []);
      }
    }
    load();
    const channel = supabase.channel("home-pickup-calendar")
      .on("postgres_changes", { event: "*", schema: "public", table: "empire_availability" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, load)
      .subscribe();
    return () => {
      active = false;
      channel.unsubscribe();
    };
  }, []);

  return <section className="home-availability-calendar">
    <header><div><p className="home-eyebrow">LIVE PICKUP CALENDAR</p><h2>Know when<br /><em>the gate opens.</em></h2></div><p>Official online windows for orders, card pickup and direct handover inside DMO.</p></header>
    {events.length > 0 && <div className="home-event-calendar"><header><span>UPCOMING TOURNAMENTS</span><Link to="/events">View all events ↗</Link></header><div>{events.map((event) => {
      const starts = new Date(event.starts_at);
      return <Link to="/events" key={event.id}><time dateTime={event.starts_at}><b>{starts.toLocaleDateString("en-GB", { day: "2-digit" })}</b><span>{starts.toLocaleDateString("en-GB", { month: "short" })}</span></time><span><small>{String(event.event_format || "DMO EVENT").replaceAll("_", " ")}</small><strong>{event.title}</strong><em>{starts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · Current in-game rules</em></span></Link>;
    })}</div></div>}
    <div className="home-calendar-track">
      {windows.map((slot) => {
        const starts = new Date(slot.starts_at);
        const ends = new Date(slot.ends_at);
        const online = starts.getTime() <= Date.now() && ends.getTime() > Date.now();
        return <article className={online ? "is-online" : ""} key={slot.id}>
          <time><b>{starts.toLocaleDateString("en-GB", { day: "2-digit" })}</b><span>{starts.toLocaleDateString("en-GB", { month: "short" })}</span></time>
          <div><small>{online ? "ONLINE NOW" : starts.toLocaleDateString("en-GB", { weekday: "long" }).toUpperCase()}</small><h3>{slot.title}</h3><p>{starts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – {ends.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {slot.location}</p>{slot.note && <em>{slot.note}</em>}</div>
        </article>;
      })}
      {!windows.length && <article className="calendar-empty"><span>NO WINDOW PUBLISHED</span><h3>The next pickup time will appear here live.</h3></article>}
    </div>
  </section>;
}
