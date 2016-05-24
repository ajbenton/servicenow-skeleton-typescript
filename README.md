# servicenow-skeleton-typescript

## Initial Setup
- npm install
- npm install typings -g
- typings install

## Configure build/servicenow.js
- uri = path to your servicenow instance
- application = sys_id of the ServiceNow scoped application your are developing
- types = Entity types to sync from ServiceNow
-- types['typename'].js = Field on type to set the javascript source too
-- types['typename'].ts = Field on the type to set the typescript source too
- auth = user and password for running gulp tasks as (Uses basic auth, so needs to be a local account not SSO with priveledges to all types)
- dts.types = Array of servicenow types to generate typescript d.ts files for

## Gulp Tasks Usage

### gulp dts
Generates a servicenow.d.ts file from the servicenow config dts

### gulp sn-pull
Syncronizes your environment with the ServiceNow application specified in your config file.  Similar to "git pull"

### gulp sn-push
Compliles any typescript to javascript and uploads the results to the application

### gulp sn-sync
Runs gulp dts and sn-pull tasks
