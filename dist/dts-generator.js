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
if (fs.existsSync(".env")) {
    dotenv.config();
}
let Gulpfile = class Gulpfile {
    dts(cb) {
        const types = this.getAllTypes();
        console.log(types);
    }
    getAllTypes() {
        const types = [];
        const project = new ts_simple_ast_1.default();
        project.addExistingSourceFiles('test/**/*.ts');
        project.getSourceFiles().forEach(file => {
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
                        if (types.indexOf(aname) == -1)
                            types.push(aname);
                    }
                }
            });
        });
        return types;
    }
};
__decorate([
    gulpclass_1.Task()
], Gulpfile.prototype, "dts", null);
Gulpfile = __decorate([
    gulpclass_1.Gulpclass()
], Gulpfile);
exports.Gulpfile = Gulpfile;
//# sourceMappingURL=dts-generator.js.map