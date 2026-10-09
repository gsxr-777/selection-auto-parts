import {describe,it,expect} from 'vitest';
import {parseFavorites,toggleFavorite,localizedLabel} from './index';
describe('favorite model contract',()=>{
  it('rejects corrupted and unsupported storage',()=>{for(const value of [null,'invalid','{"version":2,"modelIds":[]}','{"version":1,"modelIds":[2]}']) expect(parseFavorites(value)).toEqual([]);});
  it('deduplicates stable IDs and toggles without catalog assertions',()=>{expect(parseFavorites('{"version":1,"modelIds":["model-1","model-1"]}')).toEqual(['model-1']); expect(toggleFavorite(['model-1'],'model-1')).toEqual([]); expect(toggleFavorite([],'model-1')).toEqual(['model-1']); expect(toggleFavorite([],'')).toEqual([]);});
  it('bounds storage',()=>{expect(toggleFavorite(Array.from({length:100},(_,i)=>String(i)),'new')).toHaveLength(100);});
});
it('falls back to default then source text',()=>{expect(localizedLabel({ru:'Русский'},'en','Original')).toBe('Русский');expect(localizedLabel({},'en','Original')).toBe('Original');});
