import {default as chalk} from "chalk";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as gulp from "gulp";
import * as gulpts from "gulp-typescript";
import {Gulpclass, SequenceTask, Task} from "gulpclass";
import * as path from "path";
import * as request from "request";
import Project, { SyntaxKind } from "ts-simple-ast";

if (fs.existsSync(".env")) {
  dotenv.config();
}

@Gulpclass()
export class Gulpfile {
    private config: any;
    constructor() {
        const path = require("path");
        const configPath = path.resolve("./servicenowconfig.js");
        this.config = require(configPath);

        if (!this.config.src) {
            throw "servicenowconfig.js missing \"src\" path property";
        }

        if (!this.config.out) {
            throw "servicenowconfig.js missing \"out\" path property";
        }

        if (!this.config.tsconfig) {
            throw "servicenowconfig.js missing \"tsconfig\" path property";
        }
    }

    @Task()
  public dts() {
        return new Promise<void>((resolve, reject) => {
            if (!this.checkUserSettings()){
                reject("AUTHENTICATION NOT SET");
                return;
            }
            else{
                const types = this.getAllTypes();
                console.info(chalk.yellow("Requesting type info from SN for: ") + types);
                this.invokeServiceNow(`${this.config.uri}/api/avana/dev_integration/schema`, "POST", { tables: types })
                    .then(result => {
                        this.writeDTS(this.config.dts.sndts, this.config.dts.refs, this.config.dts.ignoreFields, result);
                        this.addReferenceToIndex(this.config.dts.sndts);
                        resolve();
                    })
                    .catch(reject);
            }
        });
    }

    @Task()
    public format(){
        const prettier = require("gulp-prettier");
        return gulp
                .src(this.config.src + "**/*.ts")
                .pipe(prettier({
                    parser: "typescript",
                    printWidth: 200,
                    tabWidth: 4
                 }))
                .pipe(gulp.dest(this.config.src));
    }

    @Task()
    public tslintfix(){
        const tslint = require("tslint");
        const gulpTsLint = require("gulp-tslint");

        const program = tslint.Linter.createProgram("./tsconfig.json");

        const tslintOptions = {
            configuration: "./tslint.json",
            fix: true,
            formatter: "stylish",
            formattersDirectory: null,
            program: program,
            rulesDirectory: null,
            tslint: tslint
        };

        return gulp
                .src(this.config.src + "**/*.ts")
                .pipe(gulpTsLint(tslintOptions))
                .pipe(gulpTsLint.report({
                    allowWarnings: true
                }));
    }

    @Task()
    public tslint(){
        const tslint = require("tslint");
        const gulpTsLint = require("gulp-tslint");

        const program = tslint.Linter.createProgram("./tsconfig.json");

        const tslintOptions = {
            configuration: "./tslint.json",
            fix: false,
            formatter: "stylish",
            formattersDirectory: null,
            program: program,
            rulesDirectory: null,
            tslint: tslint
        };

        return gulp
                .src(this.config.src + "**/*.ts")
                .pipe(gulpTsLint(tslintOptions))
                .pipe(gulpTsLint.report({
                    allowWarnings: true
                }));
    }

    @Task(undefined, ["tslint", "format"])
    public build(){
        const tsProject = gulpts.createProject(this.config.tsconfig, {
            typescript: require("typescript")
        });

        return gulp
                .src(this.config.src + "**/*.ts")
                .pipe(tsProject(gulpts.reporter.defaultReporter()))
                .pipe(gulp.dest(this.config.out));
    }

    @Task(undefined, ["build"])
    public push() {
        return this.pushToServiceNow();
    }

    @Task()
    public pull(){
        return this.pullFromServiceNow();
    }

    @SequenceTask()
    public sync() {
        return ["pull", "dts"];
    }

    private pushToServiceNow(): Promise<any> {
        type UploadContent = {
            id: string,
            etag: string,
            table: string,
            fields: {
                [key: string]: string
            }
        };

        const upload: {[id: string]: UploadContent} = {};

        const mappings = require(path.resolve(this.config.mapping)) as MappingFile;

        Object.keys(mappings)
            .forEach(id => {
                const item = mappings[id];
                if (!item || !item.fields) {
                    return;
                }

                const b: UploadContent = {
                    etag: item.etag,
                    fields: { },
                    id: id,
                    table: item.type
                };

                Object.keys(item.fields).forEach(key => {
                    let filePath = item.fields[key];
                    let ext = path.extname(filePath);

                    if (!fs.existsSync(filePath)){
                        if (ext === ".js"){
                            filePath = filePath.substring(0, filePath.length - ext.length) + ".ts";
                            ext = ".ts";
                            if (!fs.existsSync(filePath)){
                                throw "Unable to find mapping with either a .js or .ts extension" + filePath;
                            }
                        }
                    }

                    if (ext === ".ts" && (filePath.indexOf(".d.ts") === -1))
                    {
                        let distPath = filePath.replace(path.normalize(this.config.src), path.normalize(this.config.out));
                        distPath = distPath.substring(0, distPath.length - ext.length) + ".js";
                        if (!fs.existsSync(distPath)){
                            throw "Typescript output file was not found: " + distPath;
                        }
                        b.fields[key] = fs.readFileSync(distPath, "utf8");
                        b.fields[this.config.types[item.type][key].ts_field] = fs.readFileSync(filePath, "utf8");
                    }
                    else{
                        b.fields[key] = fs.readFileSync(filePath, "utf8");
                    }
                });

                upload[id] = b;
            });

        const uri = `${this.config.uri}/api/avana/dev_integration/application/${this.config.application}/files`;

        return this
                .invokeServiceNow(uri, "PUT", upload)
                .then(result => {
                    Object.keys(result).forEach(key => {
                        const item = result[key];
                        if (item.etag_outofdate){
                            console.warn(chalk.yellowBright(item.table + "\\" + item.name +
                                                            " is out of date! Use " +
                                                            chalk.white("gulp pull") +
                                                            " to syncronize with server"));
                        }
                        else if (item.updated){
                            console.info(item.table + "\\" + item.name + " was updated");
                            mappings[key].etag = item.etag;
                        }
                    });

                    fs.writeFileSync(this.config.mapping, JSON.stringify(mappings, undefined, 3));
                });
    }

    private pullFromServiceNow(): Promise<any> {
        let mappings: MappingFile = {};
        if (fs.existsSync(this.config.mapping)){
            mappings = require(path.resolve(this.config.mapping));
        }

        const body = {
            files: Object.keys(this.config.types)
        };

        const uri = `${this.config.uri}/api/avana/dev_integration/application/${this.config.application}/files`;
        return Promise.all([
            this.invokeServiceNow(uri, "POST", body)
                .then(r => this.writePullResult(r, mappings))
                .then(m => {
                    fs.writeFileSync(this.config.mapping, JSON.stringify(m, undefined, 3));
                }),
            this.getApplicationRefs(this.config.application)
        ]);
    }

    private writePullResult(result: GetFilesResult, mappings: MappingFile): MappingFile{
        if (!mappings.hasOwnProperty(result.sys_app.id) || (mappings[result.sys_app.id].etag !== result.sys_app.etag)) {
            console.log("Updating application typings file");
            mappings[this.config.application] = {
                etag: result.sys_app.etag,
                fields: {
                    u_dts: this.config.dts.appdts,
                    u_typings: "typings.json"
                },
                type: "sys_app"
            };

            fs.writeFileSync("typings.json", result.sys_app.fields.u_typings);
            fs.writeFileSync(this.config.dts.appdts, result.sys_app.fields.u_dts);

            this.addReferenceToIndex(this.config.dts.appdts);
            this.addReferenceToIndex(this.config.dts.sndts);
        }

        Object.keys(result.files)
            .forEach(key => {
                const typeFiles = result.files[key];

                typeFiles.forEach(t => {
                    // Only update the file if the server version has changed from last sync
                    if (!mappings.hasOwnProperty(t.id) || (mappings.hasOwnProperty(t.id) && mappings[t.id].etag !== t.etag)) {
                        console.log("Updated: " + t.table + "\\" + t.name);
                        const p = this.writeFile(t);
                        if (p){
                            mappings[t.id] = {
                                etag: t.etag,
                                fields: p,
                                type: t.table
                            };
                        }
                    }
                });
            });

        return mappings;
    }

    private getApplicationRefs(id: string): Promise<void> {
        const uri = `${this.config.uri}/api/avana/dev_integration/application/${id}/dependencies`;

        return this.invokeServiceNow(uri, "GET")
            .then(result => {
                Object.keys(result).forEach(key => {
                    const appref = result[key];
                    const dtsPath = "typings/appdependencies/" + appref.name + "/index.d.ts";

                    if (!fs.existsSync(dtsPath)) {
                        this.mkdirpSync(path.dirname(dtsPath));
                    }

                    fs.writeFileSync(dtsPath, appref.dts);
                    this.addReferenceToIndex(dtsPath);
                });
            });
    }

    private writeFile(appDataItem: GetFile): {[field: string]: string} | null {
        const typeInfo = this.config.types[appDataItem.table];
        const typePaths: {[field: string]: string} = {};

        if (!typeInfo) {
            return null;
        }

        const handleType = (fieldName: string, rootPath: string, fileName: string): string => {
            const prop = typeInfo[fieldName];
            let content = appDataItem.fields[fieldName];
            let ext = prop.type;

            if (prop.ts_field && appDataItem.fields[prop.ts_field]){
                content = appDataItem.fields[prop.ts_field];
                ext = "ts";
            }

            const filePath = path.join(rootPath, (fileName + "." + ext));
            this.mkdirpSync(path.dirname(filePath));
            fs.writeFileSync(filePath, content);
            return filePath;
        };

        const fieldKeys = Object.keys(typeInfo);
        if (fieldKeys.length === 1){
            const field = fieldKeys[0];
            typePaths[field] = handleType(field, path.join(this.config.src, appDataItem.table), appDataItem.name);
        }
        else {
            fieldKeys.forEach(key => {
                typePaths[key] = handleType(key, path.join(this.config.src, appDataItem.table, appDataItem.name), key);
            });
        }

        return typePaths;
    }

    private mkdirpSync(dirpath: string) {
        const dirPathNormed = path.normalize(dirpath);
        const parts = dirPathNormed.split(path.sep);
        for (let i = 1; i <= parts.length; i++) {
            const p = path.join.apply(null, parts.slice(0, i));
            if (!fs.existsSync(p)) {
                fs.mkdirSync(p);
            }
        }
    }

    private getAllTypes(): Array<string> {
    let types: Array<string> = [];
    const srcPath = this.config.src + "**/*.ts";
    console.info(`loading types from ts files at ${srcPath}`);
    const project = new Project({compilerOptions: {removeComments: false}});
    project.addExistingSourceFiles(srcPath);
    project.getSourceFiles()
            .forEach(file => {
                // find all new expressions and see if they are gliderecord:  const foo = new GlideRecord('sometable');
                const news = file.getDescendantsOfKind(SyntaxKind.NewExpression);
                news.forEach(n => {
                    const ext = n.getExpression();
                    const name = ext.getText();
                    if (name === "GlideRecord" || name === "GlideRecordSecure"){
                        const args = n.getArguments();
                        if (args.length > 0){
                            const atype = args[0].getType();
                            let aname = atype.getText();
                            if (aname.charAt(0) === "\"" || aname.charAt(0) === "'") {
                                aname = aname.substr(1, aname.length - 2);
                            }

                            if (types.indexOf(aname) === -1 && aname !== "string") {
                                types.push(aname);
                            }
                        }
                    }
                });

                // Find all dts comment defs: /**dts: tablename1,tablename2 */
                // support multiline
                const dtsregex = new RegExp(/dts:[\s+]?([\w,\d\s\r\n\*]+)/gi);

                const comments = file.getDescendantsOfKind(SyntaxKind.JSDocComment);
                comments.forEach(comment => {
                    const content = comment.getText().trim();
                    let match = dtsregex.exec(content);
                    while (match != null){
                        const matchtypes = match[1];
                        const matches = matchtypes
                            .trim()
                            .replace(/[\r\n\*]/g,"") // remove newline and * characters
                            .split(",")
                            .map(m => m.trim())
                            .filter(m => types.indexOf(m) === -1);

                        types = types.concat(matches);

                        match = dtsregex.exec(content);
                    }
                });
            });

    return types;
  }

    private writeDTS(target: string, references: Array<string>, ignoreFields: Array<string>, definitions: any) {
        let dts = references
                    .map(ref => `///<reference path="${ref}" />`)
                    .join("\r\n");

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
                if (ignoreFields.indexOf(fieldname) === -1
                    && (!def.superclass
                        || (definitions.hasOwnProperty(def.superclass)
                        && !definitions[def.superclass].fields.hasOwnProperty(fieldname))
                        )
                    ) {
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

        const targetdir = path.dirname(target);
        if (!fs.existsSync(targetdir)) {
            fs.mkdirSync(targetdir);
        }

        fs.writeFileSync(target, dts);
        console.log(chalk.green("DTS saved to: " + target));
    }

    private checkUserSettings() {
        if (!process.env.SN_USER || !process.env.SN_PASSWORD) {
            if (!fs.existsSync("./.env")) {
                fs.writeFileSync("./.env", "SN_USER=\r\nSN_PASSWORD=");
            }

            console.error(chalk.red("ERROR: SN_USER and/or SN_PASSWORD env constiables are not set! Please update your .env file with your ServiceNow basic auth credentials!"));
            return false;
        }
        return true;
    }

    private invokeServiceNow(uri: string, method: "GET"|"POST"|"PUT", body?: any): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            request(
                {
                    body: body,
                    headers: {
                        "Accept": "application/json",
                        "Authorization": "Basic " + (new Buffer(process.env.SN_USER + ":" + process.env.SN_PASSWORD)).toString("base64"),
                        "Content-Type": "application/json"
                    },
                    json: true,
                    method: method,
                    url: uri
                },
                (err, response, b) => {
                    if (!err && response.statusCode === 200) {
                        resolve(b.result);
                    }
                    else {
                        reject(err);
                    }
                });
        });
    }

    private addReferenceToIndex(referencePath: string) {
        const pathToIndex = "typings/index.d.ts";
        let write = false;

        // Get the path relative to the index file
        const relativePath = path.relative(path.dirname(pathToIndex), path.dirname(referencePath));

        // Check if the path already exists
        const regexPath = "path=['\"]" + path.join(relativePath, path.basename(referencePath)).replace(/\\/g, "\\\\") + "['\"]";
        const appdtsRegex = new RegExp(regexPath, "g");

        let content = fs.readFileSync(pathToIndex, "utf8");

        if (!appdtsRegex.test(content)) {
            content += "\r\n/// <reference path=\"" + path.join(relativePath, path.basename(referencePath)) + "\" />";
            write = true;
        }

        if (write) {
            fs.writeFileSync(pathToIndex, content);
        }
    }
}

type MappingFile = {
    [sysid: string]: {
        type: string,
        etag: string,
        fields: {
            [field: string]: string;
        }
    }
};

type GetFilesResult = {
    sys_app: {
        id: string,
        etag: string,
        fields: {
            u_typings: string,
            u_dts: string
        }
    },
    files: {
        [type: string]: Array<GetFile>
    }
};

type GetFile = {
    id: string;
    table: string;
    etag: string;
    name: string;
    fields: {
        [fieldName: string]: string;
    }
};
