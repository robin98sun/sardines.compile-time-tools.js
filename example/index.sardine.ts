import { 
    Storage, 
    Storage as TEstStorage,
    StorageSettings, 
    StorageSettings as TEstStSt,
    PostgresDatabaseStructure 
} from '../builtin_services/storage'
import * as utils from 'sardines-utils'

export { Storage, StorageSettings as XYZSettings } from '../builtin_services/storage'

const postgresDBStruct: PostgresDatabaseStructure = {
    service: {
        id: 'UUID PRIMARY KEY DEFAULT uuid_generate_v4()',
        create_on: 'TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP',
        last_access_on: 'TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP',
        owner: 'VARCHAR(30)',
        name: 'VARCHAR(30)',
        version: 'VARCHAR(20)',
        source: 'VARCHAR(300)',
        provider_settings: 'JSONB', // Array, enlist all possible provider/driver pairs and provider settings
        init_params: 'JSONB',   // service used init parameters
        UNIQUE: ['owner', 'name', 'version']
    }
}

export interface ServiceSettings {
    owner: string
    name: string
    version: string
    source: string
    provider_settings?: any[]
    init_params?: any
}

export interface ServiceIdentity {
    owner: string
    name: string
    version?: string
}


export interface RepositorySettings {
    storage: StorageSettings
}

class Repository {
    private store: any;

    constructor(repoSettings: RepositorySettings) {
        this.store = new Storage(repoSettings.storage, postgresDBStruct)
    }

    async registerService(serviceSettings: ServiceSettings) {
        let res = await this.queryService({ owner: serviceSettings.owner, name: serviceSettings.name, version: serviceSettings.version})
        if (res) {
            throw utils.unifyErrMesg(`service [${serviceSettings.owner}/${serviceSettings.name}@${serviceSettings.version}] already exists`, utils.logo, 'repository')
        }
        res = await this.store.set('service', serviceSettings)
        if (res.rowCount === 1) return true
        else throw utils.unifyErrMesg(`Failed to store service [${serviceSettings.owner}/${serviceSettings.name}@${serviceSettings.version}]`, utils.logo, 'repository')
    }

    async queryService(identity: ServiceIdentity) {
        const res = await this.store.get('service', identity)
        if (res) {
            let serviceList = []
            if (!Array.isArray(res)) serviceList.push({id: res.id})
            else serviceList = res.map((item:any) => ({id: item.id}))
            for (let service of serviceList) {
                await this.store.set('service', {last_access_on: 'CURRENT_TIMESTAMP'}, service)
            }
        }
        return res
    }
}

export async function someFunc(settings: RepositorySettings, others: any[] = []) {
    console.log(settings)
}

export const someArrowFunc = async (settings: RepositorySettings[]|RepositorySettings|null):Promise<RepositorySettings> =>  {
    console.log(settings)
}

const someOtherFunc = function(settings: RepositorySettings):RepositorySettings {
    console.log(settings)
}

export const t = async (s: TEstStSt) => {
    console.log(s)
}

export const x = someOtherFunc // VariableStatement

// export const y = Repository     // VariableStatement

export const z = someArrowFunc // VariableStatement

const obj = {
    x: someArrowFunc,
    y: Repository,
    z: someFunc,
}

// export default {
//     a: someArrowFunc,
//     b: Repository,
//     c: someFunc,
//     e: 'abc',
//     f: 123,
//     g: [],
//     h: [1, 2, 3],
//     obj,
//     handler: () => {}
// }

