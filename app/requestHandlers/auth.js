'use strict';
/**
 * Definition of CRUD operations for devices
 * 
 */
var bCrypt = require('bcrypt-nodejs');
var crypto = require('crypto');
var _ = require("underscore");
var jwt    = require('jsonwebtoken'); // used to create, sign, and verify tokens
var config = require('../../config'); // get our config file

var jwtSecret = process.env.JWT_SECRET || config.secret;

var User   = require('../models/user'); // get our mongoose model

// Generates hash using bCrypt
var createHash = function(password){
    return bCrypt.hashSync(password, bCrypt.genSaltSync(10), null);
}

// Generates a random refresh token (with the username as first part)
function generateRefreshToken(username) {  
    var refreshToken = username + '.' + crypto.randomBytes(40).toString('hex');
    return refreshToken;
}

// POST /signup - registers a new user
// Requires username, password & email as data params
function signup(req, res) {
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
          res.json({ success: false, message: 'There is already a user with this email'});
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
};

// POST /signin - authenticates an existing user, obtaining access & refresh tokens
// Requires password & email as data params
function signin(req, res) {

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
          var token = jwt.sign(payload, jwtSecret, {
            expiresIn: "1 hour" // expires in 1 hour
          });

          var decoded = jwt.decode(token);
          var token_expiration = new Date(decoded.exp*1000);

          if (!user.refreshToken) {
            var refreshToken = generateRefreshToken(user.username);
            User.update({
                "email": user.email
              },
              {
                $set : {"refreshToken":refreshToken}
              },
              function(err) {
                if (err) {
                  res.json({ success: false, message: 'Could not save refresh token' });
                } else {
                  // return the information including token as JSON
                  res.json({
                    success: true,
                    username: user.username,
                    message: 'Enjoy your token!',
                    access_token: token,
                    access_token_expiration: token_expiration,
                    refresh_token : refreshToken
                  });
                }
              }
            )
          } else {
              res.json({
                success: true,
                username : user.username,
                message: 'Enjoy your token!',
                access_token: token,
                access_token_expiration: token_expiration,
                refresh_token : user.refreshToken
              });
          }

        }   

      }

    });

  } else {
    res.json({ success: false, message: 'Must provide email & password to authenticate' });
  }
};

// POST /revoke - revokes current refresh token
// Requires refresh_token in query param
function token_revoke(req, res) {
  var refresh_token = req.query.refresh_token || null;

  var username = refresh_token.split(".")[0]; 

  User.update({
    "username" : username,
    "refreshToken" : refresh_token
  },
  {
    $unset : {refreshToken: 1}
  },
  function(err) {
    if (err) {
      res.json({ success: false, message: 'Error revoking the token'});
    } else {
      res.json({ success: true, message: 'Refresh token revoked'})
    }
    
  })
  
};

// generate a new access token given a valid refresh token
// POST /token - generates a new access_token
// Requires a valid request_token query param
function token(req, res) {
  var refresh_token = req.query.refresh_token || null;

  var username = refresh_token ? refresh_token.split(".")[0] : null; 

  if (username && refresh_token) {
    User.findOne({
      "username" : username,
      "refreshToken" : refresh_token
    }, function(err, user) {
      if (err) {
        res.json({ success: false, message: 'Error obtaining access token'});
      } else if (!user) {
        res.json({ success: false, message: 'Error: refresh token is not valid'});
      } else {
        var payload = {
          email : user.email,
          username  : user.username
        }

        // if user is found and password is right
        // create a token
        var token = jwt.sign(payload, jwtSecret, {
          expiresIn: "1 hour" // expires in 1 hour
        });

        var decoded = jwt.decode(token);
        var token_expiration = new Date(decoded.exp*1000);

        res.json({
          success: true,
          message: 'Enjoy your token!',
          access_token: token,
          access_token_expiration: token_expiration
        });
      }
    })
  } else {
    res.json({ success: false, message: 'Operation not allowed'});
  }
};

// token_validator
// Middelware function that checks if a given token is valid

function token_validator(req, res, next) {

  // check header or url parameters or post parameters for token
  //var token = req.body.token || req.query.token || req.headers['x-access-token'];
  var token = req.token ;

  // decode token
  if (token) {

    // verifies secret and checks exp
    jwt.verify(token, jwtSecret, function(err, decoded) {      
      if (err) {
        return res.json({ success: false, message: 'Failed to authenticate token.' });    
      } else {
        // if everything is good, save to request for use in other routes
        // we store the decoded payload in req.user (expected to have username & gmail)
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
};

// set up a mongoose model and pass it using module.exports
module.exports = {
    "signup": signup, 
    "signin": signin,
    "token": token,
    "token_revoke": token_revoke,   
    "token_validator":  token_validator
};