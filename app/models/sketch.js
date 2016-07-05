// get an instance of mongoose and mongoose.Schema
var mongoose = require('mongoose');
var Schema = mongoose.Schema;



var mySchema = new Schema({ 
    username: String, 
    title: String,
    description: String,
    blocks: String,
    tags: []
})

// Duplicate the ID field.
mySchema.virtual('id').get(function(){
    return this._id.toHexString();
});

// Ensure virtual fields are serialised.
mySchema.set('toJSON', {
    virtuals: true
});

// set up a mongoose model and pass it using module.exports
module.exports = mongoose.model('Sketch', mySchema);

