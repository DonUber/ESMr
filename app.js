// More efficiency
// Dashboard
// Mailing / Notification
// Jade oid dynamic HTML?

// *** INIT ***

// Load all required modules
var http = require('http');
var fs = require('fs');
var formidable = require("formidable");
var util = require('util');
var monk = require('monk');
var moment = require('moment');
var express = require('express');
var doT = require('express-dot');
var bodyParser = require('body-parser');

// Configuration of express.js
var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// Use doT.js as template engine
app.set('view engine', 'dot');
app.set('views', __dirname+'/front');
app.set('view options', {layout: false});
app.engine('html', doT.__express);

// Load necessary folders en JSON files
app.use('/bootstrap',express.static(__dirname+'/front/bootstrap'));
var fieldscol = require('./fields.json');
var global_fields;


// Database connection
var db = monk('localhost:27017/esm');
var collection = db.get('esmcol')


// *** ROUTING & INPUT HANDLING ***

// Confirmation page
app.post('/confirm', function(req, res){
    var form = new formidable.IncomingForm();
    form.parse(req, function (err, fields_reg, files) {
        // Merge data from registration fields with ESM field data
        for(var rfield in fieldscol.register_fields){
            global_fields[rfield] = fields_reg[rfield];
        }
        // Store in database
        collection.insert(global_fields, function (err, doc) {
            if (err) {
                console.log('[ERROR] '+err.message)
            } else {
                console.log('[INFO] Data stored for ID: '+global_fields['_id']);
                //console.log(util.inspect(global_fields));
            }
        });
        res.render('confirm.html', null);
    });
});

// API return JSON with data for a certain ID
app.get('/data/:id', function(req, res){
    console.log("[INFO] Data request for ID:"+req.params.id);
    collection.findOne({_id: parseInt(req.params.id)}, function (err, docs) {
        console.log("[INFO] ID available in database");
        console.log("[INFO] Responding with: "+JSON.stringify(docs));
        // Response with JSON data
        res.writeHead(200, {
            'Content-Type': 'application/json'
        });
        res.end(JSON.stringify(docs));
    });
});

/*app.get('/vis', function(req, res){
 res.render('vis.html', {"uid" : req.params.id});
 });

 app.get('/data/:id/:field', function(req, res){
 console.log("id:"+req.params.id);
 console.log("field:"+req.params.field);
 collection.findOne({_id: parseInt(req.params.id)}, function (err, docs) {
 console.log("Result!");
 console.log(util.inspect(docs));
 res.writeHead(200, {
 'Content-Type': 'text/html',
 });
 res.end(docs[req.params.field]);
 });
 });*/

// Main ESM questionnaire page
app.get('/', function(req, res){
    res.render('index.html', fieldscol);
});

// Receive POST data from ESM page
app.post('/e', function(req, res) {
    // Fetch data from form
    var form = new formidable.IncomingForm();
    form.parse(req, function (err, fields, files) {
        var now = moment();
        var id = parseInt(fields.uid);
        // See if ID already exists in database
        collection.findOne({_id: id}, function (err, docs) {
            if (docs) {
                var update_fields = {_id: id};
                for(var field in fieldscol.fields) {
                    console.log('ID '+ id + 'exists in database');
                    //console.log(util.inspect(docs));
                    // If the field has multiple measure points, merge new point with old points
                    if (fieldscol.fields[field].newpoint == 1) {
                        var new_docs = [];
                        new_docs = docs[field];
                        new_docs.push(fields[field]);
                        update_fields[field] = new_docs;
                    }
                }

                // Merge register field data
                for(var field in fieldscol.register_fields) {
                    update_fields[field] = docs[field];
                }

                // Add timestamp data
                var new_docs = [];
                new_docs = docs['hour'];
                new_docs.push(now.hour());
                update_fields['hour'] = new_docs;
                new_docs = docs['day'];
                new_docs.push(now.day());
                update_fields['day'] = new_docs;
                new_docs = docs['week'];
                new_docs.push(now.week());
                update_fields['week'] = new_docs;

                // Update database entry
                console.log("[INFO] Updating:"+util.inspect(update_fields));
                collection.update(
                    {_id: id},update_fields,
                    {upsert: true}
                );

                // Redirect to confirmation page
                res.render('confirm.html', null);
            }else{
                // If ID does not yet exist in database, redirect to register page
                for(field in fields){
                    fields[field] = [fields[field]];
                }
                fields['_id'] = id;
                fields['hour'] = [now.hour()];
                fields['day'] = [now.day()];
                fields['week'] = [now.week()];
                global_fields = fields;
                res.render('register.html', fieldscol);
            }});
    });
});

app.listen(1185);
console.log("[INFO] Server listening on port 1185");

