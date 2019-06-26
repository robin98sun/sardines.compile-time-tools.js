import * as origin from './index.sardine'
import { RepositorySettings } from './index.sardine'
import { StorageSettings as TEstStSt } from '../builtin_services/storage'
export { Storage } from '../builtin_services/storage'
export { StorageSettings as XYZSettings } from '../builtin_services/storage'
export { ServiceSettings } from './index.sardine'
export { ServiceIdentity } from './index.sardine'
export { RepositorySettings } from './index.sardine'
export const someFunc = async (settings: RepositorySettings, others: any[] = []) => {
   return await origin.someFunc(settings, others)
}
export const someArrowFunc = async (settings: RepositorySettings[]|RepositorySettings|null) => {
   return await origin.someArrowFunc(settings)
}
export const t = async (s: TEstStSt) => {
   return await origin.t(s)
}
export const x =  (settings: RepositorySettings) => {
   return  origin.x(settings)
}
export const z = async (settings: RepositorySettings[]|RepositorySettings|null) => {
   return await origin.z(settings)
}