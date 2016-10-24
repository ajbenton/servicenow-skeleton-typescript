var fs = require('fs');

if(fs.existsSync('.env')){
    require('dotenv').config()
}

var gulp = require('gulp');
var fs = require('fs');
var paths = require('../paths');
var path = require('path');
var sn = require(path.join(process.cwd(), 'servicenowconfig'));
var request = require('request');
var Q = require('q');
var sequence = require('run-sequence');

gulp.task('sync', function () {
    sequence('pull', 'dts');
});

gulp.task('pull', [], function () {
    return pullAllFromServiceNow();
});

gulp.task('push', ['build'], function () {
    return pushAllToServiceNow();
});

function pushAllToServiceNow() {
    if (!checkUserSettings()) {
        return;
    }

    var upload = {};

    var mappings = JSON.parse(fs.readFileSync(sn.mapping, 'utf8'));

    Object.keys(mappings).forEach(id => {
        var item = mappings[id];

        if(!item || !item.fields){
            return;
        }
        
        var b = {
            id: id,
            etag: item.etag,
            table: item.type,
            fields: {}
        };

        Object.keys(item.fields).forEach(key => {
            var filePath = item.fields[key];
            var ext = path.extname(filePath);

            if(!fs.existsSync(filePath)){
                if(ext == '.js'){
                    filePath = filePath.substring(0, file.length - ext.length) + '.ts';
                    ext = '.ts';
                    if(!fs.existsSync(filePath)){
                        throw 'Unable to find mapping with either a .js or .ts extension' + filePath;
                    }
                }
            }

            if(ext == '.ts' && (filePath.indexOf('.d.ts') == -1))
            {
                var distPath = filePath.replace(path.normalize(paths.src), path.normalize(paths.dist));
                distPath = distPath.substring(0, distPath.length - ext.length) + '.js';
                if(!fs.existsSync(distPath)){
                    throw 'Typescript output file was not found: ' + distPath;
                }
                b.fields[key] = fs.readFileSync(distPath, 'utf8');
                b.fields[sn.types[item.type][key].ts_field] = fs.readFileSync(filePath, 'utf8');
            }
            else{
                b.fields[key] = fs.readFileSync(filePath, 'utf8');
            }
        });

        upload[id] = b;
    });

    return Q
        .when(putToServiceNow(sn.uri + '/api/avana/dev_integration/application/' + sn.application + '/files', JSON.stringify(upload)))
        .then(response => {
            if (response.code == 200) {
                var d = JSON.parse(response.body).result;
                Object.keys(d).forEach(key => {
                    var item = d[key];
                    if(item.etag_outofdate){
                        console.warn(item.table + '\\' + item.name + ' is out of date! Use gulp pull to syncronize with server');
                    }
                    else if(item.updated){
                        console.info(item.table + '\\' + item.name + ' was updated');
                        mappings[key].etag = item.etag;
                    }
                });

                fs.writeFileSync(sn.mapping, JSON.stringify(mappings, undefined, 3));
            }
            else{
                throw 'Error on Update: ' + response.body;
            }
        });
}

function pullAllFromServiceNow() {
    if (!checkUserSettings()) {
        return;
    }

    var mappings = {};

    if (fs.existsSync(sn.mapping)) {
        mappings = JSON.parse(fs.readFileSync(sn.mapping, 'utf8'));
    }

    var promises = [];

    var body = JSON.stringify({ files: Object.keys(sn.types) });
    var uri = sn.uri + '/api/avana/dev_integration/application/' + sn.application + '/files';

    var p1 = Q.when(invokeServiceNow(uri, 'POST', body))
        .then(response => {
            if (response.code == 200) {
                var result = JSON.parse(response.body).result;

                if (!mappings.hasOwnProperty(result.sys_app.id) ||
                    (mappings.hasOwnProperty(result.sys_app.id) && mappings[result.sys_app.id].etag != result.sys_app.etag)) {

                    console.log('Updating application typings files');
                    //Write the application details
                    mappings[sn.application] = {
                        type: 'sys_app',
                        etag: result.sys_app.etag,
                        fields: {
                            u_typings: 'typings.json',
                            u_dts: sn.dts.appdts
                        }
                    };

                    fs.writeFileSync('typings.json', result.sys_app.fields.u_typings);
                    fs.writeFileSync(sn.dts.appdts, result.sys_app.fields.u_dts);

                    addReferenceToIndex(sn.dts.appdts);
                    addReferenceToIndex(sn.dts.sndts);
                }

                Object.keys(result.files).forEach(key => {
                    var typeFiles = result.files[key];

                    typeFiles.forEach(t => {
                        //Only update the file if the server version has changed from last sync
                        if (!mappings.hasOwnProperty(t.id) || (mappings.hasOwnProperty(t.id) && mappings[t.id].etag != t.etag)) {
                            console.log('Updated: ' + t.table + '\\' + t.name);
                            var p = writeFile(t);
                            mappings[t.id] = {
                                type: t.table,
                                etag: t.etag,
                                fields: p
                            };
                        }
                    });
                })
            }
        });

    var p2 = getApplicationRefs(sn.application);

    return Q.all([p1, p2])
        .then(() => {
            fs.writeFileSync(sn.mapping, JSON.stringify(mappings, undefined, 3));
        });
}

function getApplicationRefs(id) {

    return Q.when(getFromServiceNow(sn.uri + '/api/avana/dev_integration/application/' + id + '/dependencies'))
        .then(response => {
            var result = JSON.parse(response.body).result;

            Object.keys(result).forEach(key => {
                var appref = result[key];
                var dtsPath = 'typings/appdependencies/' + appref.name + '/index.d.ts';

                if (!fs.existsSync(dtsPath)) {
                    mkdirpSync(path.dirname(dtsPath));
                }

                fs.writeFileSync(dtsPath, appref.dts);
                addReferenceToIndex(dtsPath);
            });
        });
}

function checkUserSettings() {
    if (!process.env.SN_USER || !process.env.SN_PASSWORD) {
        if (!fs.existsSync('.env')) {
            fs.writeFile('.env', 'SN_USER=\r\nSN_PASSWORD=');
        }

        console.error("ERROR: SN_USER and/or SN_PASSWORD env variables are not set!  Please update your .env file with your ServiceNow basic auth credentials!");
        return false;
    }

    return true;
}

function mkdirpSync(dirpath) {
    var dirPathNormed = path.normalize(dirpath);
    var parts = dirPathNormed.split(path.sep);
    for (var i = 1; i <= parts.length; i++) {
        var p = path.join.apply(null, parts.slice(0, i));
        if (!fs.existsSync(p)) {
            fs.mkdirSync(p);
        }
    }
}

function addReferenceToIndex(referencePath) {
    var pathToIndex = 'typings/index.d.ts';
    var write = false;

    //Get the path relative to the index file
    var relativePath = path.relative(path.dirname(pathToIndex), path.dirname(referencePath));

    //Check if the path already exists
    var regexPath = 'path=[\'"]' + path.join(relativePath, path.basename(referencePath)).replace(/\\/g, '\\\\') + '[\'"]';
    var appdtsRegex = new RegExp(regexPath, 'g');

    var content = fs.readFileSync(pathToIndex, 'utf8');

    if (!appdtsRegex.test(content)) {
        content += '\r\n/// <reference path="' + path.join(relativePath, path.basename(referencePath)) + '" />';
        write = true;
    }

    if (write) {
        fs.writeFileSync(pathToIndex, content);
    }
}

function writeFile(appDataItem) {
    var typeInfo = sn.types[appDataItem.table];
    var typePaths = {};

    if (!typeInfo) {
        return;
    }

    var handleType = function(fieldName, rootPath, fileName){
        var prop = typeInfo[fieldName];
        var content = appDataItem.fields[fieldName];
        var ext = prop.type;

        if(prop.ts_field && appDataItem.fields[prop.ts_field]){
            content = appDataItem.fields[prop.ts_field];
            ext = 'ts';
        }
        
        var filePath = path.join(rootPath, (fileName + '.' + ext));
        mkdirpSync(path.dirname(filePath), content);
        fs.writeFileSync(filePath, content);
        return filePath;
    }

    var fieldKeys = Object.keys(typeInfo);
    if(fieldKeys.length == 1){
        var field = fieldKeys[0];  
        typePaths[field] = handleType(field, path.join(paths.src, appDataItem.table), appDataItem.name);
    }
    else {
        fieldKeys.forEach(key => {
            typePaths[key] = handleType(key, path.join(paths.src, appDataItem.table, appDataItem.name), key);
        });
    }
    
    return typePaths;
}

function getFromServiceNow(uri) {
    return invokeServiceNow(uri, 'GET', undefined);
}

function putToServiceNow(uri, body) {
    return invokeServiceNow(uri, 'PUT', body);
};

function invokeServiceNow(uri, method, body) {
    var defer = Q.defer();

    var header = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Basic ' + (new Buffer(process.env.SN_USER + ':' + process.env.SN_PASSWORD)).toString('base64')
    };

    request(
        {
            url: uri,
            method: method,
            body: body,
            headers: header
        },
        function (err, response, body) {
            if (err) {
                defer.reject('ERROR: ' + err);
            }
            else {
                defer.resolve({ code: response.statusCode, body: body });
            }
        });

    return defer.promise;
}