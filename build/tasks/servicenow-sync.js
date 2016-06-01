// Copyright © 2015 Avanade, Inc.

var gulp = require('gulp');
var fs = require('fs');
var paths = require('../paths');
var file = require('file');
var path = require('path');
var sn = require('../../servicenowconfig');
var request = require('request');
var Q = require('q');
var sequence = require('run-sequence')

gulp.task('sync', function(){
    sequence('pull', 'dts');
});

gulp.task('pull', [], function() {
    return getAllApplicationTypes();
});

gulp.task('push', ['build'], function() {    
    return pushAllToServiceNow();
});

function pushAllToServiceNow() {
    var promises = [];
    
    var mappings = JSON.parse(fs.readFileSync(sn.mapping, 'utf8'));
    
    mappings.forEach(item => {
        
    })
    
    
    Object.keys(mappings).forEach(id => {
        var mapping = mappings[id];
        var file = mapping.path;  
        var ext = path.extname(file);
                      
        if(!fs.existsSync(file)){
            if(ext == '.js'){
                file = file.substring(0, file.length - ext.length) + '.ts';
                ext = '.ts';
                if(!fs.existsSync(file)){
                    throw 'Unable to find mapping with either .js or .ts extension: ' + file;
                }   
            }
        }
                
        var body = {};
        
        switch(ext){
            case '.ts':
                var distPath = file.replace(paths.src, paths.dist);
                distPath = distPath.substring(0, distPath.length - ext.length) + '.js';
                body[sn.types[mapping.type].js] = fs.readFileSync(distPath, 'utf8');
                body[sn.types[mapping.type].ts] = fs.readFileSync(file, 'utf8');
                break;
            case '.js':
                body[sn.types[mapping.type].js] = fs.readFileSync(distPath, 'utf8');
                break;
            default:
                throw 'Unknown file type ' + ext;
        }
        
        var uri = sn.uri + '/api/now/table/' + mapping.type + '/' + id;
        console.info('Uploading ' + id + ' to ' + uri);

        var json = JSON.stringify(body);
        
        promises.push(putToServiceNow(uri, json));
    });
        
    return Q.all(promises);
}

function getAllApplicationTypes() {  
    var mappings = [];
    var promises = [];
     
    Object.keys(sn.types).forEach(type => {        
        var uri = sn.uri + sn.dev_integration_endpoint + 'application/' + sn.application + '/' + type;
        
        promises.push(Q.when(getFromServiceNow(uri))
            .then(body => {
                var result = JSON.parse(body).result;
                result.forEach(item => {
                    var p = writeFile(item);
                    mappings.push({
                        id: item.id,
                        type: item.table,
                        etag: item.etag,
                        path: p
                    });
                })
            })
        );
    });
    
    return Q.all(promises)
        .then(item => {
            fs.writeFileSync(sn.mapping, JSON.stringify(mappings, undefined, 3));
        });   
}

function writeFile(appDataItem){
    var typeInfo = sn.types[appDataItem.table];
    
    var body = appDataItem.fields[typeInfo.ts];
    var ext = '.ts';
    
    if(!body){
        body = appDataItem.fields[typeInfo.js];
        ext = '.js';
    }
    
    var p = paths.src;
    if(!fs.existsSync(p)){
        fs.mkdirSync(p);
    }
    p = path.join(p, appDataItem.table);
    
    if(!fs.existsSync(p)){
        fs.mkdirSync(p);
    }
    
    p = path.join(p, (appDataItem.name + ext));
    fs.writeFileSync(p, body);
    
    return p;
}

function getFromServiceNow(uri){
    return invokeServiceNow(uri, 'GET', undefined);
}

function putToServiceNow(uri, body){
    return invokeServiceNow(uri, 'PUT', body);
};

function checkAuth(){
    if(!sn.auth.user || !sn.auth.password){
        throw 'Authentication to ServiceNow is not set for your environment!  Configure snauth.js with your usersname and password';
    }
}

function invokeServiceNow(uri, method, body, user, password){
    checkAuth();
    
    var defer = Q.defer();
    request(
        {
            url: uri,
            method: method,
            body: body,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': 'Basic ' + (new Buffer(sn.auth.user + ':' + sn.auth.password)).toString('base64')
            }
        },
        function(err, response, body){
            if(!err && response.statusCode != 200){
                defer.reject('FETCH ERROR: ' + response.statusCode + ' :: ' + body);
            }
            else if(err){
                defer.reject(err);                
            }
            else{
                defer.resolve(body);
            }
        });
        
   return defer.promise;
}
