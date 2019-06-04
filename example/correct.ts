import * as origin from './correct.sardine'
import { RepositorySettings } from './correct.sardine'
import { StorageSettings as TEstStSt } from '../builtin_services/storage'
export { ServiceSettings } from './correct.sardine'
export { ServiceIdentity } from './correct.sardine'
export { RepositorySettings } from './correct.sardine'
export const someFunc = async (settings: RepositorySettings, others: any[] = []) => {
   return await origin.someFunc(settings, others)
}
export const someArrowFunc = async (settings: RepositorySettings[]|RepositorySettings|null) => {
   return await origin.someArrowFunc(settings)
}
export const t = async (s: TEstStSt) => {
   return await origin.t(s)
}
export const x = async (settings: RepositorySettings) => {
   return  origin.x(settings)
}
export const z = async (settings: RepositorySettings[]|RepositorySettings|null) => {
   return await origin.z(settings)
}
