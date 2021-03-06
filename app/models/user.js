// get an instance of mongoose and mongoose.Schema
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// set up a mongoose model and pass it using module.exports
module.exports = mongoose.model('User', new Schema({ 
    username: String, 
    email: String, 
    password: String, 
    admin: { type: Boolean, default: false },
    validated: { type: Boolean, default: false },
    created: { type: Date, default: Date.now },
    refreshToken:String
}));