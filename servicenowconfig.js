module.exports = {
    uri: 'https://dev17466.service-now.com',
    application: '42d031e2db6616001a1ada11cf9619b3',
    mapping: 'snsyncmapping.json',
    dev_integration_endpoint: '/api/11527/dev_integration/',
    types: {
        'sys_script': {js: 'script', ts: 'u_typescript'}, 
        'sys_script_include': {js: 'script', ts: 'u_typescript'}
    },
    auth: {
        user: '',
        password: ''
    },
    dts: {
        path: 'typings/servicenow.d.ts',
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