module.exports = {
    uri: 'https://[INSTANCE].service-now.com',
    application: '[APPLICATION_SYS_ID]',
    mapping: 'snsyncmapping.json',
    types: {
        'sys_script': {js: 'script', ts: 'u_typescript'},
        'sys_script_include': {js: 'script', ts: 'u_typescript'},
        'sys_ui_macro': {html: 'xml'},
        'sys_ws_operation': {js: 'operation_script', ts: 'u_typescript'},
        'sysauto_script': {js: 'script', ts: 'u_typescript'},
        'sys_ui_action': {js: 'script', ts: 'u_typescript'}
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
