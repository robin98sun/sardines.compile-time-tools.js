import * as semver from 'semver'
import { utils } from 'sardines-core'
import { exec, unifiedExec, Version } from './utils'

const isGitInstalled = async (): Promise<boolean> => {
    try {
        const res = await exec('which git')
        if (res.stdout) return true
    } catch (e) {
        return false
    }
    return false
}

export const getVersionTag = (version: string): string => {
    return `sardines-v${version}`
}

export const getLatestVersion = async (verbose: boolean = false): Promise<string> => {
    // get versions
    let latestVersion = ''
    try {
        let res = await unifiedExec({verbose, cmd: `git tag -l sardines-v*`})
        for (let line of res.stdout.split('\n')) {
            if (!line) continue
            const parts = line.split('-v')
            if (parts.length >=2) {
                const v = parts[1]
                if (!latestVersion || semver.gt(v, latestVersion)) latestVersion = v
            }
        }
        if (verbose) {
            console.log('last version:', latestVersion)
        }
    } catch (e) {
        if (verbose) {
            console.error('ERROR while getting current version using git:', utils.inspect(e))
        }
    }
    
    return latestVersion
}

export const GitVersioning = async (params:any = {}): Promise<Version> => {
    let {
        remote, branch, doCommit, tag, tagMsg,
        version, patch, minor, major, commit, verbose
    } = Object.assign({
        remote: 'dev', branch: 'sardines', doCommit: false, tag: '', tagMsg: 'sardines publisher automatic tag',
        version: '0.0.1', patch: true, minor: false, major: false,
        commit: 'sardines publisher automatic commit', verbose: true
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

    // get latest version
    const latestVersion = await getLatestVersion(verbose)
    let currentVersion = ''
    
    if (latestVersion && version === '0.0.1') {
        if (!semver.valid(latestVersion)) {
            throw utils.unifyErrMesg(`latest version [${latestVersion}] is not valid`, 'sardines', 'versioning')
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
                if (verbose) console.warn(e.error.stdout)
                // doCommit = false
            } else {
                throw e
            }
        }
        if (doCommit) {
            try {
                await unifiedExec({verbose, cmd: `git tag -a ${getVersionTag(currentVersion)} -m "${tagMsg}"`})
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
        tag: getVersionTag(doCommit?currentVersion:latestVersion),
        branch: remoteBranch?branch:'', 
        git: originAddr,
        isNew: doCommit
    }
}