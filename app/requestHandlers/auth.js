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
var nodemailer = require('nodemailer');
var sesTransport = require('nodemailer-ses-transport');

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

/**
 * POST /signup - registers a new user
 * Requires username, password & email as data params
 * 
 * ERROR_SIGNUP
 * ERROR_SIGNUP_EMAIL_EXISTS
 * ERROR_SIGNUP_USERNAME_EXISTS
 * ERROR_SIGNUP_USER_VALIDATION_FAILED
 * ERROR_SIGNUP_USER_SAVE_ERROR
 * ERROR_SIGNUP_LACK_EMAIL_USERNAME_PASSWORD
 * ERROR_SIGNUP_FAILED_ACTIVATION_EMAIL
 */
function signup(req, res) {
  var username = req.body.username,
    password = req.body.password,
    email = req.body.email;

  var lang = req.query.lang ? req.query.lang : "en";

  if (username && email && password) {
   // find the user
    User.findOne({
      email: email
    }, function(err, user) {

      // In case of any error, return using the done method
      if (err){
          console.log('Error in SignUp: '+err);
          res.json({ success: false, message: 'Error in SignUp: '+err , message_code:'ERROR_SIGNUP'});
      }
      // already exists
      else if (user) {
          console.log('User already exists with username: '+username);
          res.json({ success: false, message: 'There is already a user with this email',  message_code:'ERROR_SIGNUP_EMAIL_EXISTS'});
      } else {
          // if there is no user with that email
          // Check that the username is not taken
          User.findOne({
            username: username
          }, function(err, user) {
            if (err) {
              res.json({ success: false, message: 'Error in SignUp: '+err , message_code:'ERROR_SIGNUP_USER_VALIDATION_FAILED'});
            } else if (user) {
              res.json({ success: false, message: 'Username "'+username+'" already exists', message_code:'ERROR_SIGNUP_USERNAME_EXISTS'});
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
                      res.json({ success: false, message: 'Error in Saving user: '+err , message_code:'ERROR_SIGNUP_USER_SAVE_ERROR'});
                  }
                  console.log('User Registration succesful');   
                  sendActivationEmail(newUser.email, lang, function(err, info) {
                    if (err) {
                      res.json({ success: false, message: 'Failed to send authentication email' , message_code:'ERROR_SIGNUP_FAILED_ACTIVATION_EMAIL'});
                    } else {
                      res.json({ success: true, message: 'Succesful user registration' });
                    }

                  })
              });
            }

          })
      }
    });
  } else {
    res.json({ success: false, message: 'Must provide vaid email, username & password', message_code:'ERROR_SIGNUP_LACK_EMAIL_USERNAME_PASSWORD' });
  }
};

/**
 * Sends an email to a new registerd user
 * Includes a link to validate the account
 */
function sendActivationEmail(email, lang, callback) {

  var accessKey = process.env.AWS_ACCESS_KEY;
  var secretKey = process.env.AWS_SECRET_KEY;

  // create a "validation" jwt token
  var payload = {
    email : email,
    validationRequest: true
  }

  var token = jwt.sign(payload, jwtSecret, {
    expiresIn: "1 month" // expires in 1 month
  });

  var transport = nodemailer.createTransport(sesTransport({
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
      rateLimit: 5 // do not send more than 5 messages in a second
  }));

  var mailOptionsByLanguage = {
    'en' : {
      from: 'no_reply@firstmakers.com', // sender address
      to: email, // list of receivers
      subject: 'Firstmakers account activation', // Subject line
      html: 'Welcome to Firstmakers!<p><p>' +
        'To activate your new account, please follow  <a href="https://firstmakers.s3.amazonaws.com/accountactivation/index.html#/activate?lang=en&token='+ token +'">this link</a> which will be valid for 1 month.\n',
    },
    'es' : {
      from: 'no_reply@firstmakers.com', // sender address
      to: email, // list of receivers
      subject: 'Firstmakers account activation', // Subject line
      html: '¡Bienvenido a Firstmakers!<p><p>' +
        'Para activar su nueva cuenta, por favor ir a,  <a href="https://firstmakers.s3.amazonaws.com/accountactivation/index.html#/activate?lang=en&token='+ token +'">este enlace</a> que será válido por un mes.\n',
    }
  }

  var defaultLang = 'en';
  var mailOptions = mailOptionsByLanguage[lang] ? mailOptionsByLanguage[lang] : mailOptionsByLanguage[defaultLang];

  // send mail with defined transport object
  transport.sendMail(mailOptions, function(error, info){
    callback(error, info);
  });

}


      res.json({ success: true, message: 'Message sent to '+email, message_code:'MESSAGE_SENT', 'email':email});



// POST /signin - authenticates an existing user, obtaining access & refresh tokens
// Requires password & email as data params
// Error codes in messages:
// ERROR_SIGNIN_INVALID_EMAIL
// ERROR_SIGNIN_INVALID_PASSWORD
// ERROR_SIGNIN_SAVE_TOKEN
// ERROR_SIGNIN_NO_EMAIL_PASSWORD
//
function signin(req, res) {

  if (req.body && req.body.email && req.body.password) {

    // find the user
    User.findOne({
      email: req.body.email
    }, function(err, user) {

      if (err) throw err;

      if (!user) {
        res.json({ success: false, message: 'Authentication failed. User not found.' , message_code:'ERROR_SIGNIN_INVALID_EMAIL'});
      } else if (user) {

        // check if password matches
        
        if (!bCrypt.compareSync(req.body.password,user.get('password'))) {
          res.json({ success: false, message: 'Authentication failed. Wrong password.', message_code:'ERROR_SIGNIN_INVALID_PASSWORD' });
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
                  res.json({ success: false, message: 'Could not save refresh token', message_code:'ERROR_SIGNIN_SAVE_TOKEN' });
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
    res.json({ success: false, message: 'Must provide email & password to authenticate', message_code:'ERROR_SIGNIN_NO_EMAIL_PASSWORD' });
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

// sends an email with a "password reset key" to the specified user account
// POST /forgotpassword - initiates password reset process
// Requires a valid email
function forgotpassword(req, res) {
  var email = req.body.email;

  var lang = req.query.lang ? req.query.lang : "en";

  if (email) {
    // Check if the email is from a valid user
    User.findOne({
      "email" : email,
    }, function(err, user) {
      if (err) {
        res.json({ success: false, message: 'Error cheking for user', message_code:'ERROR_FORGOT_PASSWORD_CHECKING'});
      } else if (!user) {
        res.json({ success: false, message: 'Error,  not a valid user', message_code:'ERROR_FORGOT_PASSWORD_NON_USER'});
      } else {
        // Send email with password recovery instructions
        var accessKey = process.env.AWS_ACCESS_KEY;
        var secretKey = process.env.AWS_SECRET_KEY;

        // create a "password reset" jwt token
        var payload = {
          email : email,
          resetpassword: true
        }

        var token = jwt.sign(payload, jwtSecret, {
          expiresIn: "1 hour" // expires in 1 hour
        });

        var transport = nodemailer.createTransport(sesTransport({
            accessKeyId: accessKey,
            secretAccessKey: secretKey,
            rateLimit: 5 // do not send more than 5 messages in a second
        }));

        var mailOptionsByLanguage = {
          'en' : {
            from: 'no_reply@firstmakers.com', // sender address
            to: email, // list of receivers
            subject: 'Firstmakers password reset', // Subject line
            html: 'You are receiving this email because you (or someone else) have requested the reset of the password for your firstmakers account.<p><p>' +
              'If you did not request this, please ignore this email and your password will remain unchanged.<p><p>'+
              'To change your password, please follow <a href="https://firstmakers.s3.amazonaws.com/passwordreset/index.html#/resetpassword?lang=en&token='+ token +'">this link</a> which will be valid for 1 hour.\n',
          },
          'es' : {
            from: 'no_reply@firstmakers.com', // sender address
            to: email, // list of receivers
            subject: 'Cambio de contraseña en Firstmakers', // Subject line
            html: 'Está recibiendo este correo electrónico porque Ud. (u otra persona) solicitó un cambio de contraseña en su cuenta de Firstmakers.<p><p>' +
              'Si usted no lo solicitó, por favor ignore este mensaje y su contraseña no será modificada.<p><p>'+
              'Para cambiar su contraseña, haga clic en  <a href="https://firstmakers.s3.amazonaws.com/passwordreset/index.html#/resetpassword?lang=es&token='+ token +'">este enlace</a> (válido por 1 hora).\n',
          }
        }

        var defaultLang = 'en';
        var mailOptions = mailOptionsByLanguage[lang] ? mailOptionsByLanguage[lang] : mailOptionsByLanguage[defaultLang];

        // send mail with defined transport object
        transport.sendMail(mailOptions, function(error, info){
            if(error){
                res.send(error);
                return console.log(error);
            }
            res.json({ success: true, message: 'Message sent to '+email, message_code:'MESSAGE_SENT', 'email':email});
        });
      }
    })

  } else {
      res.json({ success: false, message: 'No usermail provided', message_code:'ERROR_FORGOT_PASSWORD_NO_EMAIL'});
  }

};

// POST /resetpassword - resets a password given a valid password reset token
// Requires a valid email, password & reset_token
function resetpassword(req, res) {
  var password = req.body.password;
  var reset_token = req.body.reset_token;

  if (password && reset_token) {

    // verifies secret and checks exp
    jwt.verify(reset_token, jwtSecret, function(err, decoded) {      
      if (err) {
        return res.json({ success: false, message: 'Failed to authenticate token.', message_code:'TOKEN_VALIDATION_FAILED' });    
      } else {
        if (decoded && decoded.resetpassword) {
          var email = decoded.email;
          var encryptedPassword = createHash(password);

          User.update({
              "email": email
            },
            {
              $set : {"password":encryptedPassword}
            },
            function(err) {
              if (err) {
                res.json({ success: false, message: 'Could not change the password', message_code:'PASSWORD_UPDATE_FAILED' });
              } else {
                // return the information including token as JSON
                res.json({
                  success: true,
                  message: "Password changed",
                  message_code:"PASSWORD_CHANGED"
                });
              }
            })
        } else {
          res.json({ success: flase, message: 'Not a reset password token', message_code:'INVALID_TOKEN'});
        }
        
      }
    });
  } else {
      res.json({ success: false, message: 'Must provide password & reset token', message_code:'MISSING_PASSWORD_OR_TOKEN'});
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
    "forgotpassword": forgotpassword,
    "resetpassword" : resetpassword,
    "token_revoke": token_revoke,   
    "token_validator":  token_validator
};