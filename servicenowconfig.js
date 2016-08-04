module.exports = {
    uri: 'https://[INSTANCE].service-now.com',
    application: '[APP_ID]',
    mapping: 'snsyncmapping.json',
    dev_integration_endpoint: '/api/11527/dev_integration/',
    types: {
        'sys_script': {js: 'script', ts: 'u_typescript'},
        'sys_script_include': {js: 'script', ts: 'u_typescript'},
        'sysauto_script': {js: 'script', ts: 'u_typescript'},
        'sys_ws_operation': {js: 'operation_script', ts: 'u_typescript'}
    },
    auth: {
        user: '',
        password: ''
    },
    dts: {
        appdts: 'typings/application.d.ts',
        sndts: 'typings/servicenow.d.ts',
        refs: [
            'index.d.ts'
        ],
        ignoreFields: [
            'sys_id',
            'sys_created_on',
            'sys_created_by',
            'sys_updated_on',
            'sys_updated_by',
            'sys_mod_count'
        ]
    }
}
