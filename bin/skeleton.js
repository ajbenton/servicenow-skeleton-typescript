#!/usr/bin/env node

'use strict'
var fs = require('fs');
var path = require('path');

var copyFile = function(srcFile, destFile) {
    var content = fs.readFileSync(srcFile, 'utf8');
    fs.writeFileSync(destFile, content, 'utf8');
}

if(process.argv[process.argv.length-1] == 'init'){
    console.log('Initializing ServiceNow Skeleton Project');

    var appRoot = process.cwd();

    var copyFiles = ['servicenowconfig.js', 'src/tsconfig.json', 'typings.json'];
    var sourceRoot = path.relative(appRoot, path.dirname(path.dirname(process.argv[1])));

    copyFiles.forEach(file => {
        var dest = path.join(appRoot, path.basename(target));
        if(!fs.existsSync(dest)){
            copyFile(path.join(sourceRoot, path.basename(file)), dest);
        }
    });

    var gulpFileDest = path.join(appRoot, 'gulpfile.js');
    var content = "require('require-dir')('" + path.normalize(path.join(sourceRoot, "build", "tasks")).replace(/\\/g, '\\\\') + "')";
    if(fs.existsSync(gulpFileDest)){
        content = fs.readFileSync(gulpFileDest, 'utf8') + '\r\n' + content;
    }
    
    fs.writeFileSync(gulpFileDest, content);

    console.info("Init complete.  You may also need to run 'typings install' to finish setting up the skeleton");
}
else{
    console.info('Valid Commands:');
    console.info('init : Initializes the current directory for the servicenow skeleton project');
}