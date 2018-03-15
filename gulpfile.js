// all gulp tasks are located in the ./build/tasks directory
// gulp configuration is in files in ./build directory
//require('require-dir')('dist');
eval(require("typescript").transpile(require("fs").readFileSync("./build/tasks.ts").toString()));