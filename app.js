var express = require( 'express' );
var session = require( 'express-session' );
var path = require( 'path' );
var bodyParser = require( 'body-parser' );
var { rtm, pendingUsers, web } = require( './bot' )
var google = require( 'googleapis' );
var googleAuth = require( 'google-auth-library' );
var OAuth2 = google.auth.OAuth2;
var { User, Reminder } = require( './models' );
var moment = require('moment');

var app = express();

app.use( bodyParser.json() );
app.use( bodyParser.urlencoded( { extended: false } ) );

function getGoogleAuth() {
    return new OAuth2(
        process.env.OAUTH_CLIENT_ID,
        process.env.OAUTH_SECRET,
        process.env.DOMAIN + '/oauthcallback'
        );
};

app.get( '/connect', ( req, res ) => {
    var userId = req.query.user;
    if ( !userId ) {
        res.status( 400 ).send( 'Missing user id' );
    } else {
        User.findById( userId )
        .then( function ( user ) {
            if ( !user ) {
                res.status( 404 ).send( 'Cannot find user' );
                } else { //have a user, ready to connect to google
                    var oauth2Client = getGoogleAuth();
                    var url = oauth2Client.generateAuthUrl( {
                        access_type: 'offline',
                        prompt: 'consent',
                        scope: [
                        'https://www.googleapis.com/auth/userinfo.profile',
                        'https://www.googleapis.com/auth/calendar'
                        ],
                        state: encodeURIComponent( JSON.stringify( {
                            auth_id: userId
                        } ) )
                    } );
                    res.redirect( url ); //send to google to authenticate
                };
            } );
    };
} );

app.get( '/oauthcallback', function ( req, res ) {
    //callback contains an authorization code, use it to get a token.
    var googleAuth = getGoogleAuth();
    googleAuth.getToken( req.query.code, function ( err, tokens ) { //turn code into tokens (google's credentials)
        if ( err ) {
            res.status( 500 ).json( { error: err } );
        } else {
            googleAuth.setCredentials( tokens ); //initialize google library with all credentials so it can make requests
            var plus = google.plus( 'v1' );
            plus.people.get( { auth: googleAuth, userId: 'me' }, function ( err, googleUser ) {
                if ( err ) {
                    res.status( 500 ).json( { error: err } );
                } else {
                    User.findById( JSON.parse( decodeURIComponent( req.query.state ) ).auth_id )
                    .then( function ( mongoUser ) {
                        mongoUser.google = tokens;
                        mongoUser.google.profile_id = googleUser.id;
                        mongoUser.google.profile_name = googleUser.displayName;
                        return mongoUser.save();
                    } )
                    .then( function ( mongoUser ) {
                            res.send( 'You are connected to Google Calendar!' ); //sends to webpage
                        } )
                    .catch( function ( err ) { console.log( 'Server error at /oauthcallback', err ); } );
                };
            } )
        }
    } )
} );

app.get( '/', ( req, res ) => {
    res.send( 'Event created! :fire:' )
} );

app.post( '/slack/interactive', ( req, res ) => {
  var payloadJSON = JSON.parse(req.body.payload);
  console.log('payload after select', payloadJSON);
  console.log('whats in the actions', payloadJSON.actions[0]);

  if (payloadJSON.callback_id === 'conflict') {
    res.send('Nice, it works!');
  } else {


  var payloadJSON = JSON.parse(req.body.payload);
  console.log('payload', req.body.payload);
  console.log('channel', payloadJSON.channel.id);

  web.chat.postMessage( payloadJSON.channel.id,
      'Oh No! There is a conflict! :(',
      {
    "text": "Resolve conflict.",
    "response_type": "in_channel",
    "attachments": [
        {
            "text": "Choose a time",
            "fallback": "If you could read this message, you'd be choosing something fun to do right now.",
            "color": "#3AA3E3",
            "attachment_type": "default",
            "callback_id": "conflict",
            "actions": [
                {
                    "name": "games_list",
                    "text": "Available times...",
                    "type": "select",
                    "options": [
                        {
                            "text": "12:00 Today",
                            "value": ""
                        },
                        {
                            "text": "1:00 Today",
                            "value": "bridge"
                        },
                        {
                            "text": "2:00 Today",
                            "value": "checkers"
                        },
                        {
                            "text": "3:00 Today",
                            "value": "chess"
                        },
                        {
                            "text": "4:00 Today",
                            "value": "poker"
                        },
                        {
                            "text": "5:00 Today",
                            "value": "maze"
                        },
                        {
                            "text": "6:00 Today",
                            "value": "maze"
                        },
                        {
                            "text": "7:00 Today",
                            "value": "maze"
                        },
                        {
                            "text": "8:00 Today",
                            "value": "maze"
                        },
                        {
                            "text": "9:00 Today",
                            "value": "war"
                        }
                    ]
                }
            ]
        }
    ]
}
  );
res.end();
  }



//     var payload = JSON.parse( req.body.payload );
//     var ind = pendingUsers.indexOf(payload.user.id)
//     pendingUsers.splice(ind);
//     if ( payload.actions[0].value === 'true' ) {
//       User.findOne( { slackId: payload.user.id }, function ( err, user ) {
//         if ( err ) {
//           throw new Error( err );
//       }
//       else {
//           console.log(user)
//           var subject = user.pendingInfo.subject;
//           var date = user.pendingInfo.date;
//           var time = user.pendingInfo.time;
//           var people = user.pendingInfo.people;
//
//           if(time){
//               var time30 = "2017-08-02 " + time
//               time30 = moment(time30).add(30, 'minutes').format("HH:mm:ss")
//           }
//           var day = moment( date ).format( "YYYY-MM-DD" )
//           if(!people){
//               var rem = new Reminder( {
//                   subject: subject,
//                   date: day,
//                   userId: user.slackId
//               } )
//               rem.save();
//           }
//           var calendar = google.calendar( 'v3' );
//           people.forEach(function(inviteeObj){
//             User.findOne({slackId: inviteeObj.slackId}, function(err, invitee){
//
//                 var auth = getGoogleAuth();
//                 auth.credentials = invitee.google;
//                 if ( user.google.expiry_date < new Date().getTime() ) {
//                     auth.refreshAccessToken(function( err, tokens ) {
//                         if (err) {
//                             throw new Error( err );
//                         } else {
//                             user.google = tokens;
//                             user.save();
//                         }
//                     })
//                 }
//                 console.log(date, time);
//                 calendar.events.list({
//                     auth: auth,
//                     calendarId: 'primary',
//                     timeMin: (new Date()).toISOString(),
//                     maxResults: 10,
//                     singleEvents: true,
//                     orderBy: 'startTime'
//                 }, function(err, response) {
//                     if (err) {
//                       console.log('The API returned an error: ' + err);
//                       return;
//                   }
//                   var events = response.items;
//                   if (events.length == 0) {
//                       console.log('No upcoming events found.');
//                   } else {
//                       console.log('Upcoming 10 events:');
//                       for (var i = 0; i < events.length; i++) {
//                         var event = events[i];
//                         var start = event.start.dateTime || event.start.date;
//                         console.log('%s - %s', start, event.summary);
//                     }
//                 }
//             });
//
//
//             })
//         })
//
//           var event = {
//               summary: people ? `meeting with ${people}${subject ? (': ' + subject) : ''}` : subject,
//               description: people ? `meeting with ${people}${subject ? (': ' + subject) : ''}` : subject,
//               start: {
//                   dateTime: time ? (date + 'T' + time + '-00:01') : (date + "T5:00:00-00:01"),
//                   timeZone: 'America/Los_Angeles'
//               },
//               end: {
//                   dateTime: time ? (date + 'T' + time30 + '-00:01') : (date + "T23:59:00-00:01"),
//                   timeZone: 'America/Los_Angeles'
//               }
//           }
//
//           var auth = getGoogleAuth();
//           auth.credentials = user.google;
//           if ( user.google.expiry_date < new Date().getTime() ) {
//               auth.refreshAccessToken(function( err, tokens ) {
//                   if (err) {
//                       throw new Error( err );
//                   } else {
//                       user.google = tokens;
//                       user.save();
//                   }
//               })
//           }
//           calendar.events.insert( {
//               auth: auth,
//               calendarId: 'primary',
//               resource: event,
//           }, function ( err, event ) {
//               if ( err ) {
//                   console.log( 'There was an error contacting the Calendar service: ' + err );
//                   return;
//               }
//               console.log( 'Event created: %s', event.htmlLink );
//           } );
//       }
//       user.pendingInfo = {}
//       user.save()
//   } )
// res.send( 'Creating event! :fire: ' );
// } else {
//     res.send( 'Cancelled :x:' )
// }
} );

var port = process.env.PORT ||  3000;
app.listen( port );
