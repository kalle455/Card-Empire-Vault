import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import "./Community.css";

const statuses = {
  planned: "Planned",
  in_development: "In Development",
  released: "Released",
  rejected: "Rejected",
};

function Stars({ value = 0, onChange, label = "rating" }) {
  return <span className="community-stars" aria-label={label}>
    {[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" className={star <= value ? "is-active" : ""} onClick={() => onChange?.(star)} disabled={!onChange} aria-label={star + " stars"}>â˜…</button>)}
  </span>;
}

export default function Community() {
  const { session, profile, discordConnected } = useAuth();
  const [suggestions, setSuggestions] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [polls, setPolls] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [notice, setNotice] = useState("");
  const [suggestionForm, setSuggestionForm] = useState({ title: "", body: "" });
  const [reviewForm, setReviewForm] = useState({ rating: 5, body: "" });
  const [comments, setComments] = useState({});
  const isAdmin = profile?.role === "admin";

  async function load() {
    if (!session || !discordConnected) return;
    const [suggestionResult, reviewResult, announcementResult, pollResult, availabilityResult] = await Promise.all([
      supabase.from("community_suggestions").select("*, player:profiles!community_suggestions_player_id_fkey(username,dmo_name), votes:community_suggestion_votes(rating,player_id), comments:community_comments(id,body,created_at,player_id,player:profiles!community_comments_player_id_fkey(username,dmo_name))").order("created_at", { ascending: false }),
      supabase.from("community_reviews").select("*, player:profiles!community_reviews_player_id_fkey(username,dmo_name)").order("created_at", { ascending: false }).limit(30),
      supabase.from("community_announcements").select("*").order("created_at", { ascending: false }),
      supabase.from("community_polls").select("*, options:community_poll_options(*), votes:community_poll_votes(option_id,player_id)").eq("active", true).order("created_at", { ascending: false }),
      supabase.from("empire_availability").select("*").order("starts_at", { ascending: true }),
    ]);
    const firstError = suggestionResult.error || reviewResult.error || announcementResult.error || pollResult.error || availabilityResult.error;
    if (firstError) setNotice(firstError.message);
    setSuggestions(suggestionResult.data ?? []);
    setReviews(reviewResult.data ?? []);
    setAnnouncements(announcementResult.data ?? []);
    setPolls(pollResult.data ?? []);
    setAvailability(availabilityResult.data ?? []);
  }

  useEffect(() => {
    load();
    if (!session) return undefined;
    const channel = supabase.channel("cardstock-community-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "community_suggestions" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_suggestion_votes" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_comments" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_reviews" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_announcements" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_polls" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_poll_options" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_poll_votes" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "empire_availability" }, load)
      .subscribe();
    return () => channel.unsubscribe();
  }, [session?.user?.id, discordConnected]);

  const averageReview = useMemo(() => reviews.length ? reviews.reduce((sum, item) => sum + Number(item.rating), 0) / reviews.length : 0, [reviews]);

  async function submitSuggestion(event) {
    event.preventDefault();
    if (!session) return;
    const { error } = await supabase.from("community_suggestions").insert({ player_id: session.user.id, title: suggestionForm.title.trim(), body: suggestionForm.body.trim() });
    if (error) return setNotice(error.message);
    setSuggestionForm({ title: "", body: "" });
    setNotice("Suggestion transmitted to the Card Empire team.");
    load();
  }

  async function rateSuggestion(suggestionId, rating) {
    const before = suggestions;
    setSuggestions((current) => current.map((item) => item.id !== suggestionId ? item : {
      ...item,
      votes: [...(item.votes ?? []).filter((vote) => vote.player_id !== session.user.id), { player_id: session.user.id, rating }],
    }));
    const { error } = await supabase.from("community_suggestion_votes").upsert({ suggestion_id: suggestionId, player_id: session.user.id, rating }, { onConflict: "suggestion_id,player_id" });
    if (error) { setSuggestions(before); setNotice(error.message); } else load();
  }

  async function submitComment(suggestionId) {
    const body = String(comments[suggestionId] ?? "").trim();
    if (!body) return;
    const { error } = await supabase.from("community_comments").insert({ suggestion_id: suggestionId, player_id: session.user.id, body });
    if (error) return setNotice(error.message);
    setComments((current) => ({ ...current, [suggestionId]: "" }));
    load();
  }

  async function submitReview(event) {
    event.preventDefault();
    const { error } = await supabase.from("community_reviews").insert({ player_id: session.user.id, rating: reviewForm.rating, body: reviewForm.body.trim() });
    if (error) return setNotice(error.message);
    setReviewForm({ rating: 5, body: "" });
    setNotice("Your review is now part of the community record.");
    load();
  }

  async function votePoll(pollId, optionId) {
    const before = polls;
    setPolls((current) => current.map((poll) => poll.id !== pollId ? poll : {
      ...poll,
      votes: [...(poll.votes ?? []).filter((vote) => vote.player_id !== session.user.id), { player_id: session.user.id, option_id: optionId }],
    }));
    const { error } = await supabase.from("community_poll_votes").upsert({ poll_id: pollId, option_id: optionId, player_id: session.user.id }, { onConflict: "poll_id,player_id" });
    if (error) { setPolls(before); setNotice(error.message); } else load();
  }

  async function updateStatus(id, status) {
    const { error } = await supabase.from("community_suggestions").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) setNotice(error.message); else load();
  }

  if (!session || !discordConnected) return <main className="community-page community-locked"><p className="vault-overline">COMMUNITY ACCESS</p><h1>Connect Discord<br /><em>to take part.</em></h1><button onClick={() => window.location.assign("/profile")}>Open player profile</button></main>;

  return <main className="community-page">
    <section className="community-hero">
      <div className="community-orbit-art" aria-hidden="true">
        <span className="orbit-sun" />
        <i className="orbit-ring orbit-ring-one"><b /></i>
        <i className="orbit-ring orbit-ring-two"><b /></i>
        <i className="orbit-ring orbit-ring-three"><b /></i>
        <i className="orbit-ring orbit-ring-four"><b /></i>
        <i className="orbit-ring orbit-ring-five"><b /></i>
      </div>
      <p className="vault-overline">CARD EMPIRE Â· COMMUNITY COMMAND</p>
      <h1>Your voice.<br /><em>Moves the Empire.</em></h1>
      <p>Suggestions, reviews, polls and direct signals between the Card Empire team and every verified player.</p>
      <div className="community-score"><Stars value={Math.round(averageReview)} /><strong>{averageReview ? averageReview.toFixed(1) : "â€”"}</strong><span>{reviews.length} written reviews</span></div>
    </section>

    {notice && <p className="community-notice">{notice}</p>}

    <section className="community-availability">
      <header><div><p className="vault-overline">KALENSKI PICKUP READINESS</p><h2>Online.<br /><em>Ready for collection.</em></h2></div><span><i /> Live calendar</span></header>
      <div className="availability-track">
        {availability.filter((slot) => new Date(slot.ends_at).getTime() > Date.now()).slice(0, 8).map((slot) => {
          const starts = new Date(slot.starts_at);
          const ends = new Date(slot.ends_at);
          const active = starts.getTime() <= Date.now() && ends.getTime() > Date.now();
          return <article className={active ? "is-online" : ""} key={slot.id}>
            <div className="availability-date"><b>{starts.toLocaleDateString("de-DE", { day: "2-digit" })}</b><span>{starts.toLocaleDateString("de-DE", { month: "short" }).replace(".", "")}</span></div>
            <div><small>{active ? "ONLINE NOW" : starts.toLocaleDateString("de-DE", { weekday: "long" })}</small><h3>{slot.title}</h3><p>{starts.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} â€“ {ends.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Â· {slot.location}</p>{slot.note && <em>{slot.note}</em>}</div>
          </article>;
        })}
        {!availability.some((slot) => new Date(slot.ends_at).getTime() > Date.now()) && <article className="availability-empty"><div><small>NEXT WINDOW</small><h3>No pickup time announced yet.</h3><p>Kalenski's next online window will appear here live.</p></div></article>}
      </div>
    </section>

    <section className="community-announcements">
      <header><p className="vault-overline">EMPIRE TRANSMISSIONS</p><h2>Announcements</h2></header>
      <div>{announcements.map((item) => <article key={item.id}><span>{new Date(item.created_at).toLocaleDateString()}</span><h3>{item.title}</h3><p>{item.body}</p></article>)}{!announcements.length && <article><span>LIVE CHANNEL</span><h3>Awaiting the first transmission.</h3></article>}</div>
    </section>

    <section className="community-command-grid">
      <form className="community-form suggestion-form" onSubmit={submitSuggestion}>
        <p className="vault-overline">FEATURE SUGGESTIONS</p><h2>Send an idea.</h2>
        <label>Title<input required minLength="3" maxLength="90" value={suggestionForm.title} onChange={(event) => setSuggestionForm({ ...suggestionForm, title: event.target.value })} placeholder="What should Card Empire build?" /></label>
        <label>Suggestion<textarea required minLength="8" maxLength="1600" value={suggestionForm.body} onChange={(event) => setSuggestionForm({ ...suggestionForm, body: event.target.value })} placeholder="Explain the feature and why it matters." /></label>
        <button>Transmit suggestion <span>â†—</span></button>
      </form>
      <form className="community-form review-form" onSubmit={submitReview}>
        <p className="vault-overline">WRITTEN REVIEWS</p><h2>Rate the Empire.</h2>
        <Stars value={reviewForm.rating} onChange={(rating) => setReviewForm({ ...reviewForm, rating })} />
        <label>Your review<textarea required minLength="3" maxLength="1200" value={reviewForm.body} onChange={(event) => setReviewForm({ ...reviewForm, body: event.target.value })} placeholder="What should other players know?" /></label>
        <button>Publish review <span>â†—</span></button>
      </form>
    </section>

    <section className="suggestion-board">
      <header><div><p className="vault-overline">COMMUNITY DEVELOPMENT BOARD</p><h2>Ideas in motion.</h2></div><span>{suggestions.length} signals</span></header>
      <div className="suggestion-list">
        {suggestions.map((item) => {
          const votes = item.votes ?? [];
          const myVote = votes.find((vote) => vote.player_id === session.user.id)?.rating ?? 0;
          const average = votes.length ? votes.reduce((sum, vote) => sum + Number(vote.rating), 0) / votes.length : 0;
          return <article className="suggestion-card" key={item.id}>
            <header><span className={"suggestion-status status-" + item.status}>{statuses[item.status]}</span><small>{new Date(item.created_at).toLocaleDateString()}</small></header>
            <h3>{item.title}</h3><p>{item.body}</p>
            <div className="suggestion-author">BY {item.player?.dmo_name ?? item.player?.username ?? "PLAYER"}</div>
            <div className="suggestion-rating"><Stars value={myVote} onChange={(rating) => rateSuggestion(item.id, rating)} /><span>{average ? average.toFixed(1) : "Not rated"} Â· {votes.length} ratings</span></div>
            {isAdmin && <select value={item.status} onChange={(event) => updateStatus(item.id, event.target.value)}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>}
            <div className="suggestion-comments">{(item.comments ?? []).map((comment) => <p key={comment.id}><b>{comment.player?.dmo_name ?? comment.player?.username ?? "Player"}</b>{comment.body}</p>)}</div>
            <div className="comment-entry"><input value={comments[item.id] ?? ""} onChange={(event) => setComments((current) => ({ ...current, [item.id]: event.target.value }))} maxLength="900" placeholder="Comment on this suggestionâ€¦" /><button type="button" onClick={() => submitComment(item.id)}>Send</button></div>
          </article>;
        })}
      </div>
    </section>

    <section className="community-polls">
      <header><p className="vault-overline">LIVE COMMUNITY POLLS</p><h2>Your vote counts.</h2></header>
      <div>{polls.map((poll) => {
        const total = poll.votes?.length ?? 0;
        const selected = poll.votes?.find((vote) => vote.player_id === session.user.id)?.option_id;
        return <article key={poll.id}><h3>{poll.question}</h3>{(poll.options ?? []).sort((a, b) => a.position - b.position).map((option) => {
          const count = poll.votes?.filter((vote) => vote.option_id === option.id).length ?? 0;
          const percent = total ? Math.round(count / total * 100) : 0;
          return <button type="button" className={selected === option.id ? "is-selected" : ""} onClick={() => votePoll(poll.id, option.id)} key={option.id}><span>{option.label}</span><i><b style={{ width: percent + "%" }} /></i><em>{percent}%</em></button>;
        })}<small>{total} votes</small></article>;
      })}{!polls.length && <article><h3>No active poll right now.</h3><p>The next decision will appear here live.</p></article>}</div>
    </section>

    <section className="community-review-wall">
      <header><p className="vault-overline">PLAYER REVIEWS</p><h2>Written by the community.</h2></header>
      <div>{reviews.map((review) => <article key={review.id}><Stars value={review.rating} /><p>â€œ{review.body}â€</p><span>{review.player?.dmo_name ?? review.player?.username ?? "Verified player"}</span></article>)}</div>
    </section>

  </main>;
}