/** dts: core_company */
import * as assert from "assert";
import Project, { SyntaxKind } from "ts-simple-ast";

describe("DTS Parser", () => {
    it("should return types from a multiline JSDoc dts declaration", () => {
        const types = readDtsTypesFromMultiLineJSDocCommentBlock();

        assert.equal(types.length, 3);
        ["core_company", "sys_user", "cmdb_ci_win_server"].forEach((type, i) => {
            assert.equal(type, types[i]);
        });
    });
});

function readDtsTypesFromMultiLineJSDocCommentBlock(){
    let types: Array<string> = [];

    const project = new Project({compilerOptions: {removeComments: false}});
    project.addExistingSourceFiles("**/*dtsTestFile.ts");
    project.getSourceFiles()
            .forEach(file => {
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
