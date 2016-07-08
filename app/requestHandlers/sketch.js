'use strict';
/**
 * Definition of CRUD operations for sketches
 * 
 * We assume that 
 * - the request has already authenticades via a JWT token
 * - req.user.username contains a valid user identification 
 */

var Sketch   = require('../models/sketch'); // get our mongoose model

// GET /sketches - Get all sketches
function read(req, res) {
  var username = req.user.username;
  
  Sketch.find({'username':username}, function(err, sketch) {
    res.json(sketch);
  });
  
}; 

// GET /sketches/:id - Get one skecth
function readOne(req, res) {

  var username = req.user.username;
  var id = req.params.id;
  
  Sketch.findOne({'username':username, '_id':id}, function(err, sketch) {
    if (err) {
      res.status(403).send({ 
          success: false, 
          message: 'Error getting the sketch.' 
      });      
    } else if (!sketch) {
      res.status(404).send({ 
          success: false, 
          message: 'Sketch not found.' 
      }); 
    } else {
      res.json(sketch);
    }
  });
}; 



// POST /sketches - Create a new device
function create(req, res) {
  var username = req.user.username;
  var blocks = req.body.blocks;
  var description = req.body.description;
  var title = req.body.title;
  var tags = req.body.tags;

  if (!title) {
    res.json({ success: false, message: 'Must provide a title'});
  } else {
    // Check if the code title already exist
    Sketch.findOne({
      'username': username,
      'title': title
    }, function(err, sketch) {

      if (err){
          res.json({ success: false, message: 'Error creating code sketch: '+err });
      }
      // already exists
      if (sketch) {
          res.json({ success: false, message: 'Code title already exists for that username: '+username +' - '+ title, sketch:sketch});
      } else {
          // if there is no code with that email
          // create the code
          var newSketch = new Sketch();

          // set the user's local credentials
          newSketch.title = title;
          newSketch.blocks = blocks;
          newSketch.username = username;
          newSketch.description = description;
          newSketch.tags = tags;

          // save the user
          newSketch.save(function(err) {
              if (err){
                  console.log('Error in Saving code: '+err);  
                  res.json({ success: false, message: 'Error in Saving device: '+err });
              }
              res.json({ success: true, message: 'Code succefully saved', sketch: newSketch});
          });
      }
    });
  }
  
};   

// PUT /sketch/:title - update sketch
function update(req, res) {
  // Identify the sketch by the username (from the token) and the title
  var username = req.user.username;
  var id = req.params.id;

  var title = req.body.title;
  var blocks = req.body.blocks;
  var description = req.body.description;
  var tags = req.body.tags;

  var dataToSet={};
  if (blocks) dataToSet['blocks']= blocks;
  if (description) dataToSet['description']= description;
  if (tags) dataToSet['tags']= tags;
  if (title) dataToSet['title']= title;

  // Check if the code title already exist
  Sketch.update({
    'username': username,
    '_id': id
  },
  {
    $set : dataToSet
  },
  function(err) {
    if (err) {
      res.json({ success: false, message: 'Error :'+err});
    } else {
      res.json({ success: true, message: 'Sketch update successful'});
    }
  });
  
}; 

// DELETE /sketches/:title - delete sketch
function remove(req, res) {
  // Identify the sketch by the username (from the token) and the title
  var username = req.user.username;
  var id = req.params.id;

  // Check if the code title already exist
  Sketch.remove({
    'username': username,
    '_id': id
  }, function(err) {

    if (err){
        res.json({ success: false, message: 'Error deleting sketch: '+err });
    }  else {
        res.json({ success: true, message: 'Sketch succefully deleted' });
    }

  });
  
};   

// set up a mongoose model and pass it using module.exports
module.exports = {
    "read": read, 
    "readOne": readOne,
    "create": create,
    "update": update,
    "delete": remove  // delete is not allowed for function name in strict mode
};