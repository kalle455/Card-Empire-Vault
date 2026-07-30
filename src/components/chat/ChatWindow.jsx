import { useState } from "react";


export default function ChatWindow({
  card,
  onClose,
  conversation,
  onSend,
  currentUser
}) {


  const [message, setMessage] = useState("");



  function sendMessage() {

    if (!message.trim()) return;


    onSend({

      id: Date.now().toString(),

      sender: currentUser?.id || "Buyer",

      text: message.trim(),

      ts: new Date().toISOString()

    });


    setMessage("");

  }



  return (

    <div
      style={{
        position:"fixed",
        right:"25px",
        bottom:"25px",
        width:"380px",
        height:"520px",
        background:"#151c2b",
        color:"white",
        borderRadius:"20px",
        zIndex:9999,
        display:"flex",
        flexDirection:"column",
        boxShadow:"0 10px 40px rgba(0,0,0,.5)"
      }}
    >


      <div
        style={{
          padding:"18px",
          borderBottom:"1px solid rgba(255,255,255,.1)",
          display:"flex",
          justifyContent:"space-between"
        }}
      >

        <div>

          <strong>
            Order Chat
          </strong>

          <div
            style={{
              color:"#f5c542",
              fontSize:"14px"
            }}
          >
            {card?.name}
          </div>

        </div>


        <button
          onClick={onClose}
          style={{
            background:"none",
            border:"none",
            color:"white",
            cursor:"pointer"
          }}
        >
          ✕
        </button>


      </div>



      <div
        style={{
          flex:1,
          padding:"15px",
          overflowY:"auto"
        }}
      >

        {conversation?.messages?.map((msg)=>(

          <div
            key={msg.id}
            style={{
              background:
                msg.sender === "Kalenski™"
                ? "#2d2410"
                : "#202b40",
              borderRadius:"12px",
              padding:"12px",
              marginBottom:"10px"
            }}
          >

            <strong>
              {msg.sender}
            </strong>

            <p>
              {msg.text}
            </p>


          </div>

        ))}


      </div>



      <div
        style={{
          padding:"15px",
          display:"flex",
          gap:"10px"
        }}
      >

        <input

          value={message}

          onChange={(e)=>setMessage(e.target.value)}

          placeholder="Write a message..."

          style={{
            flex:1,
            background:"#0f141f",
            border:"1px solid rgba(255,255,255,.1)",
            color:"white",
            padding:"12px",
            borderRadius:"10px"
          }}

        />


        <button

          onClick={sendMessage}

          className="btn-primary"

        >
          Send
        </button>


      </div>


    </div>

  );

}