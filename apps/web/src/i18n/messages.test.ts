import {it,expect} from 'vitest';
import ru from '../../messages/ru/common.json';
import en from '../../messages/en/common.json';
it('requires matching nonempty translations in both launch locales',()=>{expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort());for(const value of [...Object.values(ru),...Object.values(en)])expect(value.trim().length).toBeGreaterThan(0);});
