/**
 * @author Robin Sun
 * @email robin@naturewake.com
 * @create date 2019-08-02 11:51:54
 * @modify date 2019-08-02 11:51:54
 * @desc [description]
 */

import * as npm from 'npm'
import { Sardines } from 'sardines-core'
import { utils } from 'sardines-core'
import * as fs from 'fs' 
import * as path from 'path'
import * as git from 'simple-git/promise'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export namespace Source {
    // execute command line
    export const execCmd = async function (cmd: string) {
        const {stdout, stderr} = await execAsync(cmd);
        if (stderr) throw stderr
        return stdout
    }
    // Npm
    let npmInst: any = null
    export const npmCmd = (command: string, args: string[]) => {
        return new Promise((resolve, reject) => {
            const cmd = () => {
                (<{[key: string]: any}>(npmInst.commands))[command](args, (err:any, data: any) => {
                    if (err) {
                        reject(err)
                    } else {
                        resolve(data)
                    }
                })
            }
            if (!npmInst) {
                npm.load((err, inst) => {
                    if (err) reject(err)
                    else {
                        // console.log('npm load data:', data)
                        npmInst = inst
                        cmd()
                    }
                })
            } else {
                cmd()
            }
        })
    }

    export const requirePackage = async (packName: string) => {
        const packageDir = path.resolve(`node_modules/${packName}`)
        if (!fs.existsSync(packageDir)) {
            throw `Can not access package [${packName}] directory at [${packageDir}]`
        }
        const packageConfigFile = path.resolve(`${packageDir}/package.json`)
        if (!fs.existsSync(packageConfigFile)) {
            throw `Can not access package.json file for package [${packName}] at [${packageConfigFile}]`
        }
        let packageConfig: any = null
        try {
            packageConfig = JSON.parse(fs.readFileSync(packageConfigFile).toString())
            if (!packageConfig) throw ''
        } catch (e) {
            throw `Can not parse package.json file for package [${packName}]`
        }
        if (packageConfig && !packageConfig.main) {
            throw `Invalid package.json file for package [${packName}]`
        }
        const mainFileName = packageConfig.main
        const mainFilePath = path.resolve(`${packageDir}/${mainFileName}`)
        if (!fs.existsSync(mainFilePath)) {
            throw `Can not access entrance file for package [${packName}] at [${mainFilePath}]`
        }
        const packageInst: any = require(mainFilePath)
        if (packageInst) return packageInst
        else {
            throw utils.unifyErrMesg(`Invalid package [${packName}]`, 'sourcing', 'npm')
        }
    }
    
    export const getPackageFromNpm = async (packName: string, locationType: Sardines.LocationType, verbose: boolean = false ) =>  {
        // check whether the package has been loaded already
        if (!fs.existsSync(`node_modules/${packName}`)) {
            // load the package if needed
            try {
                const type = locationType || Sardines.LocationType.npm
                switch (type) {
                case Sardines.LocationType.npm:
                    if (verbose) {
                        console.log('going to install package:', packName)
                    }
                    await npmCmd('install', [packName])
                    if (verbose) {
                        console.log('package:', packName, 'installed')
                    }
                    break
                case Sardines.LocationType.npm_link:
                    if (verbose) {
                        console.log('going to link package:', packName)
                    }
                    await npmCmd('link', [packName])
                    if (verbose) {
                        console.log('package:', packName, 'linked')
                    }
                    break
                case Sardines.LocationType.file:
                    break
                default:
                    break
                }
            } catch (e) {
                if (verbose) {
                    console.error(`ERROR when downloading npm package [${packName}]`)
                }
                throw utils.unifyErrMesg(`Error when downloading npm package [${packName}]: ${e}`, 'sourcing', 'npm')
            }
        }

        try {
            return await requirePackage(packName)
        } catch (e) {
            if (verbose) {
                console.error(`ERROR when importing npm package [${packName}]`)
            }
            throw utils.unifyErrMesg(`Error when importing npm package [${packName}]: ${e}`, 'sourcing', 'npm')
        }
    }

    // find the main js file in a package
    export const getMainFilePathOfPackage = (packageName: string, nodeModulesDir: string, targetDir: string): string => {
        let filepath = ''
        if (!packageName || !nodeModulesDir || !targetDir) return filepath

        const packageJsonFilepath = path.resolve(nodeModulesDir, `./${packageName}/package.json`)
        if (!fs.existsSync(packageJsonFilepath)) return filepath
        try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonFilepath).toString())
            if (!packageJson || !packageJson.main || typeof packageJson.main !== 'string') {
                throw 'Invalid package.json file, or invalid main section in it'
            }
            const mainfilepath = path.resolve(nodeModulesDir, './' + packageName + '/' + packageJson.main)
            filepath = path.relative(targetDir, mainfilepath)
        } catch (e) {
            console.error('ERROR while tring to find package main file of package:', packageName, ', in node_modules:', nodeModulesDir, ', error:', e)
        }
        return filepath
    }

    // Git
    export const getSourceFromGit = async(gitUrl:string, baseDir:string, options: { application?: string, branch?: string, tag?: string, version?: string, initWorkDir?: boolean, verbose?: boolean} = {}): Promise<string> => {
        if (!gitUrl) {
            throw utils.unifyErrMesg(`Empty git url`, 'sourcing', 'git')
        }
        let workRoot = baseDir ? baseDir : './'
        // parse git repository name from git url
        let urlParts = gitUrl.split('/')
        let repoName = ''
        if (urlParts.length > 1) {
            repoName = urlParts[urlParts.length-1]
            let repoNameParts = repoName.split('.')
            if (repoNameParts.length > 1 && repoNameParts[repoNameParts.length-1].toLowerCase() === 'git') {
                repoNameParts.pop()
                repoName = repoNameParts.join('.')
            } else {
                repoName = ''
            }
        }
        if (!repoName) {
            throw utils.unifyErrMesg(`Invalid git url: can not parse repository name`, 'sourcing', 'git')
        }
        // extend work root dir
        const appName = (options && options.application) ? options.application : repoName
        const version = (options && options.version) ? options.version : '*'
        workRoot = path.resolve(workRoot + '/', `./${appName}/${version}/`)

        // prepare work dir
        const workDir = path.resolve(`${workRoot}/`, `./${repoName}`)
        if (fs.existsSync(workDir)) {
            if (options && options.initWorkDir) {
                fs.rmdirSync(workDir, {recursive: true})
            } else {
                return workDir
            }
        }
        if (!fs.existsSync(workRoot)) {
            fs.mkdirSync(workRoot, {recursive: true})
        }

        // clone repository
        try {
            if (options && options.verbose) {
                console.log(`[source] going to git clone [${appName}@${version}] under dir ${workRoot}...`)
            }
            await git(workRoot).clone(gitUrl)
            if (!fs.existsSync(workDir)) {
                throw `git repository did not cloned to desired directory [${workDir}]`
            }
            let checkoutStr = ''
            if (options && options.version) checkoutStr = `sardines-v${options.version}`
            else if (options && options.branch) checkoutStr = options.branch
            else if (options && options.tag) checkoutStr = options.tag
            if (!checkoutStr) checkoutStr = 'master'
            await git(workDir).checkout(checkoutStr)

            if (options && options.verbose) {
                console.log(`[source] source code of [${appName}@${version}] has been cloned and checked out`)
            }

            if (options && options.verbose) {
                console.log(`[source] going to install node modules of [${appName}@${version}]...`)
            }
            const cmd = `cd ${workDir} && npm i && npm uninstall sardines-core && rm -rf node_modules/sardines-core`
            try {
                const stdout = await execCmd(cmd)
                if (options && options.verbose) {
                    console.log(`[source] node modules of [${appName}@${version}] have been installed using command [${cmd}]:`, stdout)
                }
            } catch (e) {
                if (options && options.verbose) {
                    console.error(`[source] Error when installing node modules of [${appName}@${version}] using command [${cmd}]:`, e)
                }
            }
        } catch (e) {
            throw utils.unifyErrMesg(e, 'sourcing', 'git')
        }
        return workDir
    }
}
