const API_URL = "https://db.ygoprodeck.com/api/v7/cardinfo.php";


export async function getCards() {

  console.log("CARD API START");


  const response = await fetch(API_URL);


  console.log("API RESPONSE", response.status);


  const data = await response.json();


  console.log("API DATA", data);


  return data.data;

}