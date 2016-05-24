// Copyright © 2015 Avanade, Inc.

var gulp = require('gulp');
var ts = require('gulp-typescript');
var paths = require('../paths');

var tsProject = ts.createProject('tsconfig.json', {
    typescript: require('typescript')
});

gulp.task('build', [], function () {
    return gulp.src(paths.buildserver.ts)
        .pipe(ts(tsProject))
        .pipe(gulp.dest(paths.buildserver.output));
});