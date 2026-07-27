import { useState } from "react";
import ChatWindow from "./chat/ChatWindow";
import cards from "../data/cards";
import "./Marketplace.css";


export default function Marketplace() {


  const [cart, setCart] = useState([]);

  const [cartOpen, setCartOpen] = useState(false);

  const [orderOpen, setOrderOpen] = useState(false);


  const [conversation, setConversation] = useState({
    messages: []
  });



  function addToCart(card) {

    setCart(prev => [
      ...prev,
      card
    ]);

  }



  function removeFromCart(id) {

    setCart(prev =>
      prev.filter(card => card.id !== id)
    );

  }



  function checkout() {


    setConversation({

      messages: [

        {

          id: Date.now().toString(),

          sender: "Kalenski™",

          text:
            "Thank you very much for your order. I'll be in touch shortly to finalize the details with you.",

          ts: new Date().toISOString()

        }

      ]

    });


    setCartOpen(false);

    setOrderOpen(true);

  }



  function sendMessage(msg) {

    setConversation(prev => ({

      messages: [

        ...prev.messages,

        msg

      ]

    }));

  }



  const total = cart.reduce(

    (sum, card) => sum + card.price,

    0

  );



  return (

    <div className="marketplace-page">


      <div className="marketplace-header">


        <h1 className="title">
          Marketplace
        </h1>


        <button

          className="btn-primary"

          onClick={() => setCartOpen(true)}

        >

          🛒 Cart ({cart.length})

        </button>


      </div>





      <div className="card-grid">


        {cards.map(card => (


          <div

            className="market-card"

            key={card.id}

          >


            <div className="card-image">


              <img

                src={card.image}

                alt={card.name}

              />


            </div>



            <div className="market-card-info">


              <h3>
                {card.name}
              </h3>


              <p>
                {card.type}
              </p>


              <p>
                {card.rarity}
              </p>


              <p>
                Condition: {card.condition}
              </p>


              <p className="price">
                {card.price} G
              </p>



              <button

                className="btn-primary"

                onClick={() => addToCart(card)}

              >

                Add to Cart

              </button>


            </div>


          </div>


        ))}


      </div>







      {cartOpen && (


        <div className="modal-overlay">


          <div className="offer-modal card">


            <h2>
              Your Cart
            </h2>



            {cart.length === 0 && (

              <p>
                Your cart is empty.
              </p>

            )}




            {cart.map(card => (


              <div

                key={card.id}

                style={{
                  display:"flex",
                  justifyContent:"space-between",
                  marginBottom:"10px"
                }}

              >


                <span>
                  {card.name}
                </span>



                <span>

                  {card.price} G


                  <button

                    onClick={() => removeFromCart(card.id)}

                  >

                    ✕

                  </button>


                </span>


              </div>


            ))}




            <hr />


            <h3>
              Total: {total} G
            </h3>




            <button

              className="btn-primary"

              disabled={cart.length === 0}

              onClick={checkout}

            >

              Checkout

            </button>




            <button

              className="btn-secondary"

              onClick={() => setCartOpen(false)}

            >

              Close

            </button>



          </div>


        </div>


      )}







      {orderOpen && (


        <ChatWindow


          currentUser={{

            id:"Buyer"

          }}



          card={{

            name:`${cart.length} Card Order`

          }}



          conversation={conversation}



          onSend={sendMessage}



          onClose={() => setOrderOpen(false)}


        />


      )}



    </div>

  );

}