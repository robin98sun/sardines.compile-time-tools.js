/**
 * @author Robin Sun
 * @email robin@naturewake.com
 * @create date 2019-06-21 14:19:26
 * @modify date 2019-06-21 14:19:26
 * @desc [description]
 */
import { utils } from 'sardines-core'
import * as proc from 'process'
import * as compiler from './index'

// Parse the arguments
const {params, files} = utils.parseArgs()

const projectName = params['project'] ? params['project'] : ''

if (params['verbose']) {
    console.log(`processing files belong to project: ${projectName}`)
} else {
    params.verbose = false
}

if (params['print']) {
    params.print = true
} else {
    params.print = false
}

if (params['only-validate']) {
    if (params.verbose) console.log(`only to validate the files`)
    params.only_validate = true    
} else {
    params.only_validate = false
}

if (params['validate']) {
    if (params.verbose) console.log(`validate the files and halt whenever encounter an error`)
    params.validate = true    
} else {
    params.validate = false
}

if (params['recompile']) {
    if (params.verbose) console.log(`recompiling`)
    params.recompile = true
} else {
    params.recompile = false
}

if (params['reverse'] || params['undo']) {
    if (params.verbose) console.log(`undo previous compiled files`)
    params.reverse = true
} else {
    params.reverse = false
}

if (params['gen-services']) {
    let paramValue = params['gen-services']
    delete params['gen-services']
    if (typeof paramValue === 'string'){
        if(params.verbose) console.log(`going to generate service definition file at [${paramValue}]`)
    } else {
        paramValue = `${proc.cwd()}/sardines-local-services.json`
        if(params.verbose) console.log(`going to generate service definition file at [${paramValue}]`)
    }
    params.gen_services = paramValue
}

if (params['application']) {
    let paramValue = params['application']
    if (typeof paramValue === 'string'){
        params.application = paramValue
        if(params.verbose) console.log(`compiling service for application [${paramValue}]`)
    } else {
        console.error(`application name is missing`)
    }
}

if (params.verbose) {
    console.log('args for compiler:', params)
}

if (params['help']) {
    console.log(`sardines-compiler [--option]|[--option=value] <filepath|dir> <filepath|dir> ...
    --verbose:          log everything
    --print:            output compiled content on stdout
    --only-validate:    validate the source code but donot compile
    --validate:         compile the source code and halt when error is thrown out
    --recompile:        compile the source code even though it has been compiled
    --reverse:          undo the compile action
    --undo:             same as --reverse
    --gen-services:     generate service definition file, default file path is ./sardines_local_services.json.json
    --application:      set application name while generating service definition files
    `)
}

compiler.compile(params, files)
