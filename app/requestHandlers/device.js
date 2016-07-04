'use strict';
/**
 * Definition of CRUD operations for devices
 * 
 * We assume that 
 * - the request has already authenticades via a JWT token
 * - req.user.username contains a valid user identification 
 */
var _ = require("underscore");
var Device   = require('../models/device'); // get our mongoose model

// GET /devices - Get all devices
function read(req, res) {
  var username = req.user.username;
  
  Device.find({'username':username}, function(err, device) {
    res.json(device);
  });
  
}; 

// GET /devices/:deviceName - Get one skecth
function readOne(req, res) {

  var username = req.user.username;
  var deviceName = req.params.deviceName;
  
  Device.findOne({'username':username, 'deviceName':deviceName}, function(err, device) {
    if (err) {
      res.status(403).send({ 
          success: false, 
          message: 'Error getting the device.' 
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
}; 


// POST /devices - Create a new device
function create(req, res) {
  var username = req.user.username;
  var deviceName = req.body.deviceName;
  var pins = req.body.pins;

  if (!deviceName) {
    res.json({ success: false, message: 'Must provide a deviceName'});
  } else {
    // Check if the code title already exist
    Device.findOne({
      'username': username,
      'deviceName': deviceName
    }, function(err, device) {

      if (err){
          res.json({ success: false, message: 'Error creating device: '+err });
      }
      // already exists
      if (device) {
          res.json({ success: false, message: 'Device already exists for that username: '+username +' - '+ deviceName});
      } else {
          // if there is no code with that email
          // create the device
          var newDevice = new Device();

          newDevice.username = username;
          newDevice.deviceName = deviceName;
          newDevice.updated = new Date();
          if (_.isObject(pins)) {
            newDevice.pins = pins;
          } else {
            newDevice.pins = {};
          }

          // save the device
          newDevice.save(function(err) {
              if (err){
                  console.log('Error in Saving device: '+err);  
                  res.json({ success: false, message: 'Error in Saving device: '+err });
              }
              res.json({ success: true, message: 'Device succefully saved' });
          });
      }
    });
  }
  
};   


// PUT /device/:deviceName - update device
function update(req, res) {
  // Identify the device by the username (from the token) and the deviceName
  var username = req.user.username;
  var deviceName = req.params.deviceName;

  var pins = req.body.pins;

  var dataToSet={};

  if (_.isObject(pins)) {
    _.each(pins, function(value,pin) {
      dataToSet['pins.'+pin]= value;
    })
  }
  dataToSet['updated']= new Date();

  // Check if the code deviceName already exist
  Device.update({
    'username': username,
    'deviceName': deviceName
  },
  {
    $set : dataToSet
  },
  function(err) {
    if (err) {
      res.json({ success: false, message: 'Error :'+err});
    } else {
      res.json({ success: true, message: 'Device update successful'});
    }
  });
  
}; 

// DELETE /devices/:deviceName - delete device
function remove(req, res) {
  // Identify the device by the username (from the token) and the deviceName
  var username = req.user.username;
  var deviceName = req.params.deviceName;

  if (!deviceName) {
    res.json({ success: false, message: 'Must provide a deviceName'});
  } else {
    // Check if the code deviceName already exist
    Device.remove({
      'username': username,
      'deviceName': deviceName
    }, function(err) {

      if (err){
          res.json({ success: false, message: 'Error deleting code device: '+err });
      }  else {
         res.json({ success: true, message: 'Code succefully deleted' });
      }

    });
  }
  
};  


// GET /devices/:deviceName/pins - Get one skecth
function pins_read(req, res) {

  var username = req.user.username;
  var deviceName = req.params.deviceName;
  
  Device.findOne({'username':username, 'deviceName':deviceName}, function(err, device) {
    if (err) {
      res.status(403).send({ 
          success: false, 
          message: 'Error getting the device.' 
      });      
    } else if (!device) {
      res.status(404).send({ 
          success: false, 
          message: 'Device not found.' 
      }); 
    } else {
      res.json(device.pins);
    }
  });
}; 

// PUT /devices/:deviceName/pins/:pin - Update a pins value
// If device does not exist, it will be created - upsert
function pins_update(req, res) {

  var username = req.user.username;
  var deviceName = req.params.deviceName;
  var pin = req.params.pin;
  var value = req.body.value;
  
  var dataToSet={};

  dataToSet['pins.'+pin]=value 
  dataToSet['updated']= new Date();

  // Check if the code deviceName already exist
  Device.findOneAndUpdate({
    'username': username,
    'deviceName': deviceName
  },
  {
    $set : dataToSet
  },
  {upsert:true},
  function(err) {
    if (err) {
      res.json({ success: false, message: 'Error :'+err});
    } else {
      res.json({ success: true, message: 'Device update successful'});
    }
  });
}; 

// DELETE /devices/:deviceName/pins/:pin - Delete a pin
function pins_delete(req, res) {

  var username = req.user.username;
  var deviceName = req.params.deviceName;
  var pin = req.params.pin;
  
  var dataToUnSet={};

  dataToUnSet['pins.'+pin]=1 

  // Check if the code deviceName already exist
  Device.update({
    'username': username,
    'deviceName': deviceName
  },
  {
    $unset : dataToUnSet
  },
  function(err) {
    if (err) {
      res.json({ success: false, message: 'Error :'+err});
    } else {
      res.json({ success: true, message: 'Pine deleted successfully'});
    }
  });
}; 

// GET active devices - Get all devices with updated data during last day (or the specified number of minutes)
function devices_active_read(req, res) {
  var window_minutes = req.query.minutes ? req.query.minutes : 60*24;  // Default window size is 24 hours
  var yesterday =  new Date( (new Date)*1 - 1000*60*window_minutes );  // Yesterday = today - 24 hours in milliseconds

  Device.find({"updated" : {$gte: yesterday }}, function(err, devices) {
    res.json(devices);
  });
}; 

// set up a mongoose model and pass it using module.exports
module.exports = {
    "read": read, 
    "readOne": readOne,
    "create": create,
    "update": update,
    "delete": remove,  // delete is not allowed for function name in strict mode
    "pins_read" :pins_read,
    "pins_update" :pins_update,
    "pins_delete": pins_delete,
    "devices_active_read" : devices_active_read
};