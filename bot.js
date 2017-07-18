var {RtmClient, WebClient, CLIENT_EVENTS, RTM_EVENTS } = require('@slack/client');
var axios = require('axios');

// var bot_token = 'xoxb-214873434806-eyESITOHR146yGfFeFYnxNNE';

var bot_token = 'xoxb-214174279413-IXvWa6Tozq57FGpKhsvlOW63';
var web = new WebClient(bot_token);
var rtm = new RtmClient( bot_token );

let channel;

// The client will emit an RTM.AUTHENTICATED event on successful connection, with the `rtm.start` payload
rtm.on( CLIENT_EVENTS.RTM.AUTHENTICATED, ( rtmStartData ) => {
    for ( const c of rtmStartData.channels ) {
        if ( c.is_member && c.name === 'general' ) { channel = c.id }
    }
    console.log( `Logged in as ${ rtmStartData.self.name } of team ${ rtmStartData.team.name }, but not yet connected to a channel` );
} );

// you need to wait for the client to fully connect before you can send messages
rtm.on( CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, function () {
    rtm.sendMessage( 'Planner Khaleesi active!', channel );
} );

rtm.on(RTM_EVENTS.MESSAGE, (msg) => {
  var dm = rtm.dataStore.getDMByUserId(msg.user);
  if (!dm || dm.id !== msg.channel || msg.type !== 'message') {
    console.log('message not sent to dm, ignoring');
    return;
  }
  // rtm.sendMessage(msg.text, msg.channel);
  console.log('msg', msg);
  axios.get('https://api.api.ai/api/query', {
    params: {
      v: 20150910,
      lang: 'en',
      timezone: '2017-07-17T16:55:52-0700',
      query: msg.text,
      sessionId: msg.user
    },
    headers: {
      Authorization: 'Bearer 4b56eeb0a61f4b11a9de11f49abcad89'
      // Authorization : `Bearer ${process.env.API_AI_TOKEN}`
    }
  })
  .then(({data}) => {
    console.log('data', data);
    if (data.result.actionIncomplete) {
      rtm.sendMessage(data.result.fulfillment.speech, msg.channel);
    } else {
      web.chat.postMessage(msg.channel,
        `Creating reminder for '${data.result.parameters.subject}' on ${data.result.parameters.date}`,
        {
          "attachments": [
            {
              "fallback": "You are unable to choose a game",
              "callback_id": "reminder",
              "color": "#3AA3E3",
              "attachment_type": "default",
              "actions": [
                {
                  "name": "confirm",
                  "text": "Confirm",
                  "type": "button",
                  "value": "true"
                },
                {
                  "name": "cancel",
                  "text": "Cancel",
                  "type": "button",
                  "value": "false"
                }
              ]
            }
          ]
        }
      );
    }
  })
  .catch(err => {
    console.log('error', err);
  })
});

rtm.start();