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


declare var GlideRecord: sn.Server.IGlideServerRecord;

declare module sn {
	export module Server {
		export interface IGlideServerRecord {
            new (type: string): IGlideServerRecord;
			new (type: "cmdb"): Types.Icmdb;
			new (type: "cmdb_ci"): Types.Icmdb_ci;
        }
        
        export interface IGlideElement{
            name: string;
        }
	}
	export module Types {
		export interface Icmdb extends Server.IGlideServerRecord {
            asset: string|sn.Server.IGlideElement;
        }
        
		export interface Icmdb_ci extends Server.IGlideServerRecord {
            somefield: string|sn.Server.IGlideElement;
        }
    }
}