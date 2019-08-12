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
import { Sardines } from 'sardines-core'
import { readSardinesConfigFile } from '../config'


// Parse the arguments
const {params, files} = utils.parseArgs()

const projectName = params['project'] ? params['project'] : ''

let sardinesConfig: Sardines.Config|null = null
try {
    let configFilePath = './sardines-config.json'
    if (params['config']) {
        configFilePath = params['config']
    }
    sardinesConfig = readSardinesConfigFile(configFilePath)
} catch (e) {
    if (params['config']) console.error(`ERROR when reading config file:`, e)
}


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

if (typeof params['application'] === 'string'){
    params.application = params['application']
} else if (sardinesConfig && sardinesConfig.application) {
    params.application = sardinesConfig.application
} else if (!params['reverse']) {
    console.error(`application name is missing`)
}
if (params.application && params.verbose) {
    console.log(`compiling service for application [${params['application']}]`)
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
    --config:           set sardines config file path, default is: './sardines-config.json'
    `)
}

compiler.compile(params, files)
