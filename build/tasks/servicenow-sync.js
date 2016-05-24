// Copyright © 2015 Avanade, Inc.

var gulp = require('gulp');
var fs = require('fs');
var paths = require('../paths');
var file = require('file');
var path = require('path');
var sn = require('../../servicenowconfig');
var auth = require('../../snauth');
var request = require('request');
var Q = require('q');

gulp.task('sn-sync', ['sn-pull', 'dts']);

gulp.task('sn-pull', [], function() {
    return getAllSysMetaFiles();
});

gulp.task('sn-push', ['build'], function() {    
    return pushAllToServiceNow();
});

function pushAllToServiceNow() {
    var promises = [];
    
    var mappings = JSON.parse(fs.readFileSync(sn.mapping, 'utf8'));
    
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

function getAllSysMetaFiles() {
    var uri = sn.uri + '/api/now/table/sys_metadata?sysparm_query=sys_scope=' + sn.application + '^sys_class_nameIN' + Object.keys(sn.types).toString();
            
    return Q.when(getFromServiceNow(uri))
        .then(body => {
            var result = JSON.parse(body).result;
            
            var mappings = {};
            var promises = [];
            result.forEach(function(meta){
                promises.push(getFile(meta.sys_class_name, meta.sys_id, function(savedToPath){
                    mappings[meta.sys_id] = {
                        path: savedToPath,
                        type: meta.sys_class_name
                    };
                }));
            });
            
            return Q.all(promises)
                .then(r => {
                   fs.writeFileSync(sn.mapping, JSON.stringify(mappings,undefined,3)); 
                });
        });
}

function getFile(type, id, pathCallback){
    var uri = sn.uri + '/api/now/table/' + type + '/' + id;
    return Q.when(getFromServiceNow(uri))
        .then(body => {
            var result = JSON.parse(body).result;
            
            var typeInfo = sn.types[type];
            
            var body = result[typeInfo.ts];
            var ext = '.ts';
            if(!body){
                body = result[typeInfo.js];
                ext = '.js';
            }
            
            var path = paths.src;
            
            if(!fs.existsSync(path)){
                fs.mkdirSync(path);
            }
            
            path += type;
            
            if(!fs.existsSync(path)){
                fs.mkdirSync(path);
            }
            
            path += '/' + result.name + ext;
            
            fs.writeFileSync(path, body);
            
            pathCallback(path);
        });
}

function getFromServiceNow(uri){
    return invokeServiceNow(uri, 'GET', undefined);
}

function putToServiceNow(uri, body){
    return invokeServiceNow(uri, 'PUT', body);
};

function checkAuth(){
    if(!auth.user || !auth.password){
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
                'Authorization': 'Basic ' + (new Buffer(auth.user + ':' + auth.password)).toString('base64')
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