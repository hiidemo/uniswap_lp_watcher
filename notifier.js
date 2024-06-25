const {EOL} = require('os');
const axios = require('axios');
const TELEGRAM_URL = 'https://api.telegram.org/bot' + process.env.TELEGRAM_BOT_TOKEN + '/sendMessage?chat_id=' + process.env.TELEGRAM_CHAT_ID + '&text=';
module.exports = {
 notify: async function(title, body) {
  axios.get(TELEGRAM_URL + encodeURIComponent(title + EOL + body))
   .then(function (response) {
    // handle success
    console.log('Message is sent to Telegram');
   })
   .catch(function (error) {
    // handle error
    console.log(error);
   })
 }
}