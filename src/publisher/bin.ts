import { utils } from 'sardines-core'
import { publish } from './index'
import * as proc from 'process'
import * as fs from 'fs'

let {params} = utils.parseArgs()
if (params.test) {
    publish({
        // url: 'http://localhost:8080',
        // username: 'dietitian-dev',
        // password: 'Startup@2019'
    })
}

if (params.help) {
    console.log(`
    --config                  : set the sardines config file, default is ./sardines-config.json
    --private                 : set the service as private, default is false
    --local=<path>            : Service definition file path, default is './sardines-local-services.json'
    --patch                   : Increase patch number of version, default is true
    --minor                   : Increase minor number of version, default is false
    --major                   : Increase major number of version, default is false
    --version=<ver>           : set the version number, format is 'major.minor.patch'
    --tag=<tag name>          : set the additional git tag, must be used together with --tagMsg
    --tagMsg=<tag message>    : set the tag/version message of git
    --commit=<commit message> : set the git commit message of this version
    --git-remote=<remote name>: select the git remote, default is 'origin'
    --git-branch=<branch name>: select the git branch to store version information, default is 'sardines'
    --verbose                 : verbose mode, log everything on the stdout
    `)
    // --exe-dir=<dir>           : Directory path of the executable code files, default is './lib'
    // --repo=<repo url>         : Url of repository, default is 'http://localhost:8080'
    // --user=<user name>        : User of repository, required, the user would be signed up if does not exist
    // --pass=<password>         : Password of the user, required
    proc.exit(0)
}

// const repo = params.repo ? params.repo : 'http://localhost:8080'
// const repo = params.repo
// const user = params.user
// const pass = params.pass
// const exeDir = params['exe-dir'] ? params['exe-dir'] : './lib'
// const exeDir = params['exe-dir']
const serviceDefinitionFile = params['local'] ? params['local'] : './sardines-local-services.json'
const sardinesConfigFile = params['config'] ? params['config'] : './sardines-config.json'

// if (!user) {
//     console.error('Repository user name is missing')
//     proc.exit(1)
// }

// if (!pass) {
//     console.error('Repository password is missing')
//     proc.exit(1)
// }

// if (!fs.existsSync(exeDir)) {
//     console.error(`Executable code directory [${exeDir}] does not exist`)
//     proc.exit(1)
// }

// if (!fs.lstatSync(exeDir).isDirectory()) {
//     console.error(`Executable code directory [${exeDir}] is not a valid directory`)
//     proc.exit(1)
// }

if (!fs.existsSync(serviceDefinitionFile)) {
    console.error(`Service definition file [${serviceDefinitionFile}] does not exist`)
    proc.exit(1)
}

if (!fs.lstatSync(serviceDefinitionFile).isFile()) {
    console.error(`Service definition file [${serviceDefinitionFile}] is not a valid file`)
    proc.exit(1)
}



const args: any = {
    // url: repo,
    // username: user,
    // password: pass,
    // executableCodeDir: exeDir,
    serviceDefinitionFile,
    sardinesConfigFile,
    // major: (params['major']),
    // minor: (params['minor']),
    // patch: (params['patch']),
    // version: params['version'],
    // tag: params['tag'],
    // tagMsg: params['tagMsg'],
    // commit: params['commit'],
    // remote: params['git-remote'],
    // branch: params['git-branch'],
    // verbose: params['verbose']
    // isPublic: !params['private']
}
if (typeof params['major'] === 'boolean') args.major = params['major']
if (typeof params['minor'] === 'boolean') args.minor = params['minor']
if (typeof params['patch'] === 'boolean') args.patch = params['patch']
if (typeof params['version'] === 'string') args.version = params['version']
if (typeof params['tag'] === 'string') args.tag = params['tag']
if (typeof params['tagMsg'] === 'string') args.tagMsg = params['tagMsg']
if (typeof params['commit'] === 'string') args.commit = params['commit']
if (typeof params['git-remote'] === 'string') args.remote= params['git-remote']
if (typeof params['git-branch'] === 'string') args.branch= params['git-branch']
if (typeof params['verbose'] === 'boolean') args.verbose= params['verbose']
if (typeof params['private'] === 'boolean') args.isPublic = !params['private']

publish(args).then(res => {
    console.log(`successfully published ${res.length} services`)
}).catch(e => {
    console.error(`error when publishing:`, e)
})