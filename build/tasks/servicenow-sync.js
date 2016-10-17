// Copyright 2016 Avanade, Inc.

require('dotenv').config()

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

gulp.task('default', ['build'], function () {
    return pushAllToServiceNow();
});

function pushAllToServiceNow() {
    if (!checkUserSettings()) {
        return;
    }

    var upload = {};

    var mappings = JSON.parse(fs.readFileSync(sn.mapping, 'utf8'));

    Object.keys(mappings).forEach(key => {
        var item = mappings[key];
        if (!item.path)
            return;

        var file = item.path;
        var ext = path.extname(file);

        if (!fs.existsSync(file)) {
            if (ext == '.js') {
                file = file.substring(0, file.length - ext.length) + '.ts';
                ext = '.ts';
                if (!fs.existsSync(file)) {
                    throw 'Unable to find mapping with either .js or .ts extension: ' + file;
                }
            }
        }

        var b = {
            id: key,
            etag: item.etag,
            table: item.type,
            fields: {}
        };

        if (item.type == 'sys_app') {
            if (fs.existsSync(item.path)) {
                b.fields['u_typings'] = fs.readFileSync(item.path, 'utf8');
            }

            if (fs.existsSync(sn.dts.appdts)) {
                b.fields['u_dts'] = fs.readFileSync(sn.dts.appdts, 'utf8');
            }
        }
        else {
            switch (ext) {
                case '.ts':
                    var distPath = file.replace(path.normalize(paths.src), path.normalize(paths.dist));
                    distPath = distPath.substring(0, distPath.length - ext.length) + '.js';
                    b.fields[sn.types[item.type].js] = fs.readFileSync(distPath, 'utf8');
                    b.fields[sn.types[item.type].ts] = fs.readFileSync(file, 'utf8');
                    break;
                case '.js':
                    b.fields[sn.types[item.type].js] = fs.readFileSync(file, 'utf8');
                    break;
                case '.html':
                    b.fields[sn.types[item.type].html] = fs.readFileSync(file, 'utf8');
                    break;
                default:
                    throw 'Unknown file type ' + file;
            }
        }

        upload[key] = b;
    });

    return Q
        .when(putToServiceNow(sn.uri + '/api/avana/dev_integration/application/' + sn.application + '/files', JSON.stringify(upload)))
        .then(response => {
            if (response.code == 200) {
                var d = JSON.parse(response.body).result;
                Object.keys(d).forEach(item => {
                    console.log(item.name + ' was updated');
                    mappings[key].etag = item.etag;
                });

                fs.writeFileSync(sn.mapping, JSON.stringify(mappings, undefined, 3));
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
                        path: 'typings.json'
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
                                path: p
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

    if (!typeInfo) {
        return;
    }

    var body;
    var ext;
    if (typeInfo.hasOwnProperty('ts') || typeInfo.hasOwnProperty('js')) {
        body = appDataItem.fields[typeInfo.ts];
        ext = '.ts';

        if (!body) {
            body = appDataItem.fields[typeInfo.js];
            ext = '.js';
        }
    } else if (typeInfo.hasOwnProperty('html')) {
        body = appDataItem.fields[typeInfo.html];
        ext = '.html';
    }

    if (!body || !ext) {
        return;
    }

    var p = paths.src;
    if (!fs.existsSync(p)) {
        fs.mkdirSync(p);
    }
    p = path.join(p, appDataItem.table);

    if (!fs.existsSync(p)) {
        fs.mkdirSync(p);
    }

    p = path.join(p, (appDataItem.name + ext));
    fs.writeFileSync(p, body);

    return p;
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