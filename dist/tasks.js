"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const dotenv = require("dotenv");
const ts_simple_ast_1 = require("ts-simple-ast");
const gulpclass_1 = require("gulpclass");
const gulp = require("gulp");
const path = require("path");
const request = require("request");
const gulpts = require("gulp-typescript");
if (fs.existsSync(".env")) {
    dotenv.config();
}
let Gulpfile = class Gulpfile {
    constructor() {
        var path = require('path');
        var configPath = path.resolve('./servicenowconfig.js');
        console.info(configPath);
        this.config = require(configPath);
    }
    dts() {
        return new Promise((resolve, reject) => {
            if (!this.checkUserSettings()) {
                reject('AUTHENTICATION NOT SET');
                return;
            }
            else {
                const types = this.getAllTypes();
                this.invokeServiceNow(`${this.config.uri}/api/avana/dev_integration/schema`, 'POST', { tables: types })
                    .then(result => {
                    this.writeDTS(this.config.dts.sndts, this.config.dts.refs, this.config.dts.ignoreFields, result);
                    resolve();
                })
                    .catch(reject);
            }
        });
    }
    build() {
        const tsProject = gulpts.createProject('tsconfig.json', {
            typescript: require('typescript')
        });
        return gulp
            .src(this.config.tsfiles)
            .pipe(tsProject(gulpts.reporter.defaultReporter()))
            .pipe(gulp.dest(this.config.out));
    }
    getAllTypes() {
        const types = [];
        console.info(`loading types from ts files at ${this.config.tsfiles}`);
        const project = new ts_simple_ast_1.default({ compilerOptions: { removeComments: false } });
        project.addExistingSourceFiles(this.config.tsfiles);
        project.getSourceFiles()
            .forEach(file => {
            const news = file.getDescendantsOfKind(ts_simple_ast_1.SyntaxKind.NewExpression);
            news.forEach(n => {
                const ext = n.getExpression();
                var name = ext.getText();
                if (name == 'GlideRecord' || name == 'GlideRecordSecure') {
                    var args = n.getArguments();
                    if (args.length > 0) {
                        var atype = args[0].getType();
                        var aname = atype.getText();
                        if (aname.charAt(0) == '"' || aname.charAt(0) == "'")
                            aname = aname.substr(1, aname.length - 2);
                        if (types.indexOf(aname) == -1 && aname != 'string')
                            types.push(aname);
                    }
                }
            });
            const comments = file.getDescendantsOfKind(ts_simple_ast_1.SyntaxKind.JSDocComment);
            comments.forEach(comment => {
                var content = comment.getText().trim();
                if (content.substr(0, 4) == 'dts:') {
                    content.substr(5)
                        .split(',')
                        .forEach(t => {
                        if (types.indexOf(t) == -1)
                            types.push(t);
                    });
                }
            });
        });
        return types;
    }
    writeDTS(target, references, ignoreFields, definitions) {
        let dts = references
            .map(ref => `///<reference path="${ref}" />`)
            .join('\r\n');
        dts += "\r\n\r\ndeclare module sn {\r\n" +
            "\texport module Server {\r\n" +
            "\t\texport interface IGlideServerRecord {\r\n";
        const types = Object.keys(definitions).sort();
        types.forEach(type => dts += `\t\t\tnew (type: "${type}"): Types.I${type};\r\n`);
        dts += "\t\t}\r\n"
            + "\t}\r\n"
            + "\texport module Types {\r\n";
        types.forEach(type => {
            const def = definitions[type];
            const superclass = def.superclass ? "I" + def.superclass : "Server.IGlideServerRecord";
            dts += `\t\texport interface I${type} extends ${superclass} {\r\n`;
            const fields = Object.keys(def.fields).sort();
            fields.forEach(fieldname => {
                const fielddef = def.fields[fieldname];
                if (ignoreFields.indexOf(fieldname) == -1 &&
                    (!def.superclass || (definitions.hasOwnProperty(def.superclass) && !definitions[def.superclass].fields.hasOwnProperty(fieldname)))) {
                    let type = fielddef.type;
                    if (type.match(/IGlide/g)) {
                        type = `string`;
                    }
                    dts += `\t\t\t${fieldname}: sn.Server.IGlideElement & ${type}`;
                    if (fielddef.reference && definitions.hasOwnProperty(fielddef.reference)) {
                        dts += " & I" + fielddef.reference;
                    }
                    dts += ";\r\n";
                }
            });
            dts += "\t\t}\r\n";
        });
        dts += "\t}\r\n}";
        var targetdir = path.dirname(target);
        if (!fs.existsSync(targetdir))
            fs.mkdirSync(targetdir);
        fs.writeFileSync(target, dts);
        console.log("DTS saved to: " + target);
    }
    checkUserSettings() {
        if (!process.env.SN_USER || !process.env.SN_PASSWORD) {
            if (!fs.existsSync("./.env")) {
                fs.writeFileSync("./.env", "SN_USER=\r\nSN_PASSWORD=");
            }
            console.error("ERROR: SN_USER and/or SN_PASSWORD env variables are not set!  Please update your .env file with your ServiceNow basic auth credentials!");
            return false;
        }
        return true;
    }
    invokeServiceNow(uri, method, body) {
        return new Promise((resolve, reject) => {
            request({
                url: uri,
                method: method,
                body: body,
                json: true,
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "Authorization": "Basic " + (new Buffer(process.env.SN_USER + ":" + process.env.SN_PASSWORD)).toString("base64")
                }
            }, function (err, response, b) {
                if (!err && response.statusCode == 200) {
                    resolve(b.result);
                }
                else if (err) {
                    reject(err);
                }
            });
        });
    }
};
__decorate([
    gulpclass_1.Task()
], Gulpfile.prototype, "dts", null);
__decorate([
    gulpclass_1.Task()
], Gulpfile.prototype, "build", null);
Gulpfile = __decorate([
    gulpclass_1.Gulpclass()
], Gulpfile);
exports.Gulpfile = Gulpfile;
//# sourceMappingURL=tasks.js.map