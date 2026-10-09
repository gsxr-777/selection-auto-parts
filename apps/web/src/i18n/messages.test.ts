import {it,expect} from 'vitest';
import ru from '../../messages/ru/common.json';
import en from '../../messages/en/common.json';
function leaves(value:unknown,prefix=''):Record<string,string>{if(typeof value==='string')return {[prefix]:value};if(value&&typeof value==='object')return Object.assign({},...Object.entries(value).map(([key,child])=>leaves(child,prefix?`${prefix}.${key}`:key)));throw new Error('Invalid translation');}
it('requires matching nonempty translations in both launch locales',()=>{const dictionaries=[leaves(ru),leaves(en)];expect(Object.keys(dictionaries[0]).sort()).toEqual(Object.keys(dictionaries[1]).sort());for(const dictionary of dictionaries)for(const value of Object.values(dictionary))expect(value.trim().length).toBeGreaterThan(0);});
