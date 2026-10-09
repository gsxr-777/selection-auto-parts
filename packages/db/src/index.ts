import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from './generated/client';
import type {VehicleModel} from '@selection/core';
export function createDatabase(url: string) {
  return new PrismaClient({adapter:new PrismaPg({connectionString:url,max:3,connectionTimeoutMillis:5000})});
}
export interface VehicleCatalogRepository { models(input:{locale:'ru'|'en';makeId?:string}):Promise<VehicleModel[]> }
// No source schema/import approved yet; this adapter makes no fabricated records.
export const unavailableVehicleCatalog: VehicleCatalogRepository = {async models(){return [];}};
