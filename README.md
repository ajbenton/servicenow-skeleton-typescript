# servicenow-skeleton-typescript

## Initial Setup
- npm install
- npm install typings -g --save-dev

## Configuring your ServiceNow dev instance to work with this skeleton project
There are two update sets that are needed for this project to work with your dev instances.  It relies on a u_typescript field added to all tables that you will be writing typescript for (business rules, script includes, etc), 
as well as a scripted rest API for the automatic DTS generator to query schema for any tables it finds in your source files.  Neither of these update sets (or any other u_typescript fields) should move beyond your dev instances!

- Import the update set in integration\typescript_integration_udpate_set.xml  This adds a u_typescript field to the sys_script and sys_script_include tables for storing the typescript.
- The automatic dts generation requires a SN rest endpoint to query for the table schemas it finds in your ts files.  import the update set xml integration\restschema_update_set.xml (only works in Geneva or later).

## Configure servicenowconfig.js for your application
- uri = path to your servicenow instance
- application = sys_id of the ServiceNow scoped application your are developing
-- types['typename'].js = Field on type to set the javascript source too
-- types['typename'].ts = Field on the type to set the typescript source too
- auth = user and password for running gulp tasks as (Uses basic auth, so needs to be a local account not SSO with priveledges to all types)
- dts.resource = servicenow path to the scripted rest api that was created for dts generation described earlier.

## How to use this skeleton for your SN App
This skeleton project is designed to use your SN dev instance as your source control.  I highly recommend you use the built in source control integration offered in Helsinki when using this.  Since SN natively integrates with GIT, you can extend 
any tables you are developing with a u_typescript field to store your source so that it gets commited to source control via SN, and you can track changes to those scripts as you normally would via javascript development.

When working on a new business rule or script include, first add it in the servicenow studio editor.  After you save the new item, come back to this project and run "gulp sn-pull", this will scan the entire SN application and create matching files to any items it finds in the application.
Once the item is listed (example: "src\sys_script\foo.js"), change the extension to .ts and fix any typescript errors you find.  Then run "gulp sn-push" to upload both the transpiled javascript as well as your typescript source back into SN.  You can now commit this change inside SN as you normally would in your development process to save both the typescript and js.  At any time you can delete the src\ folder and run "gulp sn-pull" to re-sync with whats in servicenow!  If you do not wish to use typescript, leave the file as a .js extension and develop as your normally would.

As you write your code, any GlideRecord('[table_name]') source you create can be automatically scanned for d.ts generation by using the "gulp dts" task.  This task will scan all .ts files in the src\ folder and detect any GlideRecord references.  If you wish to manually add a reference 
to a table, then add this to the top of your ts file and comma separate multiple table names:
```javsacript
\\\<dts>tablename1,tablename2</dts>
```

A ServiceNow DTS is maintained at https://github.com/bryceg/servicenow-dts

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
