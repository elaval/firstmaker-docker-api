'use strict';

/* Note: using staging server url, remove .testing() for production
Using .testing() will overwrite the debug flag with true */ 
/* 
We will use letsencrypt soon ... currently experiencing some rate issues so 
will use a bought certificate in the mean time 

var LEX = require('letsencrypt-express');//.testing();

// Change these two lines!
var DOMAIN = 'api.firstmakers.com';
var EMAIL = 'ernesto.laval@gmail.com';

var lex = LEX.create({
  configDir: require('os').homedir() + '/letsencrypt/etc'
, approveRegistration: function (hostname, approve) { // leave `null` to disable automatic registration
    if (hostname === DOMAIN) { // Or check a database or list of allowed domains
      approve(null, {
        domains: [DOMAIN]
      , email: EMAIL
      , agreeTos: true
      });
    }
  }
});
*/

// =======================
// get the packages we need ============
// =======================
var express     = require('express');
var app         = express();
var bodyParser  = require('body-parser');
var morgan      = require('morgan');
var mongoose    = require('mongoose');
var spdy = require('spdy');
var fs = require('fs');
var bearerToken = require("express-bearer-token");
var cors = require('cors')

var config = require('./config'); // get our config file

// Mongoose models
var User   = require('./app/models/user'); // get our mongoose model
var Device   = require('./app/models/device'); // get our mongoose model
var Sketch   = require('./app/models/sketch'); // get our mongoose model
var Pin   = require('./app/models/pin'); // get our mongoose model

// requestHandlers
var authHandlers = require("./app/requestHandlers/auth");
var sketchHandlers = require("./app/requestHandlers/sketch");
var deviceHandlers = require("./app/requestHandlers/device");

// =======================
// configuration =========
// =======================
// Get config variables from ENVIRONMENT or from default config file

// Set up Mongo DB config
var mongoDb = process.env.MONGO_DATABASE || config.database;
mongoose.connect(mongoDb); // connect to database

// use body parser so we can get info from POST and/or URL parameters
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Extracts the token from Header, query or body
app.use(bearerToken({
  bodyKey: 'access_token',
  queryKey: 'access_token',
  headerKey: 'Bearer',
  reqKey: 'token'
}));

// use morgan to log requests to the console
app.use(morgan('dev'));
app.options('*', cors()); // to allow pre-flight cors 


// =======================
// routes ================
// =======================

// get an instance of the router for api routes
var apiRoutes = express.Router(); 
var authRoutes = express.Router(); 

/**
 * Auth handlers
 */
authRoutes.post('/signup', authHandlers.signup);
authRoutes.post('/signin', authHandlers.signin);
authRoutes.post('/token/revoke', authHandlers.token_revoke);
authRoutes.post('/token', authHandlers.token);
authRoutes.post('/forgotpassword', authHandlers.forgotpassword);
authRoutes.post('/resetpassword', authHandlers.resetpassword);

// API route middleware to verify a valid access_token for /api/* requests
apiRoutes.use(authHandlers.token_validator);

// route to show a random message (GET http://localhost:8080/api/)
apiRoutes.get('/', function(req, res) {
  res.json({ message: req.user.username + ', welcome to Firstmakers API!' });
});

// route to return all users (GET http://localhost:8080/api/users)
apiRoutes.get('/users', function(req, res) {
  User.find({},{"username":1}, function(err, users) {
    res.json(users);
  });
});   

/**
 * Pins - manage pin values associated to a device / username
 */
apiRoutes.get('/devices/:deviceName/pins', deviceHandlers.pins_read);
apiRoutes.put('/devices/:deviceName/pins/:pin', deviceHandlers.pins_update);
apiRoutes.delete('/devices/:deviceName/pins/:pin', deviceHandlers.pins_delete);

/**
 * Devices - manage device objects associated to a specific user
 */
apiRoutes.get('/devices/active', deviceHandlers.devices_active_read);
apiRoutes.get('/devices', deviceHandlers.read);
apiRoutes.get('/devices/:deviceName', deviceHandlers.readOne);
apiRoutes.post('/devices', deviceHandlers.create);
apiRoutes.put('/devices/:deviceName', deviceHandlers.update);
apiRoutes.delete('/devices/:deviceName', deviceHandlers.delete);

/**
 * Sketches - manage  sketches associated to a specific user
 */
apiRoutes.get('/sketches', sketchHandlers.read);
apiRoutes.get('/sketches/:id', sketchHandlers.readOne);
apiRoutes.post('/sketches', sketchHandlers.create);
apiRoutes.put('/sketches/:id', sketchHandlers.update);
apiRoutes.delete('/sketches/:id', sketchHandlers.delete);


// apply the routes to our application authentication functions with the prefix /api/auth
app.use('/api/auth', authRoutes);

// apply the routes to our application with the prefix /api
app.use('/api', apiRoutes);



// basic route
app.get('/', function(req, res) {
    res.send('Hello! The API is at '+req.protocol+'://'+req.hostname+':' + port + '/api');
});


// =======================
// start the server ======
// =======================

// Check if we are forcing a non secure https/ssl mode 
if (!process.env.USE_HTTPS) {
  // NOn HTTPS MODE (we use a standard - non secure port)   NOT RECOMMENDED
  // Only use this if you don´t have the apporpiate ssl certificates
  var port = process.env.PORT || 8080; // used to create, sign, and verify tokens
  app.listen(port);
  console.log("listening on port "+port);

} else {
  // HTTP Secure mode
  // We read certificates from /root/certs
  var options = {
    key: fs.readFileSync('/root/certs/api.key.pem'),
      cert: fs.readFileSync('/root/certs/api.cert.crt'),
      ca: [fs.readFileSync('/root/certs/ca_gd1.crt'), fs.readFileSync('/root/certs/ca_gd2.crt'), fs.readFileSync('/root/certs/ca_gd3.crt')]
  };
  
  var server = spdy.createServer(options, app);
  
  server.listen(443);
  console.log("listening on port 443");

  /* 
  When letsencrypt is used, we will go for the following server config
  lex.onRequest = app;

  lex.listen([80], [443, 5001], function () {
    var protocol = ('requestCert' in this) ? 'https': 'http';
    console.log("Listening at " + protocol + '://localhost:' + this.address().port);
  });
  */
}




