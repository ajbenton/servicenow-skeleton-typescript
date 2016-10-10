# servicenow-skeleton-typescript

## Initial Project Setup
### Node Project Setup
```bash
npm install servicenow-dev-skeleton
node_modules\.bin\skeleton init
typings install
```

### Configure servicenowconfig.js for your application
- uri = path to your servicenow instance
- application = sys_id of the ServiceNow scoped application your are developing
- auth = user and password for running gulp tasks as (Uses basic auth, so needs to be a local account not SSO with priveledges to all types)

## How to use this skeleton for your SN App

### Configuring your ServiceNow dev instance to work with this skeleton project
There are two update sets that are needed for this project to work with your dev instances.  It relies on a u_typescript field added to all tables that you will be writing typescript for (business rules, script includes, etc), 
as well as a scripted rest API for the automatic DTS generator to query schema for any tables it finds in your source files.  Neither of these update sets (or any other u_typescript fields) should move beyond your dev instances!

- Import the update set in integration\typescript_integration_udpate_set.xml  This adds a u_typescript field to the sys_script and sys_script_include tables for storing the typescript.
- The automatic dts generation requires a SN rest endpoint to query for the table schemas it finds in your ts files.  import the update set xml integration\restschema_update_set.xml (only works in Geneva or later).

### Source Control
Since SN natively integrates with GIT starting in Helsinki, you can extend any tables you are developing with a u_typescript field to store your typescript source so that it gets commited to your repo via SN, and you can track changes to those scripts.

### Adding a new script include, business rule, or other script file for development
When working on a new business rule or script include, first add it in the servicenow studio editor.  After you save the new item, come back to this project and run "gulp sn-pull", this will scan the ServiceNow Application for any script files and create them in your development environment under src\[tablename] folder.

Once the item is listed (example: "src\sys_script\foo.js"), change the extension to .ts and convert it to typescript.  When you are ready to upload the changes, run the gulp "push" task to upload both the transpiled javascript as well as your typescript source back into SN.

You should periodically sync or pull the application when working with other developers, to get the latest changes.  WARNING: This will overwrite any file you have in src\ folder with the version found in the ServiceNow application.  Be sure to upload any changes you have first, or save them off separately to re-apply if needed.

You can now commit this change inside SN as you normally would in your development process to save both the typescript and js.  At any time you can delete the src\ folder and run gulp task "sync" to re-sync with whats in servicenow!  If you do not wish to use typescript, leave the file as a .js extension and develop as your normally would.

### DTS Generation
As you write your code, any GlideRecord('[table_name]') source you create can be automatically scanned for typings generation by running the "gulp dts" task (automatically run by the "sync" task also).  This task will scan all .ts files in the src\ folder and detect any GlideRecord references.  

If you wish to manually add a reference to a table that may not be used via GlideRecord call, then add this to the top of your ts file and comma separate multiple table names:
```javsacript
\\\<dts>tablename1,tablename2</dts>
```

A ServiceNow DTS is maintained at https://github.com/bryceg/servicenow-dts

## Adding new tables for development
Configure servicenowconfig types variable with the new servicenow types:
```javascript
 types: {
   my_new_type: {js: 'js_field_name', ts: 'typescript_field_name'}
 }
```

## Gulp Tasks Usage

### gulp dts
Generates a servicenow.d.ts file from the servicenowconfig dts section.  This will scan all .ts files and locate any type references for GlideRecords.

### gulp pull
Syncronizes your environment with the ServiceNow application specified in your config file.  Similar to "git pull"

WARNING: This will overwrite any src files your have not uploaded to SN yet, so be sure to run sn-pull first or prepare for any edited files to be overwritten!

### gulp push
Compliles any typescript to javascript and uploads the results to the application

### gulp sync
Runs gulp sn-pull and dts tasks

WARNING: See gulp pull task
