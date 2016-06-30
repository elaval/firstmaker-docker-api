// =======================
// get the packages we need ============
// =======================
var express     = require('express');
var app         = express();
var bodyParser  = require('body-parser');
var morgan      = require('morgan');
var mongoose    = require('mongoose');
var bCrypt = require('bcrypt-nodejs');

var jwt    = require('jsonwebtoken'); // used to create, sign, and verify tokens
var config = require('./config'); // get our config file
var User   = require('./app/models/user'); // get our mongoose model
var Device   = require('./app/models/device'); // get our mongoose model
    
// =======================
// configuration =========
// =======================
// Get config variables from ENVIRONMENT or from defaut config file
var jwtSecret = process.env.JWT_SECRET || config.secret;
var mongoDb = process.env.MONGO_DATABASE || config.database;

var port = process.env.PORT || 8080; // used to create, sign, and verify tokens
mongoose.connect(mongoDb); // connect to database
app.set('superSecret', jwtSecret); // secret variable

// use body parser so we can get info from POST and/or URL parameters
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// use morgan to log requests to the console
app.use(morgan('dev'));

// Generates hash using bCrypt
var createHash = function(password){
    return bCrypt.hashSync(password, bCrypt.genSaltSync(10), null);
}

// =======================
// routes ================
// =======================

// get an instance of the router for api routes
var apiRoutes = express.Router(); 

// route to register a new user (POST http://localhost:8080/signup)
app.post('/signup', function(req, res) {
  var username = req.body.username,
    password = req.body.password,
    email = req.body.email;

  if (username && email && password) {
   // find the user
    User.findOne({
      email: email
    }, function(err, user) {

      // In case of any error, return using the done method
      if (err){
          console.log('Error in SignUp: '+err);
          res.json({ success: false, message: 'Error in SignUp: '+err });
      }
      // already exists
      else if (user) {
          console.log('User already exists with username: '+username);
          return done(null, false, req.flash('message','User Already Exists'));
      } else {
          // if there is no user with that email
          // Check that the username is not taken
          User.findOne({
            username: username
          }, function(err, user) {
            if (err) {
              res.json({ success: false, message: 'Error in SignUp: '+err });
            } else if (user) {
              res.json({ success: false, message: 'Username "'+username+'" already exists'});
            } else {
              // create the user
              var newUser = new User();

              // set the user's local credentials
              newUser.username = username;
              newUser.password = createHash(password);
              newUser.email = email;

              // save the user
              newUser.save(function(err) {
                  if (err){
                      console.log('Error in Saving user: '+err);  
                      res.json({ success: false, message: 'Error in Saving user: '+err });
                  }
                  console.log('User Registration succesful');   
                  res.json({ success: true, message: 'User Registration succesful' });
              });
            }

          })
      }
    });
  } else {
    res.json({ success: false, message: 'Must provide vaid email, username & password' });
  }


});

// route to authenticate a user with email & password, retrieving a jwt token
// (POST http://localhost:8080/authenticate)
apiRoutes.post('/authenticate', function(req, res) {

  if (req.body && req.body.email && req.body.password) {

    // find the user
    User.findOne({
      email: req.body.email
    }, function(err, user) {

      if (err) throw err;

      if (!user) {
        res.json({ success: false, message: 'Authentication failed. User not found.' });
      } else if (user) {

        // check if password matches
        
        if (!bCrypt.compareSync(req.body.password,user.get('password'))) {
          res.json({ success: false, message: 'Authentication failed. Wrong password.' });
        } else {

          var payload = {
            email : user.email,
            username  : user.username
          }

          // if user is found and password is right
          // create a token
          var token = jwt.sign(payload, app.get('superSecret'), {
            expiresIn: "24 hours" // expires in 24 hours
          });

          // return the information including token as JSON
          res.json({
            success: true,
            message: 'Enjoy your token!',
            token: token
          });
        }   

      }

    });

  } else {
    res.json({ success: false, message: 'Must provide email & password to authenticate' });
  }


});

// route middleware to verify a token
apiRoutes.use(function(req, res, next) {

  // check header or url parameters or post parameters for token
  var token = req.body.token || req.query.token || req.headers['x-access-token'];

  // decode token
  if (token) {

    // verifies secret and checks exp
    jwt.verify(token, app.get('superSecret'), function(err, decoded) {      
      if (err) {
        return res.json({ success: false, message: 'Failed to authenticate token.' });    
      } else {
        // if everything is good, save to request for use in other routes
        req.user = decoded;    
        next();
      }
    });

  } else {

    // if there is no token
    // return an error
    return res.status(403).send({ 
        success: false, 
        message: 'No token provided.' 
    });
    
  }
});

// route to show a random message (GET http://localhost:8080/api/)
apiRoutes.get('/', function(req, res) {
  res.json({ message: req.client.username + ' welcome to the coolest API on earth!' });
});

// route to return all users (GET http://localhost:8080/api/users)
apiRoutes.get('/users', function(req, res) {
  User.find({}, function(err, users) {
    res.json(users);
  });
});   


// route to return all users (GET http://localhost:8080/api/users)
apiRoutes.get('/devices/:deviceName', function(req, res) {

  var email = req.user.email;
  var deviceName = req.params.deviceName;
  
  Device.findOne({'email':email, 'deviceName':deviceName}, function(err, device) {
    if (err) {
      res.status(403).send({ 
          success: false, 
          message: 'Error getting device.' 
      });      
    } else if (!device) {
      res.status(404).send({ 
          success: false, 
          message: 'Device not found.' 
      }); 
    } else {
      res.json(device);
    }
    
  });
  
}); 

// route to return all users (GET http://localhost:8080/api/users)
apiRoutes.get('/devices', function(req, res) {
  var email = req.user.email;
  
  Device.find({'email':email}, function(err, devices) {
    res.json(devices);
  });
  
}); 

// route to return all users (GET http://localhost:8080/api/users)
apiRoutes.post('/devices', function(req, res) {
  var email = req.user.email;
  var username = req.user.username;
  var deviceName = req.body.deviceName || req.query.deviceName;

  // find the user
  Device.findOne({
    'email': email,
    'device': deviceName
  }, function(err, device) {

    // In case of any error, return using the done method
    if (err){
        console.log('Error creating device: '+err);
        res.json({ success: false, message: 'Error creating device: '+err });
    }
    // already exists
    if (device) {
        console.log('Device already exists for that email: '+email, deviceName);
        res.json({ success: false, message: 'Device already exists for that email: '+email +' - '+ deviceName});
    } else {
        // if there is no user with that email
        // create the user
        var newDevice = new Device();

        // set the user's local credentials
        newDevice.username = username;
        newDevice.email = email;
        newDevice.deviceName = deviceName;

        // save the user
        newDevice.save(function(err) {
            if (err){
                console.log('Error in Saving device: '+err);  
                res.json({ success: false, message: 'Error in Saving device: '+err });
            }
            console.log('Device creation succesful');   
            res.json({ success: true, message: 'Device creation succesful' });
         });
    }
  });
  
});   

// apply the routes to our application with the prefix /api
app.use('/api', apiRoutes);

// basic route
app.get('/', function(req, res) {
    res.send('Hello! The API is at http://localhost:' + port + '/api');
});

// API ROUTES -------------------
// we'll get to these in a second

// =======================
// start the server ======
// =======================
app.listen(port);
console.log('Magic happens at http://localhost:')
