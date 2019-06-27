/**
 * @author Robin Sun
 * @email robin@naturewake.com
 * @create date 2019-06-25 15:12:48
 * @modify date 2019-06-25 15:12:48
 * @desc Checkout sardines branch and create a commit with git tags, 
 *          which are specified by the command line parameters, including:
 *          a custom tag
 *          a version tag
 *          if these parameters are omitted, then use default version tag
 *           and omit the custom tag
 *          Default version tag: start from 0.0.0, automatically increase 
 *           the miner version number, 
 *           others are mutable for custom version parameter
 */

import { spawn } from 'child_process'
import * as utils from 'sardines-utils'
import * as semver from 'semver'

interface ExecResult {
    stdout: string
    stderr: string
    code: number
}

const concatStrings = (cmdParts: string[]): string[] => {
    let result: string[] = []
    let inString = -1 
    for (let i=0; i<cmdParts.length;i++) {
        let p = cmdParts[i]
        if (inString < 0 && p[0] === '"' && p[p.length-1] !== '"') {
            inString = i
        } else if (inString >=0 && p[0] !== '"' && p[p.length-1] === '"') {
            result.push(cmdParts.slice(inString, i+1).join(' '))
            inString = -1
        } else if (inString < 0 && p.length > 0) {
            result.push(p)
        }
    }
    return result
}

const exec = async (cmd: string, log: boolean = false): Promise<ExecResult> => {
    return new Promise((resolve, reject) => {
        if (!cmd) reject('command is empty')
        const cmdParts = cmd.split(' ')
        const programName = cmdParts.shift()

        // console.log(`executing command ${programName}, args:`, concatStrings(cmdParts))
        const p = spawn(programName!, concatStrings(cmdParts))
        let stdout = '', stderr = ''
        p.stdout.on('data', (data) => {
            if (log) console.log(data.toString())
            stdout += data.toString()
        })
        p.stderr.on('error', (e) => {
            if (log) console.error(e.toString())
            stderr += e.toString()
        })
        p.on('exit', (code) => {
            if (code === 0) {
                resolve({stdout, stderr, code})
            } else {
                reject({stdout, stderr, code})
            }
        })
    })
}

const unifiedExec = async (params: {cmd: string, type?:string, subType?: string, msg?:string, verbose?: boolean}) => {
    const {cmd, type, subType, msg, verbose} = Object.assign({
        msg: '',
        verbose: false,
        type: 'sardines',
        subType: 'versioning'
    },params)
    try {
        const res = await exec(cmd)
        if (verbose) console.log(cmd)
        if (verbose) console.log(res.stdout)
        return res
    } catch (e) {
        if (verbose) console.error(`ERROR when executing command [${cmd}]:`, e)
        throw utils.unifyErrMesg(msg?msg:e, type, subType)
    }
}

export const isGitInstalled = async (): Promise<boolean> => {
    try {
        const res = await exec('which git')
        if (res.stdout) return true
    } catch (e) {
        return false
    }
    return false
}

export interface VersioningArguments {
    remote?: string
    branch?: string
    doCommit?: boolean
    tag?: string
    tagMsg?: string
    version?: string
    commit?: string
    verbose?: boolean
}

export interface Version {
    version: string
    tag: string
    branch: string
    git: string
    isNew?: boolean
}
export const versioning = async (params:VersioningArguments = {}): Promise<Version> => {
    let {
        remote, branch, doCommit, tag, tagMsg,
        version, patch, minor, major, commit, verbose
    } = Object.assign({
        remote: 'dev', branch: 'sardines', doCommit: false, tag: '', tagMsg: '',
        version: '0.0.1', patch: true, minor: false, major: false,
        commit: '', verbose: true
    }, params)
    if (!await isGitInstalled) throw utils.unifyErrMesg('git is not installed', 'sardines', 'versioning')
    let res:any = null
    res = await unifiedExec({
        cmd: `git fetch ${remote}`,
        type: 'sardines',
        subType: 'versioning',
        msg: 'git is not used under current directory'
    })

    res = await unifiedExec({verbose, cmd: 'git remote -v'})
    if (!res.stdout) throw utils.unifyErrMesg('git remote is not set', 'sardines', 'versioning')
    let lines = res.stdout.split('\n')

    // get remote origin push address
    let originAddr = '', originName = ''
    for (let line of lines) {
        if (!line) continue
        const parts = line.replace(/\t+/g, ' ').replace(/ +/g, ' ').split(' ')
        if (parts.length !== 3) continue
        const remoteName = parts[0]
        const remoteAddr = parts[1]
        const remoteRole = parts[2].replace(/[\(|\)]/g, '')
        if (remoteName.toLowerCase() === remote && remoteRole === 'push') {
            originAddr = remoteAddr
            originName = remoteName
            break
        } else if (!originAddr && remoteRole === 'push') {
            originAddr = remoteAddr
            originName = remoteName
        }
    }

    if (!originAddr) throw utils.unifyErrMesg('Can not find git remote push address', 'sardines', 'versioning')
    if (verbose) console.log('remote push addr:', originAddr, ', remote name:', originName)

    // get current branch
    res = await unifiedExec({verbose, cmd: 'git branch -a'})
    lines = res.stdout.split('\n')
    let localBranch = '', remoteBranch = '', currentBranch = ''
    for (let line of lines) {
        if (!line) continue
        let b = line.replace(/ +/g, '')
        if (b[0] === '*') {
            b = b.substr(1)
            currentBranch = b
        }
        if (b === branch) localBranch = b
        else if (b.indexOf('remotes/') === 0) {
            b = b.replace('remotes/', '')
            let parts = b.split('/')
            if (parts.length >= 2) {
                const remoteName = parts.shift()
                const rb = parts.join('/')
                if (remoteName === remote && rb === branch) {
                    remoteBranch = rb
                }
            }
        }
    }

    // get versions
    res = await unifiedExec({verbose, cmd: `git tag -l sardines-v*`})
    let latestVersion = '', currentVersion = ''
    for (let line of res.stdout.split('\n')) {
        if (!line) continue
        const parts = line.split('-v')
        if (parts.length >=2) {
            const v = parts[1]
            if (!latestVersion || semver.gt(v, latestVersion)) latestVersion = v
        }
    }

    if (latestVersion && version === '0.0.1') {
        if (!semver.valid(latestVersion)) {
            throw utils.unifyErrMesg(`latest version ${latestVersion} is not valid`, 'sardines', 'versioning')
        }
        let v: string|null= latestVersion
        if (v && patch) v = semver.inc(v, 'patch')
        if (v && minor) v = semver.inc(v, 'minor')
        if (v && major) v = semver.inc(v, 'major')
        if (v) currentVersion = v
        else throw utils.unifyErrMesg(`can not increase patch number of latest version ${latestVersion}`, 'sardines', 'versioning')
    } else {
        currentVersion = version
    }

    if (!semver.valid(currentVersion)) {
        throw utils.unifyErrMesg(`current version ${currentVersion} is not valid`, 'sardines', 'versioning')
    }

    // commit
    if (doCommit && currentVersion) {
        const commitMsg = `${commit?commit:'sardines publisher automatic commit'}`
        await unifiedExec({verbose, cmd: `git add .`})
        try {
            await unifiedExec({verbose, cmd: `git commit -m "${commitMsg}"`})
        } catch (e) {
            if (e && e.error && e.error.stdout && e.error.stdout.indexOf('nothing to commit, working tree clean')) {
                doCommit = false
            } else {
                throw e
            }
        }
        if (doCommit) {
            try {
                await unifiedExec({verbose, cmd: `git tag -a sardines-v${currentVersion} -m "${commitMsg}"`})
            } catch (e) {
                if (e.code === 128 || (e.error && e.error.code === 128)) {
                    doCommit = false
                    throw utils.unifyErrMesg(`sardine version [${currentVersion}] already exists`, 'sardines', 'versioning')
                } else throw e
            }

            if (tag && tagMsg) {
                try {
                    await unifiedExec({verbose, cmd: `git tag -a ${tag} -m "${tagMsg}"`})
                } catch (e) {
                    if (e.code === 128 || (e.error && e.error.code === 128)) {
                        doCommit = false
                        throw utils.unifyErrMesg(`sardine version [${currentVersion}] already exists`, 'sardines', 'versioning')
                    } else throw e
                }
            }
        }   
    }

    if (doCommit && currentVersion) {
        // checkout sardines branch
        if (!localBranch && !remoteBranch) {
            await unifiedExec({verbose, cmd: `git checkout -b ${branch}`})
        } else if (branch !== currentBranch) {
            await unifiedExec({verbose, cmd: `git checkout ${branch}`})
        }
        if (remoteBranch) {
            await unifiedExec({verbose, cmd: `git pull ${remote} ${branch}`})
        }

        await unifiedExec({verbose, cmd: `git merge ${currentBranch}`})
        // Push
        await unifiedExec({verbose, cmd: `git push ${remote} ${branch}`})
    }

    // return to current working branch
    await unifiedExec({verbose, cmd: `git checkout ${currentBranch}`})

    return {
        version: doCommit?currentVersion:latestVersion,
        tag: `sardines-v${doCommit?currentVersion:latestVersion}`,
        branch: remoteBranch?branch:'', 
        git: originAddr,
        isNew: doCommit
    }
}

// Test
versioning({remote: 'dev', doCommit: true, verbose: false}).then(res => {
    console.log('\nfinal result:', res)
}).catch(e => {
    console.log('error:', e)
})
