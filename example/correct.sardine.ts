import * as origin from './correct.sardines.ts'
export interface ServiceSettings {
    owner: string
    name: string
    version: string
    source: string
    provider_settings?: any[]
    init_params?: any
}export interface ServiceIdentity {
    owner: string
    name: string
    version?: string
}export interface RepositorySettings {
    storage: StorageSettings
}export const someFunc = async (...params) => {
   return await origin.someFunc(...params)
}export const someArrowFunc = async (...params) => {
   return await origin.someArrowFunc(...params)
}export const x =  (...params) => {
   return  origin.x(...params)
}export const z = async (...params) => {
   return await origin.z(...params)
}