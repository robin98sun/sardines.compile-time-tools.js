// import * as utils from 'sardines-utils'
import * as utils from 'sardines-utils'
import {
    loginRepository, signUpRepository,
    createOrUpdateSource,
    createOrUpdateApplication,
    createOrUpdateService
} from './utils'
import * as fs from 'fs'
export { npmCmd } from './utils'
import { GitVersioning } from '../versioning'
import { exit } from 'process'
import * as path from 'path'


export interface PublisherArguments {
    url?: string
    username: string
    password: string
    executableCodeDir?: string
    serviceDefinitionFile?: string
    patch?: boolean
    minor?: boolean
    major?: boolean
    version?: string
    tag?: string
    tagMsg?: string
    commit?: string,
    remote?: string,
    branch?: string,
    verbose?: boolean
}

export const publish = async (args: PublisherArguments) => {
    let { url, username, password, executableCodeDir, serviceDefinitionFile,
        patch, minor, major, version, tag, tagMsg, commit,
        remote, branch, verbose, isPublic
    } = Object.assign({
        url: 'http://localhost:8080',
        executableCodeDir: './lib',
        serviceDefinitionFile: './sardines.json',
        verbose: false,
        patch: true,
        minor: false,
        major: false,
        remote: 'origin',
        branch: 'sardines',
        isPublic: true,
        version: '0.0.1',
        tagMsg: 'sardines publisher automatic tag',
        commit: 'sardines publisher automatic commit'
    }, args)
    
    // Process the service definition file
    if (!serviceDefinitionFile) {
        throw utils.unifyErrMesg('Can not publish service without its definition')
    }
    let serviceDefinitions:any = null
    try {
        serviceDefinitions = JSON.parse(fs.readFileSync(serviceDefinitionFile).toString())
    } catch (e) {
        throw utils.unifyErrMesg(`ERROR when trying to read service definition file [${serviceDefinitionFile}]`, 'sardines', 'publisher')
    }
    if (!serviceDefinitions) {
        throw utils.unifyErrMesg(`Service definition file [${serviceDefinitionFile}] is empty`, 'sardines', 'publisher')
    }

    const { application, services } = serviceDefinitions
    if (!application || typeof application !== 'string') {
        throw utils.unifyErrMesg(`Application name is missing in the service definition file`)
    }

    if (!services || !Array.isArray(services) || services.length <= 0) {
        throw utils.unifyErrMesg(`Services are not found in the service definition file`)
    }

    // Check the executable code dir
    if (!executableCodeDir) {
        throw utils.unifyErrMesg('Can not publish executable code without its directory path', 'sardines', 'publisher')
    }

    // Get and set git version
    if (verbose) {
        console.log('')
        console.log('')
        console.log('versioning...')
        console.log('')
    }
    const currentVersion = await GitVersioning({
        patch, minor, major, version, tag, tagMsg, commit,
        remote, branch, 
        verbose,
        doCommit: true
    })
    if (verbose) {
        console.log('')
        console.log('versioning finished')
        console.log('')
        console.log('')
    }
    if (!currentVersion.isNew) {
        console.log('Nothing to do with the source code')
        exit(0)
    }

    // Sign in or sign up
    let token: any = await loginRepository(url, username, password)
    if (token && typeof token === 'object' && token.error) {
        token = await signUpRepository(url, username, password)
        if (token && typeof token === 'object' && token.error){
            throw token
        }
    } 
    if (verbose) {
        console.log('token:', token)
    }

    // Update application info 
    // interface Application {
    //     id?: string
    //     name?: string
    //     is_public?: boolean
    //     owner?: string
    //     developers?: string[]
    //     last_access_on?: any
    // }
    const appInDB = await createOrUpdateApplication(url, {name: application}, token)
    if (verbose) {
        console.log('app:', appInDB)
    }

    // Create or update source
    // enum SourceType {
    //     git = 'git'
    // }
    
    // interface Source {
    //     id?: string
    //     type: string
    //     URL: string
    //     root: string
    //     last_access_on?: any
    // }
    const source: any = {
        type: 'git',
        root: executableCodeDir,
        URL: currentVersion.git
    }
    let sourceInDB = await createOrUpdateSource(url, source, token)
    if (verbose) {
        console.log('source:', sourceInDB)
    }

    // Create or update services
    // interface Service {
    //     id?: string
    //     application?: string
    //     application_id?: string
    //     module: string
    //     name: string
    //     arguments: ServiceArgument[]
    //     return_type: string
    //     is_async: boolean
    //     version?: string
    //     source_id?: string
    //     is_public?: boolean
    //     owner?: string
    //     developers?: string[]
    //     provider_settings?: any[]
    //     init_params?: any
    // }


    const serviceList = services.map((serv: any) => {
        let p = path.resolve(executableCodeDir, './' + serv.filepath)
        let extname = path.extname(p)
        let realExtName = extname
        if (extname === '.ts' && !fs.existsSync(p)) {
            p = path.resolve(path.dirname(p), './' + path.basename(p, extname) + '.js')
            realExtName = '.js'
        }
        if (fs.existsSync(p) && fs.lstatSync(p).isFile()) {
            return {
                application_id: appInDB.id,
                module: serv.module,
                name: serv.name,
                arguments: serv.arguments,
                return_type: serv.returnType,
                is_async: serv.isAsync,
                version: currentVersion.version,
                source_id: sourceInDB.id,
                is_public: isPublic,
                file_path: (realExtName === extname) 
                            ? serv.filepath 
                            : path.basename(serv.filepath, extname) + realExtName
            }
        } else {
            throw utils.unifyErrMesg(`Code file does not exist at [${p}] for service [${application}:${serv.module}/${serv.name}:${currentVersion.version}]`, 'sardines', 'publisher')
        }
    })

    if (verbose) {
        console.log('services to upload:')
        utils.inspectedLog(serviceList)
    }
    const res = await createOrUpdateService(url, serviceList, token)
    if (verbose) {
        console.log('created or updated services:')
        utils.inspectedLog(res)
    }
    return res
}


