// get an instance of mongoose and mongoose.Schema
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// set up a mongoose model and pass it using module.exports
module.exports = mongoose.model('Sketch', new Schema({ 
    username: String, 
    title: String,
    description: String,
    blocks: String,
    tags: []
}));