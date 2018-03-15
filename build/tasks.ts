import * as fs from 'fs';
import * as dotenv from 'dotenv';
import Project, { SyntaxKind } from 'ts-simple-ast';
import {Gulpclass, Task, SequenceTask} from 'gulpclass';
import * as gulp from "gulp";
import * as path from "path";
import * as request from "request";
import * as gulpts from 'gulp-typescript';

if (fs.existsSync(".env")) {
	dotenv.config()
}

@Gulpclass()
export class Gulpfile {
    private config: any;
    constructor() {
        var path = require('path');
        this.config = require('./servicenowconfig');        
    }

	@Task()
	dts() {
        return new Promise((resolve, reject) => {
            if(!this.checkUserSettings()){
                reject('AUTHENTICATION NOT SET');
                return;
            }
            else{
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
    
    @Task()
    build(){
        const tsProject = gulpts.createProject('tsconfig.json', {
            typescript: require('typescript')
        });

        return gulp
                .src(this.config.tsfiles)
                .pipe(tsProject(gulpts.reporter.defaultReporter()))
                .pipe(gulp.dest(this.config.out));
    }
	
	private getAllTypes() : Array<string> {
		const types : Array<string> = [];

		const project = new Project();
		project.addExistingSourceFiles(this.config.tsfiles);
        project.getSourceFiles()
            .forEach(file => {
                const news = file.getDescendantsOfKind(SyntaxKind.NewExpression);
                news.forEach(n => {
                    const ext = n.getExpression();
                    var name = ext.getText();
                    if(name == 'GlideRecord' || name == 'GlideRecordSecure'){
                        var args = n.getArguments();
                        if(args.length > 0){
                            var atype = args[0].getType();
                            var aname = atype.getText();
                            if(aname.charAt(0) == '"' || aname.charAt(0) == "'")
                                aname = aname.substr(1, aname.length-2);

                            if(types.indexOf(aname) == -1 && aname != 'string')
                                types.push(aname);
                        }
                    }
                });

                const comments = file.getDescendantsOfKind(SyntaxKind.SingleLineCommentTrivia);
                comments.forEach(comment => {
                    console.log("COMMENT: " + comment.getText());
                });
            });

		return types;
	}

    private writeDTS(target: string, references: Array<string>, ignoreFields: Array<string>, definitions: any) {
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
                    (!def.superclass ||
                        (definitions.hasOwnProperty(def.superclass) && !definitions[def.superclass].fields.hasOwnProperty(fieldname)))) {
                    let type = fielddef.type;
                    if (type.match(/IGlide/g)) {
                        type = `sn.Server.${type}`;
                    }

                    dts += `\t\t\t${fieldname}: ${type}`;

                    if (fielddef.reference && definitions.hasOwnProperty(fielddef.reference)) {
                        dts += " & I" + fielddef.reference;
                    }

                    dts += " & sn.Server.IGlideElement;\r\n";
                }
            });
            dts += "\t\t}\r\n";
        });
        dts += "\t}\r\n}";

        var targetdir = path.dirname(target);
        if(!fs.existsSync(targetdir))
            fs.mkdirSync(targetdir);

        fs.writeFileSync(target, dts);
        console.log("DTS saved to: " + target);
    }

    private checkUserSettings() {
        if (!process.env.SN_USER || !process.env.SN_PASSWORD) {
            if (!fs.existsSync("./.env")) {
                fs.writeFileSync("./.env", "SN_USER=\r\nSN_PASSWORD=");
            }

            console.error("ERROR: SN_USER and/or SN_PASSWORD env variables are not set!  Please update your .env file with your ServiceNow basic auth credentials!");
            return false;
        }
        return true;
    }

    private invokeServiceNow(uri: string, method: 'GET'|'POST', body: any) : Promise<any> {
        return new Promise<any>((resolve, reject) => {
            request(
                {
                    url: uri,
                    method: method,
                    body: body,
                    json: true,
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                        "Authorization": "Basic " + (new Buffer(process.env.SN_USER + ":" + process.env.SN_PASSWORD)).toString("base64")
                    }
                },
                function (err, response, b) {
                    if (!err && response.statusCode == 200) {
                        resolve(b.result);
                    }
                    else if (err) {
                        reject(err);
                    }
                });
        });
    }
}
