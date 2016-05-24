// Copyright © 2015 Avanade, Inc.

var gulp = require("gulp");
var fs = require('fs');
var file = require('file');
var path = require('path');
var request = require('request');
var paths = require('../paths');
var sn = require('../servicenow');
var Q = require("q");

gulp.task('dts', [], function () {
    var types = sn.dts.types;
    
    var promises = [];
    for(var i=0; i < types.length; i++){
        promises.push(get(sn.uri + '/api/11527/dtsgenerator/' + types[i]));
    }
    
    var prom = Q
        .all(promises)
        .then(results => {
            var merged = {};
            for(var i=0; i < results.length; i++){
                var types = results[i];
                for(var key in types){
                    merged[key] = types[key];
                }
            }
            return merged;
        })
        .then(result => {
            writeDTS('typings/servicenow.d.ts', result);
        })
        .catch(err => {
            console.error(err);
        });
    
    return prom;
});

function writeDTS(target, definitions){
    var dts = '';
    for(var i=0; i < sn.dts.refs.length; i++){
        dts += '///<reference path="' + sn.dts.refs[i] + '" />\r\n';
    }
    
    dts += 'declare module sn {\r\n' +
          '\texport module Server {\r\n' +
          '\t\texport interface IGlideServerRecord {\r\n';
    
    for(var t in definitions){
        dts += '\t\t\tnew (type: "' + t + '"): Types.I' + t + ';\r\n';
    }
        
    dts += '\t\t}\r\n';
    dts += '\t}\r\n';
    dts += '\texport module Types {\r\n';
    
    for(var type in definitions){
        var def = definitions[type];
        
        dts += '\t\texport interface I' + type;
        if(def.superclass){
            dts += ' extends I' + def.superclass;
        }
        else{
            dts += ' extends Server.IGlideServerRecord';
        }
        dts += ' {\r\n';
        
        for(var fieldname in def.fields){
            var fielddef = def.fields[fieldname];
                        
            if(sn.dts.ignoreFields.indexOf(fieldname) == -1 && 
               !def.superclass || 
               (definitions.hasOwnProperty(def.superclass) && !definitions[def.superclass].fields.hasOwnProperty(fieldname)))
            {            
                var type = fielddef.type;
                if(type.match(/IGlide/g)){
                    type = 'sn.Server.' + type;
                }
                
                dts += '\t\t\t' + fieldname + ': ' + type;
                
                if(fielddef.reference && definitions.hasOwnProperty(fielddef.reference)){
                    dts += '|I' + fielddef.reference;
                }
                
                dts += '|sn.Server.IGlideElement;\r\n';
            }
        }
        
        dts += '\t\t}\r\n';
    }
    
    dts += '\t}\r\n}';
    
    fs.writeFileSync(target, dts);
    console.log('DTS saved to: ' + target);
}

function get(uri) {
    var defer = Q.defer();
    request(
        {
            url: uri,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            }
        },
        function (err, response, body) {
            if (!err && response.statusCode == 200) {
                defer.resolve(JSON.parse(body).result);
            }
            else if(err){
                defer.reject(err);
            }
        });
        
    return defer.promise;
};