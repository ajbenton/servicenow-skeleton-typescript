var path = require('path');

var dist = 'dist/';
var src = 'src/';

module.exports = {
    src: src,
    dist: dist,
    buildserver: {
        less: src + '**/*.less',
        ts: src + '**/*.ts',
        html: src + '**/*.html',
        output: dist
    }
};