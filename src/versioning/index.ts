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

interface ExecResult {
    stdout: string
    stderr: string
    code: number
}

const exec = async (cmd: string, log: boolean = false): Promise<ExecResult> => {
    return new Promise((resolve, reject) => {
        if (!cmd) reject('command is empty')
        const cmdParts = cmd.split(' ')
        const programName = cmdParts.shift()
        const p = spawn(programName!, cmdParts)
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

const unifiedExec = async (cmd: string, type:string, subType: string, msg:string = '', verbose: boolean = true) => {
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

export interface GitProcessParams {
    remote?: string
    branch?: string
    doCommit?: boolean
    tag?: string
    commit?: string
    verbose?: boolean
}
export const gitProcess = async (params:GitProcessParams = {}): Promise<string> => {
    let {remote, branch, doCommit, tag, commit, verbose} = Object.assign({
        remote: 'dev', branch: 'sardines', doCommit: false, tag: '', commit: '', verbose: true
    }, params)
    if (!await isGitInstalled) throw utils.unifyErrMesg('git is not installed', 'sardines', 'versioning')
    let res:any = null
    res = await unifiedExec(`git fetch ${remote}`, 'sardines', 'versioning', 'git is not used under current directory')

    res = await unifiedExec('git remote -v', 'sardines', 'versioning')
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

    // checkout branch
    res = await unifiedExec('git branch -a', 'sardines', 'versioning')
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
    if (!localBranch && remoteBranch) {
        await unifiedExec(`git pull ${remote} ${branch}`, 'sardines', 'versioning')
    }
    if (!localBranch && !remoteBranch) {
        await unifiedExec(`git checkout -b ${branch}`, 'sardines', 'versioning')
    } else if (branch !== currentBranch) {
        await unifiedExec(`git checkout ${branch}`, 'sardines', 'versioning')
    }

    

    // versioning
    console.log('input tag:', tag)
    res = await unifiedExec(`git tag -l "sardines-version:*"`,'sardines', 'versioning')
    let latestVersion = '', currentVersion = ''
    for (let line of res.stdout.split('\n')) {
        if (!line) continue
        const parts = line.split(':')
        if (parts.length >=2) {
            latestVersion = parts[1]
        }
    }
    if (latestVersion) {
        console.log('latest version:', latestVersion)
    } else {
        currentVersion = '0.0.1'
    }

    // Push
    if (doCommit && currentVersion) {
        // Commit
        await unifiedExec(`git add .`,'sardines', 'versioning')
        await unifiedExec(`git commit -m "${commit?commit:'sardines publisher automatic commit'}"`,'sardines', 'versioning')
        await unifiedExec(`git tag -a sardines-version:${currentVersion} ${commit?'-m "'+commit+'"':''}`, 'sardines', 'versioning')
        await unifiedExec(`git push ${remote} ${branch}`,'sardines', 'versioning')
    }

    // return to current working branch
    await unifiedExec(`git checkout ${currentBranch}`, 'sardines', 'publisher')

    return ''
}

gitProcess({remote: 'dev', doCommit: true}).then(res => {
    console.log('\nfinal result:', res)
}).catch(e => {
    console.log('error:', e)
})
