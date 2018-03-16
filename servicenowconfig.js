module.exports = {
    uri: 'https://[[INSTANCE]].service-now.com',
    application: '[[APPLICATION_SYS_ID]]',
    mapping: 'snsyncmapping.json',
    tsconfig: 'tsconfig.json',
    tsfiles: 'src/**/*.ts',
    src: 'src/',
    out: 'dist/',
    types: {
        'sys_script': {
            script: { type: 'js', ts_field: 'u_typescript' }
        },
        'sys_script_include': {
            script: { type: 'js', ts_field: 'u_typescript' }
        },
        'sys_ui_macro': {
            xml: { type: 'html' }
        },
        'sys_ws_operation': {
            operation_script: { type: 'js', ts_field: 'u_typescript' }
        },
        'sysauto_script': {
            script: { type: 'js', ts_field: 'u_typescript' }
        },
        'sys_ui_action': {
            script: { type: 'js', ts_field: 'u_typescript' }
        },
        'sys_ui_page': {
            html: { type: 'html' },
            processing_script: { type: 'js', ts_field: 'u_processing_script_typescript' },
            client_script: { type: 'js', ts_field: 'u_client_script_typescript' }
        },
        'content_css': {
            style: { type: 'css'}
        },
        'sys_ui_script': {
            script: { type: 'js'}
        }
    },
    dts: {
        appdts: 'typings\\application.d.ts',
        sndts: 'typings\\servicenow.d.ts',
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
