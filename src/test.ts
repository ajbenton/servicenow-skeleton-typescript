///<dts>core_company</dts>

export class MyTest {
    private myfunc() {
        const fooname = 'cmdb_ci';
        const foo2 = new GlideRecord(fooname);
        var foo = new GlideRecord('cmdb');
    }

    public somefunc() {
        const foo = new GlideRecord('cmdb_ci');
    }
}