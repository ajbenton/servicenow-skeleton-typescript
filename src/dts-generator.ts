import * as fs from 'fs';
import * as dotenv from 'dotenv';
import Project, { SyntaxKind } from 'ts-simple-ast';
import {Gulpclass, Task} from 'gulpclass';
import * as gulp from "gulp";
import * as path from "path";
import * as request from "request";
import * as Q from "q";

if (fs.existsSync(".env")) {
	dotenv.config()
}

//const sn = require(path.join(process.cwd(), "servicenowconfig"));

@Gulpclass()
export class Gulpfile {

	@Task()
	dts(cb: Function) {
        const types = this.getAllTypes();
        console.log(types);
	}

	
	private getAllTypes() : Array<string> {
		const types : Array<string> = [];

		const project = new Project();
		project.addExistingSourceFiles('test/**/*.ts');
		project.getSourceFiles().forEach(file => {
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

                        if(types.indexOf(aname) == -1)
                            types.push(aname);
                    }
                }
			})
		});

		return types;
	}


    // function writeDTS(target, definitions) {
    //     let dts = "";
    //     for (let i = 0; i < sn.dts.refs.length; i++) {
    //         dts += `///<reference path="${sn.dts.refs[i]}" />\r\n`;
    //     }

    //     dts += "declare module sn {\r\n" +
    //         "\texport module Server {\r\n" +
    //         "\t\texport interface IGlideServerRecord {\r\n";

    //     const types = Object.keys(definitions).sort();
    //     types.forEach(type => dts += `\t\t\tnew (type: "${type}"): Types.I${type};\r\n`);

    //     dts += "\t\t}\r\n"
    //         + "\t}\r\n"
    //         + "\texport module Types {\r\n";
    //     types.forEach(type => {
    //         const def = definitions[type];
    //         const superclass = def.superclass ? "I" + def.superclass : "Server.IGlideServerRecord";
    //         dts += `\t\texport interface I${type} extends ${superclass} {\r\n`;
    //         const fields = Object.keys(def.fields).sort();
    //         fields.forEach(fieldname => {
    //             const fielddef = def.fields[fieldname];
    //             if (sn.dts.ignoreFields.indexOf(fieldname) == -1 &&
    //                 (!def.superclass ||
    //                     (definitions.hasOwnProperty(def.superclass) && !definitions[def.superclass].fields.hasOwnProperty(fieldname)))) {
    //                 let type = fielddef.type;
    //                 if (type.match(/IGlide/g)) {
    //                     type = `sn.Server.${type}`;
    //                 }

    //                 dts += `\t\t\t${fieldname}: ${type}`;

    //                 if (fielddef.reference && definitions.hasOwnProperty(fielddef.reference)) {
    //                     dts += " & I" + fielddef.reference;
    //                 }

    //                 // TODO: add support for string choice types to generate ("a"|"b"|"c") here.

    //                 dts += " & sn.Server.IGlideElement;\r\n";
    //             }
    //         });
    //         dts += "\t\t}\r\n";
    //     });
    //     dts += "\t}\r\n}";

    //     fs.writeFileSync(target, dts);
    //     console.log("DTS saved to: " + target);
    // }

    // function checkUserSettings() {
    //     if (!process.env.SN_USER || !process.env.SN_PASSWORD) {
    //         if (!fs.existsSync(".env")) {
    //             fs.writeFile(".env", "SN_USER=\r\nSN_PASSWORD=");
    //         }

    //         console.error("ERROR: SN_USER and/or SN_PASSWORD env variables are not set!  Please update your .env file with your ServiceNow basic auth credentials!");
    //         return false;
    //     }
    //     return true;
    // }

    // private function invokeServiceNow(uri, method, body) {
    //     const defer = Q.defer();
    //     request(
    //         {
    //             url: uri,
    //             method: method,
    //             body: body,
    //             headers: {
    //                 "Content-Type": "application/json",
    //                 "Accept": "application/json",
    //                 "Authorization": "Basic " + (new Buffer(process.env.SN_USER + ":" + process.env.SN_PASSWORD)).toString("base64")
    //             }
    //         },
    //         function (err, response, b) {
    //             if (!err && response.statusCode == 200) {
    //                 defer.resolve(JSON.parse(b).result);
    //             }
    //             else if (err) {
    //                 defer.reject(err);
    //             }
    //         });

    //     return defer.promise;
    // }
}

// gulp.task("dts", [], function () {
// 	checkUserSettings();
// 	const body = {
// 		tables: getAllTypes()
// 	};

// 	console.log("Generating types for: " + body.tables);

// 	return Q
// 		.when(invokeServiceNow(sn.uri + "/api/avana/dev_integration/schema", "POST", JSON.stringify(body)))
// 		.then(response => {
// 			writeDTS(sn.dts.sndts, response);
// 		})
// 		.catch(err => {
// 			console.error("DTS Gen Error: " + err);
// 		});
// });
