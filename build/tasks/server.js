// Copyright © 2015 Avanade, Inc.

var gulp = require('gulp');
var ts = require('gulp-typescript');
var paths = require('../paths');
var Q = require('q');

var tsProject = ts.createProject('tsconfig.json', {
    typescript: require('typescript')
});

gulp.task('build', [], function () {
    var defer = Q.defer();
    var tsResult = gulp.src(paths.buildserver.ts)
        .pipe(ts(tsProject))
        .on("error", function(err){ 
            defer.reject(err);
        })
        .pipe(gulp.dest(paths.buildserver.output))
        .on("end", function(){
            defer.resolve(tsResult);
        });
        
    return defer.promise;
});

// Uncomment out for gulp debugging
// Replace 'build' with task to debug
/*
var taskToDebug = 'push';
gulp.task('default', [taskToDebug], function(res){
    //console.log(JSON.stringify(res));
    res();
    console.log("Done with default gulp task")
});
*/