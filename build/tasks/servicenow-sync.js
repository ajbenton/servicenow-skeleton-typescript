// Copyright 2016 Avanade, Inc.

var gulp = require('gulp');
var fs = require('fs');
var paths = require('../paths');
var path = require('path');
var sn = require(path.join(process.cwd(), 'servicenowconfig'));
var request = require('request');
var Q = require('q');
var sequence = require('run-sequence')

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
    var promises = [];

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

        var uri = sn.uri + sn.dev_integration_endpoint + '/' + item.type + '/' + key;

        var json = JSON.stringify(b);

        promises.push(
            putToServiceNow(uri, json)
                .then(response => {
                    if (response.code == 200) {
                        var d = JSON.parse(response.body).result;
                        mappings[d.id].etag = d.etag;
                        console.log(d.name + ' was updated');
                    }
                    else if (response.code == 409) {
                        console.warn("WARN: " + item.path + ' is out of sync, run "gulp pull"!');
                    }
                    else if (response.code == 304) {
                        //unmodified
                    }
                    else {
                        console.error(response.code + ': ' + response.body);
                    }
                })
        );
    });

    return Q.all(promises)
        .then(() => {
            fs.writeFileSync(sn.mapping, JSON.stringify(mappings, undefined, 3));
        });
}

function pullAllFromServiceNow() {
    var mappings = {};
    var promises = [];

    Object.keys(sn.types).forEach(type => {
        var uri = sn.uri + sn.dev_integration_endpoint + 'application/' + sn.application + '/' + type;

        promises.push(Q.when(getFromServiceNow(uri))
            .then(response => {
                if (response.code == 200) {
                    var result = JSON.parse(response.body).result;
                    result.forEach(item => {
                        var p = writeFile(item);
                        mappings[item.id] = {
                            type: item.table,
                            etag: item.etag,
                            path: p
                        };
                    });
                }
                else {
                    throw 'GET ERROR (' + response.code + '): ' + response.body;
                }
            })
        );
    });

    promises.push(Q.when(getFromServiceNow(sn.uri + sn.dev_integration_endpoint + 'application/' + sn.application + '/sys_app'))
        .then(response => {
            var result = JSON.parse(response.body).result;
            for (var i = 0; i < result.length; i++) {
                var app = result[i];
                if (app.id == sn.application) {
                    mappings[sn.application] = {
                        type: 'sys_app',
                        etag: app.etag,
                        path: 'typings.json'
                    };

                    fs.writeFileSync('typings.json', app.fields.u_typings);
                    fs.writeFileSync(sn.dts.appdts, app.fields.u_dts);

                    addReferenceToIndex(sn.dts.appdts);
                    addReferenceToIndex(sn.dts.sndts);
                }
            }
        }));

    promises.push(getApplicationRefs(sn.application));

    return Q.all(promises)
        .then(() => {
            fs.writeFileSync(sn.mapping, JSON.stringify(mappings, undefined, 3));
        });
}

function getApplicationRefs(id) {

    return Q.when(getFromServiceNow(sn.uri + sn.dev_integration_endpoint + 'dependencies/application/' + id))
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

var mkdirpSync = function (dirpath) {
    var dirPathNormed = path.normalize(dirpath);
    var parts = dirPathNormed.split(path.sep);
    for (var i = 1; i <= parts.length; i++) {
        var p = path.join.apply(null, parts.slice(0, i));
        if(!fs.existsSync(p)){
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
    checkAuth();
    return invokeServiceNow(uri, 'PUT', body, sn.auth.user, sn.auth.password);
};

function checkAuth() {
    if (!sn.auth.user || !sn.auth.password) {
        throw 'Authentication to ServiceNow is not set for your environment!  Configure servicenowconfig.js with your usersname and password';
    }
}

function invokeServiceNow(uri, method, body, user, password) {
    var defer = Q.defer();

    var header = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };

    if (user && password) {
        header['Authorization'] = 'Basic ' + (new Buffer(user + ':' + password)).toString('base64');
    }

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