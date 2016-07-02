// get an instance of mongoose and mongoose.Schema
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// set up a mongoose model and pass it using module.exports
module.exports = mongoose.model('pin', new Schema({ 
    username: String, 
    deviceName: String,
    pinId:String,
    updated: { type: Date, default: Date.now },
    value:Number
}));