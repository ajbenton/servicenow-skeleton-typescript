/**dts: core_company */

export class MyTest {
    private myfunc() {
        const fooname = 'cmdb_ci';
        const foo2 = new GlideRecord(fooname);
        var foo = new GlideRecord('cmdb');
    }

    public somefunc() {
        const foo = new GlideRecord('cmdb_ci');

        const foo2 = new GlideRecord('cmdb_ci_win_server');
        if(new Number(foo2.operational_status) == 7){

        }
    }
}